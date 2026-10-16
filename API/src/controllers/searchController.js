import { searchAll } from '../services/searchService.js';

export async function search(req, res) {
  res.json(await searchAll(req.query.q, req.user));
}
