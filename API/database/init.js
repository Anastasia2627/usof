import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

dotenv.config();

const database = process.env.DB_NAME || 'usof';
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error('DB_NAME may contain only letters, numbers, and underscores');
}

const APP_TABLES = [
  'notifications',
  'post_shares',
  'post_subscriptions',
  'favorites',
  'reactions',
  'comments',
  'post_categories',
  'posts',
  'categories',
  'users',
];

const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

function resetIsConfirmed() {
  if (process.env.NODE_ENV === 'test' && /_(test|ci)$/.test(database)) return true;
  return process.argv.includes(`--confirm=${database}`);
}

async function ensureCircleSchema(connection) {
  const [columns] = await connection.query(
    `SELECT COLUMN_NAME AS column_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='users'`,
    [database],
  );
  const known = new Set(columns.map((row) => row.column_name));

  if (!known.has('verification_code_hash')) {
    await connection.query('ALTER TABLE users ADD COLUMN verification_code_hash CHAR(64) NULL AFTER verification_token_expires');
  }
  if (!known.has('verification_code_expires')) {
    await connection.query('ALTER TABLE users ADD COLUMN verification_code_expires DATETIME NULL AFTER verification_code_hash');
  }
  if (!known.has('google_sub')) {
    await connection.query('ALTER TABLE users ADD COLUMN google_sub VARCHAR(64) NULL UNIQUE AFTER role');
  }
  // Additive, idempotent migration: never drop existing user data.
  await connection.query("ALTER TABLE users MODIFY COLUMN role ENUM('user','moderator','admin') NOT NULL DEFAULT 'user'");
  // Existing databases need the new notification kind, without deleting old notifications.
  await connection.query("ALTER TABLE notifications MODIFY COLUMN type ENUM('comment','reply','post_updated','reaction','role_changed','category_suggestion','category_decision') NOT NULL");
  const [postColumns] = await connection.query("SHOW COLUMNS FROM posts");
  const postKnown = new Set(postColumns.map(row=>row.Field));
  if (!postKnown.has('closed')) await connection.query("ALTER TABLE posts ADD COLUMN closed BOOLEAN NOT NULL DEFAULT 0");
  if (!postKnown.has('hide_likes')) await connection.query("ALTER TABLE posts ADD COLUMN hide_likes BOOLEAN NOT NULL DEFAULT 0");
  if (!postKnown.has('publish_at')) await connection.query("ALTER TABLE posts ADD COLUMN publish_at DATETIME NULL, ADD INDEX idx_post_publish_at(publish_at)");
  const [commentColumns] = await connection.query("SHOW COLUMNS FROM comments");
  if (!commentColumns.some(row=>row.Field==='reviewed_by')) {
    await connection.query('ALTER TABLE comments ADD COLUMN reviewed_by INT UNSIGNED NULL, ADD CONSTRAINT fk_comment_reviewed_by FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL');
  }
  await connection.query(`CREATE TABLE IF NOT EXISTS user_follows (
    follower_id INT UNSIGNED NOT NULL,
    followed_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(follower_id,followed_id),
    FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(followed_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS user_interests (
    user_id INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    PRIMARY KEY(user_id,category_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  // Legacy direct_messages tables are intentionally preserved in existing databases.
  // New deployments do not create or expose unfinished private messaging.

  // Non-destructive migrations for answers, photos and moderation.
  const [answerColumn] = await connection.query("SHOW COLUMNS FROM posts LIKE 'accepted_comment_id'");
  if (!answerColumn.length) await connection.query(
    "ALTER TABLE posts ADD COLUMN accepted_comment_id INT UNSIGNED NULL, ADD CONSTRAINT fk_post_solution FOREIGN KEY (accepted_comment_id) REFERENCES comments(id) ON DELETE SET NULL"
  );
  await connection.query(`CREATE TABLE IF NOT EXISTS post_images (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    post_id INT UNSIGNED NOT NULL, uploader_id INT UNSIGNED NOT NULL,
    filename VARCHAR(110) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_post_images(post_id,id),
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY(uploader_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
  await connection.query(`CREATE TABLE IF NOT EXISTS content_reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reporter_id INT UNSIGNED NOT NULL,
    post_id INT UNSIGNED NULL, comment_id INT UNSIGNED NULL,
    reason VARCHAR(24) NOT NULL, details VARCHAR(500) NOT NULL DEFAULT '',
    status ENUM('open','reviewed','dismissed') NOT NULL DEFAULT 'open',
    resolved_by INT UNSIGNED NULL, resolved_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_report_post(reporter_id,post_id),
    UNIQUE KEY uq_report_comment(reporter_id,comment_id),
    INDEX idx_reports_status(status,created_at),
    CONSTRAINT ck_report_target CHECK ((post_id IS NOT NULL)+(comment_id IS NOT NULL)=1),
    FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY(resolved_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);

  await connection.query(`CREATE TABLE IF NOT EXISTS category_suggestions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    title VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    reviewer_id INT UNSIGNED NULL,
    category_id INT UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME NULL,
    INDEX idx_category_suggestions_status(status,created_at),
    INDEX idx_category_suggestions_user(user_id,created_at),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
  ) ENGINE=InnoDB`);

  // A broad public conversation feed, without resetting the six existing
  // course/demo categories or touching existing posts.
  const topics = [
    ['Music','Music, artists and playlists'],['Movies','Films, series and recommendations'],
    ['Games','Video games, tabletop games and playing together'],
    ['Books','Books, stories and reading'],['Art','Drawing, illustration and creativity'],
    ['Photography','Photos and visual storytelling'],['Travel','Trips, places and discoveries'],
    ['Food','Cooking, recipes and discoveries'],['Pets','Cats, dogs and animal friends'],
    ['Fitness','Sport, yoga and movement'],['Fashion','Personal style and outfits'],
    ['Beauty','Skincare and self care'],['Relationships','Friendship, love and conversations'],
    ['Lifestyle','Daily life and little discoveries'],['Nature','Outdoors and the environment'],
    ['Science','Curiosity, experiments and discoveries'],['Technology','Tech beyond programming'],
    ['Education','Learning and student life'],['Languages','Learning and speaking languages'],
    ['Cars','Vehicles and motorsport'],['Humor','Memes and funny stories'],
    ['Crafts','DIY, embroidery and handmade projects'],['Career','Work and career journeys'],
    ['Wellbeing','Rest, mental health and balance'],['Questions','Ask the community anything'],
    ['Discussion','Opinions and everyday conversations'],['Events','Plans, festivals and meetups'],
    ['Design','Graphic, digital and product design'],['Anime','Anime and animation'],
    ['History','History and cultures']
  ];
  for (const [title,description] of topics)
    await connection.query('INSERT IGNORE INTO categories(title,description) VALUES(?,?)',[title,description]);

  // Idempotent public demo conversations by seeded fixture users only
  // This makes the community feel social without modifying real members' posts
  const demos = [
    ['asya','Music','The playlist that got me through this week','I made a playlist for rainy evenings and somehow ended up listening to it every day, what is your comfort song?'],
    ['alex','Games','Co-op games for a weekend','Looking for something fun to play together, no competitive pressure, just a good time'],
    ['maria','Pets','Today my cat claimed the entire sofa','Little story from home: I got up for tea and lost my seat permanently'],
    ['sam','Travel','My favorite little streets in old cities','Sometimes the best part of traveling is getting lost somewhere quiet and unexpectedly beautiful'],
    ['asya','Art','A small creative habit changed my evenings','I started drawing for ten minutes a day without trying to make anything perfect, it feels surprisingly freeing'],
    ['maria','Movies','Movies that feel like autumn','I love cozy movies with warm lighting, cafés, old houses and a little mystery'],
    ['alex','Food','Homemade cinnamon rolls are underrated','The smell of fresh cinnamon in the kitchen beats any fancy candle'],
    ['sam','Science','Something fascinating I learned about the ocean','Did you know that we still know so little about deep sea habitats? Every new discovery feels like science fiction'],
    ['asya','Lifestyle','Learning to enjoy a quiet Sunday','Slow mornings, a book and a walk with no big plans, sometimes that is enough'],
    ['maria','Crafts','Anyone else obsessed with handmade gifts?','I love when presents carry a story, even if the edges are a bit imperfect'],
    ['alex','Anime','Animation is such an underrated art form','The amount of emotion that can fit into a few hand-drawn frames is amazing'],
    ['sam','Relationships','A small thing that makes friendship better','Remembering tiny details and showing up when it matters has been more important than grand gestures'],
    ['asya','Fitness','Tried yoga and finally relaxed my shoulders','I expected stretching but ended up leaving with so much more energy'],
    ['maria','Books','Books I wish I could read for the first time again','There is something special about finding a fictional place that feels like home'],
    ['alex','Photography','Golden hour on an ordinary street','I stopped on the way home and noticed how the evening sun made everything look cinematic'],
    ['sam','Humor','What tiny inconvenience became your villain origin story','Mine was opening a bag of chips upside down and launching half of them across the room']
  ];
  const [demoUsers] = await connection.query("SELECT id,login,email FROM users WHERE login IN ('asya','alex','maria','sam') AND email LIKE '%@usof.local'");
  const demoByLogin=new Map(demoUsers.map(u=>[u.login,Number(u.id)]));
  for (const [login,topic,title,content] of demos) {
    const authorId=demoByLogin.get(login);
    if(!authorId)continue;
    const [[category]]=await connection.query('SELECT id FROM categories WHERE title=? LIMIT 1',[topic]);
    if(!category)continue;
    const [exist]=await connection.query('SELECT id FROM posts WHERE author_id=? AND title=? LIMIT 1',[authorId,title]);
    if(exist.length)continue;
    const [created]=await connection.query("INSERT INTO posts(author_id,title,content,status) VALUES(?,?,?,'active')",[authorId,title,content]);
    await connection.query('INSERT INTO post_categories(post_id,category_id) VALUES(?,?)',[created.insertId,category.id]);
  }

}

async function initializeDatabase() {
  const resetRequested = process.argv.includes('--reset');
  const connection = await mysql.createConnection(baseConfig);

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${database}\``);

    const [knownTables] = await connection.query(
      `SELECT TABLE_NAME AS table_name
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA=?`,
      [database],
    );
    const existing = new Set(knownTables.map((row) => row.table_name));
    const existingAppTables = APP_TABLES.filter((table) => existing.has(table));

    if (!resetRequested && existingAppTables.length === APP_TABLES.length) {
      await ensureCircleSchema(connection);
      console.log(`Database ${database} is already initialized. Existing data was left untouched and compatible schema upgrades were applied.`);
      return;
    }

    if (!resetRequested && existingAppTables.length > 0) {
      throw new Error(
        `Database ${database} contains a partial Usof schema. No data was changed. ` +
        `Review the database and use "npm run db:reset -- --confirm=${database}" only if a full reset is intended.`,
      );
    }

    if (resetRequested) {
      if (!resetIsConfirmed()) {
        throw new Error(
          `Refusing to reset database ${database}. Run "npm run db:reset -- --confirm=${database}" to confirm the destructive reset.`,
        );
      }
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      for (const table of ['category_suggestions','content_reports','post_images','direct_messages','user_interests','user_follows',...APP_TABLES]) {
        await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
    }

    await connection.query(`
      CREATE TABLE users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        login VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL DEFAULT '',
        email VARCHAR(190) NOT NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT 0,
        verification_token VARCHAR(128) NULL UNIQUE,
        verification_token_expires DATETIME NULL,
        verification_code_hash CHAR(64) NULL,
        verification_code_expires DATETIME NULL,
        avatar VARCHAR(255) NULL,
        rating INT NOT NULL DEFAULT 0,
        role ENUM('user','moderator','admin') NOT NULL DEFAULT 'user',
        google_sub VARCHAR(64) NULL UNIQUE,
        token_version INT UNSIGNED NOT NULL DEFAULT 0,
        reset_token_hash CHAR(64) NULL,
        reset_token_expires DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_role(role),
        INDEX idx_users_created(created_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(100) NOT NULL UNIQUE,
        description TEXT NOT NULL
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE posts (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        author_id INT UNSIGNED NOT NULL,
        title VARCHAR(180) NOT NULL,
        content TEXT NOT NULL,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        locked BOOLEAN NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_posts_author FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_posts_author(author_id), INDEX idx_posts_created(created_at), INDEX idx_posts_status(status)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE post_categories (
        post_id INT UNSIGNED NOT NULL,
        category_id INT UNSIGNED NOT NULL,
        PRIMARY KEY(post_id, category_id),
        CONSTRAINT fk_post_categories_post FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_post_categories_category FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE,
        INDEX idx_post_categories_category(category_id)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE comments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        post_id INT UNSIGNED NOT NULL,
        author_id INT UNSIGNED NOT NULL,
        parent_comment_id INT UNSIGNED NULL,
        content TEXT NOT NULL,
        status ENUM('active','inactive') NOT NULL DEFAULT 'active',
        locked BOOLEAN NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_comments_post FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_comments_author FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_comments_parent FOREIGN KEY(parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        INDEX idx_comments_post(post_id), INDEX idx_comments_author(author_id), INDEX idx_comments_parent(parent_comment_id),
        INDEX idx_comments_status(status), INDEX idx_comments_created(created_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE reactions (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        author_id INT UNSIGNED NOT NULL,
        post_id INT UNSIGNED NULL,
        comment_id INT UNSIGNED NULL,
        type ENUM('like','dislike','useful','fire','thanks') NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_reactions_author FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_reactions_post FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_reactions_comment FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        CONSTRAINT chk_reaction_target CHECK ((post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL)),
        UNIQUE KEY uniq_user_post(author_id, post_id), UNIQUE KEY uniq_user_comment(author_id, comment_id),
        INDEX idx_reactions_post(post_id), INDEX idx_reactions_comment(comment_id), INDEX idx_reactions_created(created_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE favorites (
        user_id INT UNSIGNED NOT NULL,
        post_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, post_id),
        CONSTRAINT fk_favorites_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_favorites_post FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        INDEX idx_favorites_post(post_id), INDEX idx_favorites_created(created_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE post_subscriptions (
        user_id INT UNSIGNED NOT NULL,
        post_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, post_id),
        CONSTRAINT fk_subscriptions_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_subscriptions_post FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        INDEX idx_subscriptions_post(post_id), INDEX idx_subscriptions_created(created_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE post_shares (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        post_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NULL,
        channel ENUM('native','copy','facebook','x','telegram','other') NOT NULL DEFAULT 'other',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_shares_post FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_shares_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_shares_post(post_id), INDEX idx_shares_created(created_at)
      ) ENGINE=InnoDB
    `);
    await connection.query(`
      CREATE TABLE notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        actor_id INT UNSIGNED NULL,
        type ENUM('comment','reply','post_updated','reaction','role_changed','category_suggestion','category_decision') NOT NULL,
        post_id INT UNSIGNED NULL,
        comment_id INT UNSIGNED NULL,
        title VARCHAR(180) NOT NULL,
        body VARCHAR(500) NOT NULL DEFAULT '',
        read_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notifications_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_notifications_actor FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_notifications_post FOREIGN KEY(post_id) REFERENCES posts(id) ON DELETE SET NULL,
        CONSTRAINT fk_notifications_comment FOREIGN KEY(comment_id) REFERENCES comments(id) ON DELETE SET NULL,
        INDEX idx_notifications_user_created(user_id, created_at), INDEX idx_notifications_user_read(user_id, read_at)
      ) ENGINE=InnoDB
    `);

    await connection.query(`CREATE TABLE category_suggestions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      title VARCHAR(100) NOT NULL,
      description VARCHAR(500) NOT NULL DEFAULT '',
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      reviewer_id INT UNSIGNED NULL,
      category_id INT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      INDEX idx_category_suggestions_status(status,created_at),
      INDEX idx_category_suggestions_user(user_id,created_at),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`);

    const passwordHash = await bcrypt.hash('Password123!', 12);
    const users = [
      ['admin', 'Admin User', 'admin@usof.local', 'admin'],
      ['asya', 'Asya V', 'asya@usof.local', 'user'],
      ['alex', 'Alex Kim', 'alex@usof.local', 'user'],
      ['maria', 'Maria Dev', 'maria@usof.local', 'user'],
      ['sam', 'Sam Code', 'sam@usof.local', 'user'],
    ];
    for (const [login, fullName, email, role] of users) {
      await connection.query(
        'INSERT INTO users(login,password_hash,full_name,email,email_verified,role) VALUES(?,?,?,?,1,?)',
        [login, passwordHash, fullName, email, role],
      );
    }

    const categories = [
      ['JavaScript', 'JavaScript language and ecosystem'],
      ['Node.js', 'Server-side JavaScript'],
      ['React', 'React UI development'],
      ['MySQL', 'Relational database questions'],
      ['CSS', 'Layouts and styling'],
      ['Git', 'Version control'],
    ];
    for (const category of categories) {
      await connection.query('INSERT INTO categories(title,description) VALUES(?,?)', category);
    }

    const posts = [
      [2, 'How should I structure an Express API?', 'I want a clean MVC structure without adding unnecessary complexity.', 'active'],
      [3, 'React state for a filtered feed', 'What should stay in local state and what belongs in Redux for a Q&A feed?', 'active'],
      [4, 'MySQL many-to-many categories', 'What is the safest schema for posts that can have several categories?', 'active'],
      [5, 'CSS layout for deeply nested replies', 'How can I keep nested comment threads readable on mobile?', 'active'],
      [2, 'Prevent duplicate likes', 'I need one like or dislike per user and target. Is a unique index enough?', 'active'],
      [3, 'Resolved draft question', 'This seeded post demonstrates private inactive content for its owner and admins.', 'inactive'],
    ];
    for (let index = 0; index < posts.length; index += 1) {
      const [authorId, title, content, status] = posts[index];
      const [result] = await connection.query(
        'INSERT INTO posts(author_id,title,content,status) VALUES(?,?,?,?)',
        [authorId, title, content, status],
      );
      const firstCategory = (index % categories.length) + 1;
      const secondCategory = ((index + 1) % categories.length) + 1;
      await connection.query(
        'INSERT INTO post_categories(post_id,category_id) VALUES(?,?),(?,?)',
        [result.insertId, firstCategory, result.insertId, secondCategory],
      );
    }

    const seededComments = [
      [1, 3, null, 'Keep route handlers thin and move data access out of them.'],
      [1, 4, 1, 'I also separate authorization middleware from controllers.'],
      [2, 2, null, 'Authentication is global state; temporary form inputs are local state.'],
      [2, 5, 3, 'That split also makes the UI easier to test.'],
      [3, 3, null, 'Use a junction table with a composite primary key.'],
      [3, 4, 5, 'And add indexes for lookups from either side.'],
    ];
    for (const [postId, authorId, parentId, content] of seededComments) {
      await connection.query(
        "INSERT INTO comments(post_id,author_id,parent_comment_id,content,status) VALUES(?,?,?,?,'active')",
        [postId, authorId, parentId, content],
      );
    }

    const reactions = [
      [3, 1, null, 'like'],
      [4, 1, null, 'useful'],
      [2, 2, null, 'like'],
      [5, 2, null, 'dislike'],
      [2, 3, null, 'thanks'],
      [5, null, 1, 'like'],
      [4, null, 3, 'useful'],
      [5, null, 5, 'fire'],
    ];
    for (const reaction of reactions) {
      await connection.query(
        'INSERT INTO reactions(author_id,post_id,comment_id,type) VALUES(?,?,?,?)',
        reaction,
      );
    }

    const favorites = [[2, 2], [2, 3], [3, 1], [4, 1], [5, 4], [5, 5]];
    for (const favorite of favorites) {
      await connection.query('INSERT INTO favorites(user_id,post_id) VALUES(?,?)', favorite);
    }

    const subscriptions = [[2, 2], [2, 3], [3, 1], [4, 1], [5, 1], [5, 4]];
    for (const subscription of subscriptions) {
      await connection.query('INSERT INTO post_subscriptions(user_id,post_id) VALUES(?,?)', subscription);
    }

    const shares = [
      [1, 3, 'copy'],
      [1, 4, 'native'],
      [2, 2, 'copy'],
      [3, 5, 'telegram'],
      [4, null, 'facebook'],
      [5, 2, 'x'],
    ];
    for (const share of shares) {
      await connection.query('INSERT INTO post_shares(post_id,user_id,channel) VALUES(?,?,?)', share);
    }

    const notifications = [
      [2, 5, 'comment', 2, 4, 'New answer on a question you follow', 'sam replied to a question you follow.'],
      [3, 4, 'reply', 1, 2, 'New reply in a discussion', 'maria replied in a discussion you follow.'],
      [4, 2, 'reaction', 3, 6, 'Someone found your answer useful', 'asya reacted to your answer.'],
      [5, 1, 'post_updated', 4, null, 'A followed question was updated', 'A question you follow has new details.'],
      [2, 5, 'reaction', 5, null, 'Your question received a reaction', 'sam reacted to your question.'],
    ];
    for (const notification of notifications) {
      await connection.query(
        'INSERT INTO notifications(user_id,actor_id,type,post_id,comment_id,title,body) VALUES(?,?,?,?,?,?,?)',
        notification,
      );
    }

    await connection.query(`
      UPDATE users u
      SET rating = (
        SELECT COALESCE(SUM(score), 0)
        FROM (
          SELECT p.author_id AS user_id,
                 CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 WHEN 'useful' THEN 2 WHEN 'thanks' THEN 1 WHEN 'fire' THEN 1 ELSE 0 END AS score
          FROM reactions r JOIN posts p ON p.id = r.post_id WHERE r.post_id IS NOT NULL
          UNION ALL
          SELECT c.author_id AS user_id,
                 CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 WHEN 'useful' THEN 2 WHEN 'thanks' THEN 1 WHEN 'fire' THEN 1 ELSE 0 END AS score
          FROM reactions r JOIN comments c ON c.id = r.comment_id WHERE r.comment_id IS NOT NULL
        ) all_scores
        WHERE all_scores.user_id = u.id
      )
    `);

    await ensureCircleSchema(connection);


    // Five meaningful fixtures for every additional social table.
    await connection.query(`INSERT INTO user_follows(follower_id,followed_id) VALUES
      (2,3),(2,4),(3,2),(4,5),(5,2)`);
    await connection.query(`INSERT INTO user_interests(user_id,category_id) VALUES
      (2,1),(3,2),(4,3),(5,4),(2,5)`);
    await connection.query(`INSERT INTO content_reports(reporter_id,post_id,comment_id,reason,details,status) VALUES
      (3,1,NULL,'other','Seed example','dismissed'),
      (4,2,NULL,'off_topic','Seed example','dismissed'),
      (5,3,NULL,'other','Seed example','reviewed'),
      (2,NULL,1,'other','Seed comment','dismissed'),
      (3,NULL,3,'other','Seed comment','reviewed')`);


    // Five REAL files for the optional image table, attached only to inactive
    // admin-owned fixture posts. These never pollute public conversation feeds.
    const [firstFixture]=await connection.query(
      "INSERT INTO posts(author_id,title,content,status) VALUES(1,'Image fixture A','Private media integration fixture','inactive')"
    );
    const [secondFixture]=await connection.query(
      "INSERT INTO posts(author_id,title,content,status) VALUES(1,'Image fixture B','Private media integration fixture','inactive')"
    );
    for(const id of [firstFixture.insertId,secondFixture.insertId]) {
      await connection.query('INSERT INTO post_categories(post_id,category_id) VALUES(?,1)',[id]);
    }
    const photoDir=path.resolve('API/uploads/posts');
    await fs.mkdir(photoDir,{recursive:true});
    for(let index=0;index<5;index++) {
      const filename='seed-image-'+(index+1)+'.webp';
      const sample=await sharp({create:{
        width:120,height:120,channels:3,
        background:['#e9dee7','#e6eadc','#dde9ee','#f4e3d4','#e2e1ef'][index],
      }}).webp({quality:85}).toBuffer();
      await fs.writeFile(path.join(photoDir,filename),sample);
      await connection.query('INSERT INTO post_images(post_id,uploader_id,filename) VALUES(?,1,?)',
        [index<3?firstFixture.insertId:secondFixture.insertId,filename]);
    }

    console.log(
      resetRequested
        ? `Database ${database} reset and seeded.`
        : `Database ${database} initialized with reproducible seed data.`,
    );
  } finally {
    await connection.end();
  }
}

await initializeDatabase();
