import { pool } from '../config/db.js';
import { Post } from '../models/Post.js';

const TRUST_LEVELS = [
  { name: 'Newcomer', min: -Infinity, next: 10 },
  { name: 'Contributor', min: 10, next: 30 },
  { name: 'Trusted', min: 30, next: 75 },
  { name: 'Expert', min: 75, next: 150 },
  { name: 'Mentor', min: 150, next: null },
];

function trustForRating(value) {
  const rating = Number(value || 0);
  let current = TRUST_LEVELS[0];
  for (const level of TRUST_LEVELS) {
    if (rating >= level.min) current = level;
  }
  if (current.next === null) return { name: current.name, rating, nextLevelAt: null, progress: 100 };
  const floor = Number.isFinite(current.min) ? current.min : 0;
  const span = current.next - floor;
  const progress = Math.max(0, Math.min(100, Math.round(((rating - floor) / span) * 100)));
  return { name: current.name, rating, nextLevelAt: current.next, progress };
}

function contributionStreak(days) {
  if (!days.length) return 0;
  const available = new Set(days.map((value) => String(value).slice(0, 10)));
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  const today = cursor.toISOString().slice(0, 10);
  if (!available.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (available.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function buildAchievements({ posts, answers, positiveReceived, streak, rating }) {
  return [
    { id: 'first-answer', title: 'First answer', description: 'Help someone with your first answer.', unlocked: answers >= 1, progress: Math.min(1, answers), target: 1 },
    { id: 'five-answers', title: 'Keep helping', description: 'Write five answers.', unlocked: answers >= 5, progress: Math.min(5, answers), target: 5 },
    { id: 'helpful-five', title: 'Useful voice', description: 'Receive five positive reactions.', unlocked: positiveReceived >= 5, progress: Math.min(5, positiveReceived), target: 5 },
    { id: 'three-day-streak', title: 'On a roll', description: 'Contribute on three days in a row.', unlocked: streak >= 3, progress: Math.min(3, streak), target: 3 },
    { id: 'three-questions', title: 'Curious mind', description: 'Ask three questions.', unlocked: posts >= 3, progress: Math.min(3, posts), target: 3 },
    { id: 'trusted', title: 'Trusted contributor', description: 'Reach 30 reputation.', unlocked: rating >= 30, progress: Math.max(0, Math.min(30, rating)), target: 30 },
  ];
}

export async function getUserDashboard(userId) {
  const [[userRows], [countsRows], [reactionRows], [activityRows], [suggestionRows]] = await Promise.all([
    pool.execute('SELECT id, login, full_name, email, avatar, rating, role, created_at FROM users WHERE id=? LIMIT 1', [userId]),
    pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM posts WHERE author_id=?) AS posts,
         (SELECT COUNT(*) FROM comments WHERE author_id=?) AS answers,
         (SELECT COUNT(*) FROM comments WHERE author_id=? AND YEARWEEK(created_at, 1)=YEARWEEK(NOW(), 1)) AS answers_this_week,
         (SELECT COUNT(*) FROM favorites WHERE user_id=?) AS favorites,
         (SELECT COUNT(*) FROM post_subscriptions WHERE user_id=?) AS following,
         (SELECT COUNT(*) FROM notifications WHERE user_id=? AND read_at IS NULL) AS unread_notifications`,
      [userId, userId, userId, userId, userId, userId],
    ),
    pool.execute(
      `SELECT r.type, COUNT(*) AS count
       FROM reactions r
       LEFT JOIN posts p ON p.id=r.post_id
       LEFT JOIN comments c ON c.id=r.comment_id
       WHERE p.author_id=? OR c.author_id=?
       GROUP BY r.type`,
      [userId, userId],
    ),
    pool.execute(
      `SELECT activity_day
       FROM (
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS activity_day FROM posts WHERE author_id=?
         UNION
         SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS activity_day FROM comments WHERE author_id=?
       ) activity
       ORDER BY activity_day DESC
       LIMIT 60`,
      [userId, userId],
    ),
    pool.execute(
      `SELECT p.*, u.login AS author_login, u.avatar AS author_avatar,
              COALESCE((SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.status='active'), 0) AS comment_count,
              COALESCE((SELECT COUNT(*) FROM reactions r WHERE r.post_id=p.id AND r.type='like'), 0) AS like_count,
              COALESCE((SELECT SUM(CASE r.type WHEN 'like' THEN 1 WHEN 'dislike' THEN -1 WHEN 'useful' THEN 2 WHEN 'thanks' THEN 1 WHEN 'fire' THEN 1 ELSE 0 END) FROM reactions r WHERE r.post_id=p.id), 0) AS score
       FROM posts p
       JOIN users u ON u.id=p.author_id
       WHERE p.status='active' AND p.locked=0 AND p.author_id<>?
         AND NOT EXISTS(SELECT 1 FROM comments mine WHERE mine.post_id=p.id AND mine.author_id=?)
       ORDER BY comment_count ASC, p.created_at DESC
       LIMIT 5`,
      [userId, userId],
    ),
  ]);

  const user = userRows[0] || null;
  const counts = countsRows[0] || {};
  const reactionBreakdown = Object.fromEntries(reactionRows.map((row) => [row.type, Number(row.count)]));
  const positiveReceived = ['like', 'useful', 'fire', 'thanks'].reduce((sum, type) => sum + Number(reactionBreakdown[type] || 0), 0);
  const streak = contributionStreak(activityRows.map((row) => row.activity_day));
  const rating = Number(user?.rating || 0);
  const weeklyTarget = 5;
  const weeklyProgress = Math.min(weeklyTarget, Number(counts.answers_this_week || 0));

  return {
    user,
    trust: trustForRating(rating),
    stats: {
      posts: Number(counts.posts || 0),
      answers: Number(counts.answers || 0),
      answersThisWeek: Number(counts.answers_this_week || 0),
      favorites: Number(counts.favorites || 0),
      following: Number(counts.following || 0),
      unreadNotifications: Number(counts.unread_notifications || 0),
      positiveReactionsReceived: positiveReceived,
      contributionStreak: streak,
    },
    weeklyGoal: { target: weeklyTarget, current: weeklyProgress, completed: weeklyProgress >= weeklyTarget },
    reactionsReceived: reactionBreakdown,
    achievements: buildAchievements({ posts: Number(counts.posts || 0), answers: Number(counts.answers || 0), positiveReceived, streak, rating }),
    suggestions: await Post.attachCategories(suggestionRows),
  };
}

function recentDays(count = 7) {
  const result = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    result.push(day.toISOString().slice(0, 10));
  }
  return result;
}

function mergeGrowth(rowsByKey) {
  return recentDays(7).map((date) => {
    const item = { date };
    for (const [key, rows] of Object.entries(rowsByKey)) {
      const found = rows.find((row) => String(row.day).slice(0, 10) === date);
      item[key] = Number(found?.count || 0);
    }
    return item;
  });
}

export async function getAdminDashboard() {
  const [[overviewRows], [usersGrowth], [postsGrowth], [commentsGrowth], [reactionsGrowth], [topContributors], [topCategories], [reactionMix], [moderationPosts], [moderationComments]] = await Promise.all([
    pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE email_verified=1) AS verified_users,
         (SELECT COUNT(*) FROM users WHERE created_at>=DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_users_7d,
         (SELECT COUNT(*) FROM posts) AS posts,
         (SELECT COUNT(*) FROM posts WHERE status='active') AS active_posts,
         (SELECT COUNT(*) FROM posts WHERE status='inactive') AS inactive_posts,
         (SELECT COUNT(*) FROM posts WHERE locked=1) AS locked_posts,
         (SELECT COUNT(*) FROM comments) AS comments,
         (SELECT COUNT(*) FROM comments WHERE status='inactive') AS inactive_comments,
         (SELECT COUNT(*) FROM comments WHERE locked=1) AS locked_comments,
         (SELECT COUNT(*) FROM reactions) AS reactions,
         (SELECT COUNT(*) FROM favorites) AS favorites,
         (SELECT COUNT(*) FROM post_subscriptions) AS following,
         (SELECT COUNT(*) FROM post_shares) AS shares,
         (SELECT COUNT(*) FROM notifications WHERE read_at IS NULL) AS unread_notifications`,
    ),
    pool.execute(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count FROM users WHERE created_at>=DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at)`),
    pool.execute(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count FROM posts WHERE created_at>=DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at)`),
    pool.execute(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count FROM comments WHERE created_at>=DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at)`),
    pool.execute(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count FROM reactions WHERE created_at>=DATE_SUB(CURDATE(), INTERVAL 6 DAY) GROUP BY DATE(created_at)`),
    pool.execute(
      `SELECT u.id, u.login, u.avatar, u.rating, COUNT(DISTINCT p.id) AS posts, COUNT(DISTINCT c.id) AS answers
       FROM users u LEFT JOIN posts p ON p.author_id=u.id LEFT JOIN comments c ON c.author_id=u.id
       WHERE u.role='user' GROUP BY u.id ORDER BY u.rating DESC, answers DESC, posts DESC LIMIT 8`,
    ),
    pool.execute(
      `SELECT cat.id, cat.title, COUNT(DISTINCT pc.post_id) AS posts, COUNT(DISTINCT c.id) AS comments
       FROM categories cat LEFT JOIN post_categories pc ON pc.category_id=cat.id LEFT JOIN comments c ON c.post_id=pc.post_id
       GROUP BY cat.id ORDER BY posts DESC, comments DESC, cat.title LIMIT 8`,
    ),
    pool.execute('SELECT type, COUNT(*) AS count FROM reactions GROUP BY type ORDER BY count DESC'),
    pool.execute(
      `SELECT p.id, p.title, p.status, p.locked, p.created_at, u.login AS author_login
       FROM posts p JOIN users u ON u.id=p.author_id
       WHERE p.status='inactive' OR p.locked=1 ORDER BY p.updated_at DESC LIMIT 8`,
    ),
    pool.execute(
      `SELECT c.id, c.post_id, c.content, c.status, c.locked, c.created_at, u.login AS author_login, p.title AS post_title
       FROM comments c JOIN users u ON u.id=c.author_id JOIN posts p ON p.id=c.post_id
       WHERE c.status='inactive' OR c.locked=1 ORDER BY c.updated_at DESC LIMIT 8`,
    ),
  ]);

  const overview = Object.fromEntries(Object.entries(overviewRows[0] || {}).map(([key, value]) => [key, Number(value)]));
  return {
    overview,
    growth: mergeGrowth({ users: usersGrowth, posts: postsGrowth, comments: commentsGrowth, reactions: reactionsGrowth }),
    topContributors: topContributors.map((row) => ({ ...row, rating: Number(row.rating), posts: Number(row.posts), answers: Number(row.answers) })),
    topCategories: topCategories.map((row) => ({ ...row, posts: Number(row.posts), comments: Number(row.comments) })),
    reactionMix: reactionMix.map((row) => ({ type: row.type, count: Number(row.count) })),
    moderation: { posts: moderationPosts, comments: moderationComments },
  };
}
