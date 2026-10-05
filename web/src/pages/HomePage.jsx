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
    api('/posts?' + query, { token: auth?.token, signal: controller.signal })
      .then((result) => {
        setPosts(result.data);
        setPagination(result.pagination);
      })
      .catch((err) => { if (err.name !== 'AbortError') setError(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [hash, auth?.token]);

  const activeFilterCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => key !== 'sort' && Boolean(value)).length,
    [filters],
  );

  const heroTopics = categories.slice(0, 4);

  function applyFilters(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    const search = params.get('search');
    if (search) query.set('search', search);
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    go(query.size ? '/?' + query : '/');
  }

  function clearFilters() {
    const query = new URLSearchParams();
    const search = params.get('search');
    if (search) query.set('search', search);
    go(query.size ? '/?' + query : '/');
  }

  function page(number) {
    const query = new URLSearchParams(params);
    query.set('page', String(number));
    go('/?' + query);
  }

  const feedTitle = filters.sort === 'trending'
    ? 'Trending now'
    : filters.sort === 'likes'
      ? 'Top questions'
      : 'Latest questions';

  return <main className="homePage">
    <section className="heroPanel">
      <div className="heroGlow" aria-hidden="true" />
      <div className="heroCopy">
        <p className="eyebrow">USOF / developer exchange</p>
        <h1>Good questions deserve better answers.</h1>
        <p className="heroLead">A focused place for programming problems, useful context and answers worth coming back to.</p>
        <div className="heroActions">
          <button className="primary heroPrimary" onClick={() => go(auth ? '/create' : '/register')}>
            {auth ? 'Ask a question' : 'Join the community'}
            <span aria-hidden="true">↗</span>
          </button>
          <button className="secondary heroSecondary" onClick={() => go('/categories')}>Browse categories</button>
        </div>
        <div className="heroMeta">
          <span><b>{pagination?.total ?? '—'}</b> questions</span>
          <span><b>{categories.length || '—'}</b> categories</span>
          <span>Built for useful discussion</span>
        </div>
      </div>

      <div className="topicDeck" aria-label="Popular categories">
        <div className="topicDeckBack" aria-hidden="true" />
        {heroTopics.slice(0, 3).map((category, index) => <button
          key={category.id}
          className={'topicCard topicCard-' + index}
          onClick={() => go('/category/' + category.id)}
        >
          <span className="topicIndex">0{index + 1}</span>
          <strong>{category.title}</strong>
          <small>{category.description || 'Open discussions'}</small>
          <span className="topicArrow">↗</span>
        </button>)}
        {!heroTopics.length && <div className="topicCard topicCard-0 topicSkeleton"><span /><span /><span /></div>}
      </div>
    </section>

    {params.get('search') && <div className="searchResultBar">
      <span>Search results for <b>“{params.get('search')}”</b></span>
      <button className="quietButton" onClick={() => go('/')}>Clear search</button>
    </div>}

    <div className="homeGrid">
      <aside className="filterColumn">
        <form className="filterPanel card" onSubmit={applyFilters}>
          <div className="filterTitle">
            <div>
              <p className="eyebrow">Feed controls</p>
              <h2>Filters</h2>
            </div>
            {activeFilterCount > 0 && <span className="filterCount">{activeFilterCount}</span>}
          </div>

          <label>Sort by<select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option value="date">Newest</option>
            <option value="likes">Most liked</option>
            <option value="trending">Trending</option>
          </select></label>

          <label>Category<select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select></label>

          <div className="dateFields">
            <label>From<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
            <label>To<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          </div>

          {auth && <label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All viewable</option>
            <option value="active">Active</option>
            <option value="inactive">My inactive{auth.user.role === 'admin' ? ' / all inactive' : ''}</option>
          </select></label>}

          <div className="filterActions">
            <button className="primary">Apply filters</button>
            <button type="button" className="quietButton" onClick={clearFilters}>Reset</button>
          </div>
        </form>
      </aside>

      <section className="feedColumn">
        <div className="feedHeader">
          <div>
            <p className="eyebrow">Community feed</p>
            <h2>{feedTitle}</h2>
          </div>
          {pagination && <span className="resultCount">{pagination.total} total</span>}
        </div>

        <ErrorBox error={error} />
        {loading
          ? <div className="card loading feedLoading"><span className="loadingPulse" />Loading questions…</div>
          : posts.length
            ? <section className="postList">{posts.map((post) => <PostCard key={post.id} post={post} />)}</section>
            : <div className="card empty"><h2>No questions found</h2><p>Try another filter combination or start a new discussion.</p></div>}

        {pagination && pagination.totalPages > 1 && <div className="pager">
          <button disabled={pagination.page <= 1} onClick={() => page(pagination.page - 1)}>← Previous</button>
          <span>Page <b>{pagination.page}</b> / {pagination.totalPages}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => page(pagination.page + 1)}>Next →</button>
        </div>}
      </section>
    </div>
  </main>;
}
