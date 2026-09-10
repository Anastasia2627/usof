import {
  createCategoryRecord,
  deleteCategoryRecord,
  getCategoryById,
  listCategories,
  listCategoryPosts,
  updateCategoryRecord,
} from '../services/categoryService.js';

export async function listCategoriesController(req, res) {
  res.json({ data: await listCategories() });
}

export async function getCategory(req, res) {
  res.json({ data: await getCategoryById(req.params.category_id) });
}

export async function createCategory(req, res) {
  res.status(201).json({ data: await createCategoryRecord(req.body) });
}

export async function updateCategory(req, res) {
  res.json({ data: await updateCategoryRecord(req.params.category_id, req.body) });
}

export async function deleteCategory(req, res) {
  await deleteCategoryRecord(req.params.category_id);
  res.status(204).end();
}

export async function postsByCategory(req, res) {
  res.json({ data: await listCategoryPosts(req.params.category_id, req.user) });
}

export { listCategoriesController as listCategories };
