import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { AppError } from '../utils/AppError.js';
import { listPostFeed } from './postService.js';

export async function searchAll(query, actor) {
  const q = String(query || '').trim().slice(0, 120);
  if (!q) throw new AppError(422, 'SEARCH_REQUIRED', 'Enter something to search for');
  const term = '%' + q.replace(/[\\%_]/g, '') + '%';
  const [postResult, users, categories] = await Promise.all([
    listPostFeed({ search: q, sort: 'date', order: 'desc', limit: '20', page: '1' }, actor),
    User.searchPublic(term),
    Category.search(term),
  ]);
  return {
    query: q,
    data: { posts: postResult.data, users, categories },
    pagination: { posts: postResult.pagination },
  };
}
