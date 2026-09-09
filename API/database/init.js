import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const database = process.env.DB_NAME || 'usof';
if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME may contain only letters, numbers, and underscores');

const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const connection = await mysql.createConnection(baseConfig);
try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${database}\``);
  await connection.query('SET FOREIGN_KEY_CHECKS=0');
  for (const table of ['notifications','post_shares','post_subscriptions','favorites','reactions','comments','post_categories','posts','categories','users']) {
    await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
  await connection.query('SET FOREIGN_KEY_CHECKS=1');

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
      avatar VARCHAR(255) NULL,
      rating INT NOT NULL DEFAULT 0,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
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
      type ENUM('comment','reply','post_updated','reaction') NOT NULL,
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

  const passwordHash = await bcrypt.hash('Password123!', 12);
  const users = [
    ['admin', 'Admin User', 'admin@usof.local', 'admin'],
    ['asya', 'Asya V', 'asya@usof.local', 'user'],
    ['alex', 'Alex Kim', 'alex@usof.local', 'user'],
    ['maria', 'Maria Dev', 'maria@usof.local', 'user'],
    ['sam', 'Sam Code', 'sam@usof.local', 'user'],
  ];
  for (const [login, fullName, email, role] of users) {
    await connection.query(`INSERT INTO users(login,password_hash,full_name,email,email_verified,role) VALUES(?,?,?,?,1,?)`, [login, passwordHash, fullName, email, role]);
  }

  const categories = [
    ['JavaScript', 'JavaScript language and ecosystem'], ['Node.js', 'Server-side JavaScript'],
    ['React', 'React UI development'], ['MySQL', 'Relational database questions'],
    ['CSS', 'Layouts and styling'], ['Git', 'Version control'],
  ];
  for (const category of categories) await connection.query('INSERT INTO categories(title,description) VALUES(?,?)', category);

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
    const [result] = await connection.query('INSERT INTO posts(author_id,title,content,status) VALUES(?,?,?,?)', [authorId, title, content, status]);
    const firstCategory = (index % categories.length) + 1;
    const secondCategory = ((index + 1) % categories.length) + 1;
    await connection.query('INSERT INTO post_categories(post_id,category_id) VALUES(?,?),(?,?)', [result.insertId, firstCategory, result.insertId, secondCategory]);
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
    await connection.query(`INSERT INTO comments(post_id,author_id,parent_comment_id,content,status) VALUES(?,?,?,?,'active')`, [postId, authorId, parentId, content]);
  }

  const reactions = [
    [3, 1, null, 'like'], [4, 1, null, 'useful'], [2, 2, null, 'like'], [5, 2, null, 'dislike'],
    [2, 3, null, 'thanks'], [5, null, 1, 'like'], [4, null, 3, 'useful'], [5, null, 5, 'fire'],
  ];
  for (const reaction of reactions) await connection.query('INSERT INTO reactions(author_id,post_id,comment_id,type) VALUES(?,?,?,?)', reaction);

  const favorites = [[2,2],[2,3],[3,1],[4,1],[5,4],[5,5]];
  for (const favorite of favorites) await connection.query('INSERT INTO favorites(user_id,post_id) VALUES(?,?)', favorite);
  const subscriptions = [[2,2],[2,3],[3,1],[4,1],[5,1],[5,4]];
  for (const subscription of subscriptions) await connection.query('INSERT INTO post_subscriptions(user_id,post_id) VALUES(?,?)', subscription);
  const shares = [[1,3,'copy'],[1,4,'native'],[2,2,'copy'],[3,5,'telegram'],[4,null,'facebook'],[5,2,'x']];
  for (const share of shares) await connection.query('INSERT INTO post_shares(post_id,user_id,channel) VALUES(?,?,?)', share);
  const notifications = [
    [2,5,'comment',2,4,'New answer on a question you follow','sam replied to a question you follow.'],
    [3,4,'reply',1,2,'New reply in a discussion','maria replied in a discussion you follow.'],
    [4,2,'reaction',3,6,'Someone found your answer useful','asya reacted to your answer.'],
    [5,1,'post_updated',4,null,'A followed question was updated','A question you follow has new details.'],
    [2,5,'reaction',5,null,'Your question received a reaction','sam reacted to your question.'],
  ];
  for (const notification of notifications) {
    await connection.query('INSERT INTO notifications(user_id,actor_id,type,post_id,comment_id,title,body) VALUES(?,?,?,?,?,?,?)', notification);
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

  console.log(`Database ${database} initialized with reproducible seed data.`);
} finally {
  await connection.end();
}
