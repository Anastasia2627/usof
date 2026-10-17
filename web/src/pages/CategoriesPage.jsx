import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, PostCard, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

export default function CategoriesPage() {
  const {t}=usePreferences();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/categories')
      .then((result) => setCategories(result.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return <main>
    <p className="eyebrow">{t('Browse posts by topic')}</p>
    <h1>{t('Categories')}</h1>
    <ErrorBox error={error} />
    {loading
      ? <div className="card loading">Loading categories…</div>
      : categories.length
        ? <section className="categoryGrid">{categories.map((category) => <button className="card categoryCard" key={category.id} onClick={() => go(`/category/${category.id}`)}><span className="categoryIndex">{String(category.id).padStart(2, '0')}</span><h2>{t(category.title)}</h2><p>{t(category.description)}</p></button>)}</section>
        : <div className="card empty">No categories yet.</div>}
  </main>;
}

export function CategoryDetailPage({ id }) {
  const {t}=usePreferences();
  const auth = useSelector(state => state.auth);
  const [category, setCategory] = useState(null);
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => setPage(1), [id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    // Unlike /categories/:id/posts (legacy, first 50), the public posts API
    // supports real pagination. Categories must never silently hide older posts.
    const query = new URLSearchParams({
      category: String(id),
      page: String(page),
      limit: '8',
      sort: 'date',
      order: 'desc',
    });
    Promise.all([
      api(`/categories/${id}`, { signal: controller.signal }),
      api('/posts?' + query, { token: auth?.token, signal: controller.signal }),
    ])
      .then(([categoryResult, postResult]) => {
        if (controller.signal.aborted) return;
        setCategory(categoryResult.data);
        setPosts(postResult.data);
        setPagination(postResult.pagination);
      })
      .catch(err => {
        if (err.name !== 'AbortError' && !controller.signal.aborted) setError(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, page, auth?.token]);

  if (loading) return <main><div className="card loading">Loading category…</div></main>;

  return <main>
    <button className="linkButton" onClick={() => go('/categories')}>← All categories</button>
    <section className="hero categoryHero">
      <p className="eyebrow">Category {String(id).padStart(2, '0')}</p>
      <h1>{t(category?.title || 'Category')}</h1>
      {category?.description && <p>{t(category.description)}</p>}
    </section>
    <ErrorBox error={error} />
    {!error && (posts.length
      ? <section className="postList">{posts.map(post => <PostCard key={post.id} post={post} />)}</section>
      : <div className="card empty"><h2>No posts here yet</h2><p>Choose another topic or start the conversation.</p></div>)}
    {!error && pagination?.totalPages > 1 && <nav className="pager" aria-label="Category post pages">
      <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
      <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} posts</span>
      <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
    </nav>}
  </main>;
}
