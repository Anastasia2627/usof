import { Category } from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';

function categoryId(value) {
  return positiveInt(value, 'INVALID_CATEGORY_ID', 'Category id must be a positive integer');
}

function normalizeInput(body, { partial = false } = {}) {
  const data = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title ?? '').trim();
    if (!title) throw new AppError(422, 'VALIDATION_ERROR', 'title is required');
    if (title.length > 100) {
      throw new AppError(422, 'TITLE_TOO_LONG', 'title must contain at most 100 characters');
    }
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

export async function listCategories() {
  return Category.list();
}

export async function getCategoryById(value) {
  const category = await Category.findById(categoryId(value));
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  return category;
}

export async function createCategoryRecord(body) {
  try {
    return await Category.create(normalizeInput(body));
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function updateCategoryRecord(value, body) {
  const id = categoryId(value);
  const current = await Category.findById(id);
  if (!current) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  const data = normalizeInput(body, { partial: true });
  if (!Object.keys(data).length) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Provide title or description to update');
  }
  try {
    return await Category.update(id, data);
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function deleteCategoryRecord(value) {
  const removed = await Category.remove(categoryId(value));
  if (!removed) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
}

export async function listCategoryPosts(value, user) {
  const id = categoryId(value);
  const category = await Category.findById(id);
  if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  return Category.postsForCategory(id, user);
}
