import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, PostCard, go } from '../ui.jsx';

const FILTERS = ['sort', 'order', 'category', 'from', 'to', 'status'];

export default function HomePage({ hash }) {
  const auth = useSelector(state => state.auth);
  const params = useMemo(() => new URLSearchParams(hash.split('?')[1] || ''), [hash]);
  const [filters, setFilters] = useState({
    sort: params.get('sort') || 'likes',
    order: params.get('order') || 'desc',
    category: params.get('category') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    status: params.get('status') || '',
  });
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/categories').then(result => setCategories(result.data)).catch(setError);
  }, []);

  useEffect(() => {
    setFilters({
      sort: params.get('sort') || 'likes',
    order: params.get('order') || 'desc',
      category: params.get('category') || '',
      from: params.get('from') || '',
      to: params.get('to') || '',
      status: params.get('status') || '',
    });
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: params.get('page') || '1',
      limit: '8',
      sort: params.get('sort') || 'likes',
    order: params.get('order') || 'desc',

    });
    for (const name of ['category', 'from', 'to', 'status', 'search']) {
      if (params.get(name)) query.set(name, params.get(name));
    }
    setLoading(true);
    setError(null);
    api('/posts?' + query, { token: auth?.token, signal: controller.signal })
      .then(result => { setPosts(result.data); setPagination(result.pagination); })
      .catch(err => { if (err.name !== 'AbortError') setError(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [hash, auth?.token]);

  function apply(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (params.get('search')) query.set('search', params.get('search'));
    for (const name of FILTERS) {
      if (filters[name]) query.set(name, filters[name]);
    }
    go(query.size ? '/?' + query : '/');
  }

  function navigate(page) {
    const query = new URLSearchParams(params);
    query.set('page', String(page));
    go('/?' + query);
  }

  return <main className="homePage">
    <div className="pageHeading">
      <div><h1>Posts</h1><p className="muted">Browse discussions and share your knowledge.</p></div>
      {auth && <button className="primary" onClick={() => go('/create')}>New post</button>}
    </div>

    {params.get('search') && <p>Search: <strong>{params.get('search')}</strong> <button className="linkButton" onClick={() => go('/')}>Clear</button></p>}
    <form className="card filterBar" onSubmit={apply}>
      <label>Sort by
        <select value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value })}>
          <option value="likes">Number of likes</option>
          <option value="date">Publication date</option>
        </select>
      </label>
      <label>Direction
        <select aria-label="Sort direction" value={filters.order} onChange={e => setFilters({ ...filters, order: e.target.value })}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </label>
      <label>Category
        <select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </label>
      <label>From<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
      <label>To<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
      {auth && <label>Status
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All viewable</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>}
      <button className="primary">Apply</button>
    </form>

    <ErrorBox error={error} />
    <section className="feedShell" aria-label="Posts">
      {loading ? <p>Loading posts…</p> : posts.length
        ? <div className="threadGrid">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>
        : !error ? <div className="card">No posts match these filters.</div> : null}
      {pagination?.totalPages > 1 && <div className="pager">
        <button disabled={pagination.page <= 1} onClick={() => navigate(pagination.page - 1)}>Previous</button>
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        <button disabled={pagination.page >= pagination.totalPages} onClick={() => navigate(pagination.page + 1)}>Next</button>
      </div>}
    </section>
  </main>;
}
