import { pool } from '../config/db.js';
import { Post } from '../models/Post.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt, validateStatus } from '../utils/validation.js';
import { recalculateAllRatings } from './reactionService.js';
import { deliverNotifications, notifyPostFollowers } from './notificationService.js';

const SORT_COLUMNS = {
  likes: 'like_count',
  date: 'p.created_at',
  trending: 'trend_score',
};

function normalizeCategories(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(422, 'CATEGORIES_REQUIRED', 'At least one category is required');
  }
  const ids = [...new Set(value.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new AppError(422, 'INVALID_CATEGORY', 'Category IDs must be positive integers');
  }
  return ids;
}

function normalizePostText(title, content) {
  const cleanTitle = String(title ?? '').trim();
  const cleanContent = String(content ?? '').trim();
  if (!cleanTitle || !cleanContent) {
    throw new AppError(422, 'VALIDATION_ERROR', 'title and content are required');
  }
  if (cleanTitle.length > 180) {
    throw new AppError(422, 'TITLE_TOO_LONG', 'title must contain at most 180 characters');
  }
  if (cleanContent.length > 50000) {
    throw new AppError(422, 'CONTENT_TOO_LONG', 'content must contain at most 50000 characters');
  }
  return { title: cleanTitle, content: cleanContent };
}

function parseDate(value, field) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new AppError(422, 'INVALID_DATE', `${field} must be a valid date`);
  }
  return timestamp;
}

function endExclusiveForDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 19).replace('T', ' ');
}

async function assertCategoriesExist(connection, ids) {
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.query(`SELECT id FROM categories WHERE id IN (${placeholders})`, ids);
  if (rows.length !== ids.length) {
    throw new AppError(422, 'INVALID_CATEGORY', 'One or more categories do not exist');
  }
}

export async function getVisiblePost(idValue, user) {
  const id = positiveInt(idValue, 'INVALID_POST_ID', 'Invalid post id');
  const post = await Post.findById(id);
  if (!post) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  const isOwner = user && Number(user.sub) === Number(post.author_id);
  if (post.status === 'inactive' && user?.role !== 'admin' && !isOwner) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  }
  return post;
}

export async function listPostFeed(query, user) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  const sort = SORT_COLUMNS[query.sort] || SORT_COLUMNS.likes;
  const order = String(query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const where = [];
  const params = [];

  if (user?.role !== 'admin') {
    if (user) {
      where.push("(p.status='active' OR p.author_id=?)");
      params.push(Number(user.sub));
    } else {
      where.push("p.status='active'");
    }
  }

  if (query.status) {
    where.push('p.status=?');
    params.push(validateStatus(query.status));
  }
  if (query.author) {
    where.push('p.author_id=?');
    params.push(positiveInt(query.author, 'INVALID_AUTHOR_ID', 'Invalid author id'));
  }

  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from !== null && to !== null && from > to) {
    throw new AppError(422, 'INVALID_DATE_RANGE', 'from must be earlier than or equal to to');
  }
  if (query.from) {
    where.push('p.created_at>=?');
    params.push(query.from);
  }
  if (query.to) {
    const exclusiveEnd = endExclusiveForDateOnly(query.to);
    if (exclusiveEnd) {
      where.push('p.created_at<?');
      params.push(exclusiveEnd);
    } else {
      where.push('p.created_at<=?');
      params.push(query.to);
    }
  }
  if (query.category) {
    where.push('EXISTS(SELECT 1 FROM post_categories fpc WHERE fpc.post_id=p.id AND fpc.category_id=?)');
    params.push(positiveInt(query.category, 'INVALID_CATEGORY_ID', 'Invalid category id'));
  }
  if (query.search) {
    const search = String(query.search).trim().slice(0, 120);
    if (search) {
      where.push('(p.title LIKE ? OR p.content LIKE ? OR u.login LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { posts, total } = await Post.list({
    clause,
    params,
    sort,
    order,
    limit,
    offset: (page - 1) * limit,
  });
  return {
    data: posts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createPostForUser(user, body) {
  const { title, content } = normalizePostText(body.title, body.content);
  const categories = normalizeCategories(body.categories);
  const connection = await pool.getConnection();
  let postId;
  try {
    await connection.beginTransaction();
    await assertCategoriesExist(connection, categories);
    const [result] = await connection.query(
      "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,?,?,'active',0)",
      [Number(user.sub), title, content],
    );
    postId = Number(result.insertId);
    for (const categoryId of categories) {
      await connection.query(
        'INSERT INTO post_categories(post_id,category_id) VALUES(?,?)',
        [postId, categoryId],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getVisiblePost(postId, user);
}

export async function updatePostForUser(user, idValue, body) {
  const post = await getVisiblePost(idValue, user);
  const isAdmin = user.role === 'admin';
  const isOwner = Number(user.sub) === Number(post.author_id);
  if (!isAdmin && !isOwner) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner or an admin can update this post');
  }
  if (post.locked && !isAdmin) throw new AppError(423, 'POST_LOCKED', 'This post is locked');
  if (isAdmin && (body.title !== undefined || body.content !== undefined)) {
    throw new AppError(
      403,
      'POST_CONTENT_IMMUTABLE_FOR_ADMIN',
      'Admins may moderate status/categories/lock but cannot edit post title or content',
    );
  }
  if (!isAdmin && (body.status !== undefined || body.locked !== undefined)) {
    throw new AppError(403, 'ADMIN_REQUIRED', 'Only admins can change post status or lock state');
  }

  let title = post.title;
  let content = post.content;
  let status = post.status;
  let locked = Boolean(post.locked);
  if (isAdmin) {
    if (body.status !== undefined) status = validateStatus(body.status);
    if (body.locked !== undefined) locked = Boolean(body.locked);
  } else if (body.title !== undefined || body.content !== undefined) {
    const normalized = normalizePostText(body.title ?? post.title, body.content ?? post.content);
    title = normalized.title;
    content = normalized.content;
  }

  const categories = body.categories !== undefined ? normalizeCategories(body.categories) : null;
  const changedForFollowers = !isAdmin && (
    title !== post.title || content !== post.content || categories !== null
  );
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (categories) await assertCategoriesExist(connection, categories);
    await connection.query(
      'UPDATE posts SET title=?, content=?, status=?, locked=? WHERE id=?',
      [title, content, status, locked ? 1 : 0, post.id],
    );
    if (categories) {
      await connection.query('DELETE FROM post_categories WHERE post_id=?', [post.id]);
      for (const categoryId of categories) {
        await connection.query(
          'INSERT INTO post_categories(post_id,category_id) VALUES(?,?)',
          [post.id, categoryId],
        );
      }
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (changedForFollowers && status === 'active') {
    await deliverNotifications([
      () => notifyPostFollowers({
        postId: Number(post.id),
        actorId: Number(user.sub),
        type: 'post_updated',
      }),
    ]);
  }
  return getVisiblePost(post.id, user);
}

export async function deletePostForUser(user, idValue) {
  const post = await getVisiblePost(idValue, user);
  if (user.role !== 'admin' && Number(user.sub) !== Number(post.author_id)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot delete this post');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM posts WHERE id=?', [post.id]);
    await recalculateAllRatings(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
