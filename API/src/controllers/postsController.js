import { pool } from '../config/db.js';
import { Post } from '../models/Post.js';
import { Reaction } from '../models/Reaction.js';
import { AppError } from '../utils/AppError.js';
import {
  deleteReaction,
  recalculateAllRatings,
  setReaction,
} from '../services/reactionService.js';

const SORT_COLUMNS = {
  likes: 'score',
  date: 'p.created_at',
};

function positiveInt(value, code = 'INVALID_ID') {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(422, code, 'Expected a positive integer');
  }
  return id;
}

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

function assertValidDate(value, field) {
  if (value && Number.isNaN(Date.parse(value))) {
    throw new AppError(422, 'INVALID_DATE', `${field} must be a valid date`);
  }
}

async function assertCategoriesExist(connection, ids) {
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.query(
    `SELECT id FROM categories WHERE id IN (${placeholders})`,
    ids,
  );
  if (rows.length !== ids.length) {
    throw new AppError(422, 'INVALID_CATEGORY', 'One or more categories do not exist');
  }
}

async function getPostById(idValue, user) {
  const id = positiveInt(idValue, 'INVALID_POST_ID');
  const post = await Post.findById(id);
  if (!post) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');

  const isOwner = user && Number(user.sub) === Number(post.author_id);
  if (post.status === 'inactive' && user?.role !== 'admin' && !isOwner) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  }

  return post;
}

export async function listPosts(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
  const sort = SORT_COLUMNS[req.query.sort] || SORT_COLUMNS.likes;
  const order = String(req.query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const where = [];
  const params = [];

  if (req.user?.role !== 'admin') {
    if (req.user) {
      where.push("(p.status='active' OR p.author_id=?)");
      params.push(Number(req.user.sub));
    } else {
      where.push("p.status='active'");
    }
  }

  if (req.query.status) {
    if (!['active', 'inactive'].includes(req.query.status)) {
      throw new AppError(422, 'INVALID_STATUS', 'status must be active or inactive');
    }
    where.push('p.status=?');
    params.push(req.query.status);
  }

  if (req.query.author) {
    where.push('p.author_id=?');
    params.push(positiveInt(req.query.author, 'INVALID_AUTHOR_ID'));
  }

  assertValidDate(req.query.from, 'from');
  assertValidDate(req.query.to, 'to');
  if (req.query.from && req.query.to && Date.parse(req.query.from) > Date.parse(req.query.to)) {
    throw new AppError(422, 'INVALID_DATE_RANGE', 'from must be earlier than or equal to to');
  }
  if (req.query.from) {
    where.push('p.created_at>=?');
    params.push(req.query.from);
  }
  if (req.query.to) {
    where.push('p.created_at<=?');
    params.push(req.query.to);
  }

  if (req.query.category) {
    where.push(
      'EXISTS(SELECT 1 FROM post_categories fpc WHERE fpc.post_id=p.id AND fpc.category_id=?)',
    );
    params.push(positiveInt(req.query.category, 'INVALID_CATEGORY_ID'));
  }

  if (req.query.search) {
    const search = String(req.query.search).trim().slice(0, 120);
    if (search) {
      where.push('(p.title LIKE ? OR p.content LIKE ? OR u.login LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
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

  res.json({
    data: posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getPost(req, res) {
  res.json({ data: await getPostById(req.params.post_id, req.user) });
}

export async function createPost(req, res) {
  const { title, content } = normalizePostText(req.body.title, req.body.content);
  const categories = normalizeCategories(req.body.categories);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await assertCategoriesExist(connection, categories);
    const [result] = await connection.query(
      "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,?,?,'active',0)",
      [Number(req.user.sub), title, content],
    );
    for (const categoryId of categories) {
      await connection.query(
        'INSERT INTO post_categories(post_id,category_id) VALUES(?,?)',
        [result.insertId, categoryId],
      );
    }
    await connection.commit();
    res.status(201).json({ data: await getPostById(result.insertId, req.user) });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updatePost(req, res) {
  const post = await getPostById(req.params.post_id, req.user);
  const isAdmin = req.user.role === 'admin';
  const isOwner = Number(req.user.sub) === Number(post.author_id);
  if (!isAdmin && !isOwner) {
    throw new AppError(403, 'FORBIDDEN', 'Only the owner or an admin can update this post');
  }
  if (post.locked && !isAdmin) {
    throw new AppError(423, 'POST_LOCKED', 'This post is locked');
  }

  let title = post.title;
  let content = post.content;
  let status = post.status;
  let locked = Boolean(post.locked);

  if (isAdmin) {
    if (req.body.status !== undefined) {
      if (!['active', 'inactive'].includes(req.body.status)) {
        throw new AppError(422, 'INVALID_STATUS', 'status must be active or inactive');
      }
      status = req.body.status;
    }
    if (req.body.locked !== undefined) locked = Boolean(req.body.locked);
  } else if (req.body.title !== undefined || req.body.content !== undefined) {
    const normalized = normalizePostText(
      req.body.title ?? post.title,
      req.body.content ?? post.content,
    );
    title = normalized.title;
    content = normalized.content;
  }

  const categories = req.body.categories !== undefined
    ? normalizeCategories(req.body.categories)
    : null;

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
    res.json({ data: await getPostById(post.id, req.user) });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function deletePost(req, res) {
  const post = await getPostById(req.params.post_id, req.user);
  if (req.user.role !== 'admin' && Number(req.user.sub) !== Number(post.author_id)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot delete this post');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM posts WHERE id=?', [post.id]);
    await recalculateAllRatings(connection);
    await connection.commit();
    res.status(204).end();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getPostCategories(req, res) {
  const post = await getPostById(req.params.post_id, req.user);
  res.json({ data: post.categories });
}

export async function getPostReactions(req, res) {
  const post = await getPostById(req.params.post_id, req.user);
  res.json({ data: await Reaction.listForPost(post.id) });
}

export async function reactToPost(req, res) {
  const post = await getPostById(req.params.post_id, req.user);
  await setReaction({
    userId: Number(req.user.sub),
    postId: Number(post.id),
    type: req.body.type,
    isAdmin: req.user.role === 'admin',
  });
  res.json({ data: await getPostById(post.id, req.user), message: 'Reaction saved' });
}

export async function removePostReaction(req, res) {
  const post = await getPostById(req.params.post_id, req.user);
  await deleteReaction({
    userId: Number(req.user.sub),
    postId: Number(post.id),
    deleteAll: req.user.role === 'admin' && req.query.all === '1',
  });
  res.status(204).end();
}
