import { Category } from '../models/Category.js';
import { AppError } from '../utils/AppError.js';

function categoryId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AppError(422, 'INVALID_CATEGORY_ID', 'Category id must be a positive integer');
  }
  return id;
}

function normalizeInput(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (!title) throw new AppError(422, 'VALIDATION_ERROR', 'title is required');
    if (title.length > 100) throw new AppError(422, 'TITLE_TOO_LONG', 'title must contain at most 100 characters');
    data.title = title;
  }
  if (!partial || body.description !== undefined) {
    const description = String(body.description ?? '').trim();
    if (description.length > 5000) {
      throw new AppError(422, 'DESCRIPTION_TOO_LONG', 'description must contain at most 5000 characters');
    }
    data.description = description;
  }
  return data;
}

function mapDuplicate(error) {
  if (error.code === 'ER_DUP_ENTRY') {
    throw new AppError(409, 'CATEGORY_EXISTS', 'Category already exists');
  }
  throw error;
}

export async function listCategories(req, res) {
  res.json({ data: await Category.list() });
}

export async function getCategory(req, res) {
  const category = await Category.findById(categoryId(req.params.category_id));
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  res.json({ data: category });
}

export async function createCategory(req, res) {
  const data = normalizeInput(req.body);
  try {
    res.status(201).json({ data: await Category.create(data) });
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function updateCategory(req, res) {
  const id = categoryId(req.params.category_id);
  const current = await Category.findById(id);
  if (!current) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  const data = normalizeInput(req.body, { partial: true });
  if (!Object.keys(data).length) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Provide title or description to update');
  }
  try {
    res.json({ data: await Category.update(id, data) });
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function deleteCategory(req, res) {
  const removed = await Category.remove(categoryId(req.params.category_id));
  if (!removed) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  res.status(204).end();
}

export async function postsByCategory(req, res) {
  const id = categoryId(req.params.category_id);
  const category = await Category.findById(id);
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  res.json({ data: await Category.postsForCategory(id, req.user) });
}
