import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, PostCard, go } from '../ui.jsx';

const FILTERS = ['sort', 'order', 'category', 'from', 'to', 'status'];
const readFilters = params => ({
  sort: params.get('sort') || 'likes',
  order: params.get('order') || 'desc',
  category: params.get('category') || '',
  from: params.get('from') || '',
  to: params.get('to') || '',
  status: params.get('status') || '',
});

export default function HomePage({ hash, basePath = '/' }) {
  const auth = useSelector(state => state.auth);
  const params = useMemo(() => new URLSearchParams(hash.split('?')[1] || ''), [hash]);
  const [filters, setFilters] = useState(() => readFilters(params));
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api('/categories', { signal: controller.signal })
      .then(result => setCategories(result.data))
      .catch(err => { if (err.name !== 'AbortError') setError(err); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    setFilters(readFilters(params));
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
      .then(result => {
        if (!controller.signal.aborted) {
          setPosts(result.data);
          setPagination(result.pagination);
        }
      })
      .catch(err => { if (err.name !== 'AbortError') setError(err); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [hash, auth?.token, retry]);

  function apply(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const name of FILTERS) {
      if (filters[name]) query.set(name, filters[name]);
    }
    go(query.size ? basePath + '?' + query : basePath);
  }

  function changeSort(sort, order) {
    const query = new URLSearchParams(params);
    query.set('sort', sort);
    query.set('order', order);
    query.delete('page');
    go(basePath + '?' + query);
  }

  function navigate(page) {
    const query = new URLSearchParams(params);
    query.set('page', String(page));
    go(basePath + '?' + query);
  }

  const popular = (params.get('sort') || 'likes') === 'likes' && (params.get('order') || 'desc') === 'desc';
  const latest = params.get('sort') === 'date' && (params.get('order') || 'desc') === 'desc';

  return <main className="homePage">
    <h1 className="feedPageTitle">{basePath === '/explore' ? 'Explore' : 'Home'}</h1>
    <div className="feedTabs" role="group" aria-label="Feed views">
      <button aria-pressed={popular} className={popular ? 'selectedTab' : ''} onClick={() => changeSort('likes', 'desc')}>For you</button>
      <button aria-pressed={latest} className={latest ? 'selectedTab' : ''} onClick={() => changeSort('date', 'desc')}>Latest</button>
    </div>

    {auth ? <button className="feedComposer" onClick={() => go('/create')}>
      <Avatar user={auth.user} size="md"/>
      <span>What's new?</span>
      <strong>Post</strong>
    </button> : <div className="feedComposer guestComposer">
      <span className="guestAvatar"><Icon name="user" size={21}/></span>
      <span>Join the conversation</span>
      <button onClick={() => go('/login')}>Log in</button>
    </div>}

    <details className="filterDetails">
      <summary><Icon name="sliders" size={18}/> Filters and sorting</summary>
      <form className="filterBar" onSubmit={apply}>
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
        <button className="primary applyFilters" type="submit">Apply filters</button>
        <button type="button" onClick={() => { setFilters(readFilters(new URLSearchParams())); go(basePath); }}>Reset</button>
      </form>
    </details>

    <ErrorBox error={error} onRetry={() => setRetry(value => value + 1)} />
    <section className="feedShell" aria-label="Posts">
      {loading ? <p className="feedMessage">Loading conversations…</p>
        : posts.length
          ? <div className="threadGrid">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>
          : !error ? <div className="feedMessage">No conversations found. Try changing your filters.</div> : null}
      {pagination?.totalPages > 1 && <div className="pager">
        <button disabled={pagination.page <= 1} onClick={() => navigate(pagination.page - 1)}>Previous</button>
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        <button disabled={pagination.page >= pagination.totalPages} onClick={() => navigate(pagination.page + 1)}>Next</button>
      </div>}
    </section>
  </main>;
}
