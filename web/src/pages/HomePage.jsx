import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, PostCard, go } from '../ui.jsx';

export default function HomePage({ hash }) {
  const auth = useSelector((state) => state.auth);
  const params = useMemo(() => new URLSearchParams(hash.split('?')[1] || ''), [hash]);
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    sort: params.get('sort') || 'date',
    category: params.get('category') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    status: params.get('status') || '',
  });

  useEffect(() => {
    api('/categories').then((result) => setCategories(result.data)).catch(setError);
  }, []);

  useEffect(() => {
    setFilters({
      sort: params.get('sort') || 'date',
      category: params.get('category') || '',
      from: params.get('from') || '',
      to: params.get('to') || '',
      status: params.get('status') || '',
    });
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: params.get('page') || '1',
      limit: '8',
      sort: params.get('sort') || 'date',
      order: params.get('order') || 'desc',
    });
    for (const key of ['search', 'category', 'from', 'to', 'status']) {
      if (params.get(key)) query.set(key, params.get(key));
    }
    setLoading(true);
    setError(null);
    api(`/posts?${query}`, { token: auth?.token, signal: controller.signal })
      .then((result) => {
        setPosts(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => { if (err.name !== 'AbortError') setError(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [hash, auth?.token]);

  function applyFilters(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    const search = params.get('search');
    if (search) query.set('search', search);
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    go(query.size ? `/?${query}` : '/');
  }

  function page(number) {
    const query = new URLSearchParams(params);
    query.set('page', String(number));
    go(`/?${query}`);
  }

  return <main>
    <section className="hero">
      <p className="eyebrow">Programming questions, answered by people.</p>
      <h1>Ask clearly.<br />Answer usefully.</h1>
      {params.get('search') && <p className="searchCaption">Results for “{params.get('search')}” <button className="linkButton" onClick={() => go('/')}>clear</button></p>}
    </section>
    <form className="filterBar card" onSubmit={applyFilters}>
      <label>Sort<select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="date">Newest</option><option value="likes">Most liked</option><option value="trending">Trending</option></select></label>
      <label>Category<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
      <label>From<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
      <label>To<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
      {auth && <label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All viewable</option><option value="active">Active</option><option value="inactive">My inactive{auth.user.role === 'admin' ? ' / all inactive' : ''}</option></select></label>}
      <button className="secondary">Apply</button>
    </form>
    <ErrorBox error={error} />
    {loading
      ? <div className="card loading">Loading questions…</div>
      : posts.length
        ? <section className="postList">{posts.map((post) => <PostCard key={post.id} post={post} />)}</section>
        : <div className="card empty"><h2>No questions found</h2><p>Try changing the filters or ask the first question.</p></div>}
    {pagination && pagination.totalPages > 1 && <div className="pager">
      <button disabled={pagination.page <= 1} onClick={() => page(pagination.page - 1)}>← Previous</button>
      <span>Page {pagination.page} / {pagination.totalPages}</span>
      <button disabled={pagination.page >= pagination.totalPages} onClick={() => page(pagination.page + 1)}>Next →</button>
    </div>}
  </main>;
}
