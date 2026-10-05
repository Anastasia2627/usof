import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { ErrorBox, Icon, PostCard, go } from '../ui.jsx';

function todayIso() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export default function HomePage({ hash }) {
  const auth = useSelector((state) => state.auth);
  const { t } = useI18n();
  const params = useMemo(() => new URLSearchParams(hash.split('?')[1] || ''), [hash]);
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  function applyFeed(mode) {
    const query = new URLSearchParams(params);
    query.delete('page');
    query.delete('from');
    query.delete('to');

    if (mode === 'latest' || mode === 'for-you') query.set('sort', 'date');
    if (mode === 'popular') query.set('sort', 'likes');
    if (mode === 'evening') {
      query.set('sort', 'trending');
      query.set('from', todayIso());
    }
    go(`/?${query}`);
  }

  function feedMode() {
    if (params.get('sort') === 'likes') return 'popular';
    if (params.get('sort') === 'trending' && params.get('from') === todayIso()) return 'evening';
    return auth ? 'for-you' : 'latest';
  }

  function page(number) {
    const query = new URLSearchParams(params);
    query.set('page', String(number));
    go(`/?${query}`);
  }

  const featured = posts[0];
  const rest = posts.slice(1);

  return <main className="homePage">
    <section className="circleHero">
      <div className="heroCopy">
        
        <h1>{t('heroTitle')}</h1>
        <p className="heroBody">{t('heroBody')}</p>
        <div className="heroActions">
          <button className="primary" onClick={() => go(auth ? '/create' : '/register')}>
            {auth ? t('startThread') : 'Join the circle'} <Icon name="arrow_forward" />
          </button>
          <button className="textAction" onClick={() => go('/categories')}>Explore what’s happening <Icon name="north_east" /></button>
        </div>
      </div>

      <div className="heroConversation" aria-hidden="true">
        <div className="heroNote heroNote-one">
          <span className="noteDot violet" />
          <small>today · 18:42</small>
          <strong>“I thought I was the only one”</strong>
        </div>
        <div className="heroNote heroNote-two">
          <span className="noteDot cream" />
          <small>12 people joined</small>
          <strong>what changed your mind lately?</strong>
        </div>
        <div className="heroNote heroNote-three">
          <Icon name="forum" filled />
          <strong>conversation &gt; content</strong>
        </div>
        <div className="heroOrbit orbit-one" />
        <div className="heroOrbit orbit-two" />
      </div>
    </section>

    {params.get('search') && <section className="searchResultBanner">
      <span><Icon name="search" /> Results for <strong>“{params.get('search')}”</strong></span>
      <button className="linkButton" onClick={() => go('/')}>Clear search</button>
    </section>}

    <section className="feedShell">
      <div className="feedHeader">
        <div>
          
          <h2>Pull up a seat</h2>
        </div>
        <button className={`filterToggle ${filtersOpen ? 'active' : ''}`} onClick={() => setFiltersOpen((value) => !value)}>
          <Icon name="tune" /> {t('filters')}
        </button>
      </div>

      <div className="feedTabs" role="tablist" aria-label="Feed sorting">
        <button className={feedMode() === 'for-you' ? 'active' : ''} onClick={() => applyFeed('for-you')}>{t('forYou')}</button>
        <button className={feedMode() === 'latest' ? 'active' : ''} onClick={() => applyFeed('latest')}>{t('latest')}</button>
        <button className={feedMode() === 'popular' ? 'active' : ''} onClick={() => applyFeed('popular')}>{t('popular')}</button>
        <button className={feedMode() === 'evening' ? 'active' : ''} onClick={() => applyFeed('evening')}><Icon name="dark_mode" /> {t('evening')}</button>
      </div>

      {filtersOpen && <form className="advancedFilters" onSubmit={applyFilters}>
        <label>Sort
          <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
            <option value="date">Newest</option>
            <option value="likes">Most liked</option>
            <option value="trending">Trending</option>
          </select>
        </label>
        <label>Topic
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">{t('allTopics')}</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
        <label>To<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
        {auth && <label>Status
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All viewable</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>}
        <button className="secondary">{t('apply')} <Icon name="arrow_forward" /></button>
      </form>}

      <ErrorBox error={error} />

      {loading ? <div className="feedLoading">
        <span /><span /><span />
        <p>Listening for conversations…</p>
      </div> : posts.length ? <>
        {featured && <PostCard post={featured} featured interactive={Boolean(auth)} />}
        {rest.length > 0 && <section className="threadGrid">{rest.map((post) => <PostCard key={post.id} post={post} interactive={Boolean(auth)} />)}</section>}
      </> : <div className="emptyState">
        <span className="emptyGlyph"><Icon name="chair" /></span>
        <h2>{t('noThreads')}</h2>
        <p>{t('noThreadsBody')}</p>
        <button className="primary" onClick={() => go(auth ? '/create' : '/register')}>{auth ? t('startThread') : t('signup')}</button>
      </div>}

      {pagination && pagination.totalPages > 1 && <div className="pager">
        <button disabled={pagination.page <= 1} onClick={() => page(pagination.page - 1)}><Icon name="arrow_back" /> Previous</button>
        <span>{pagination.page} / {pagination.totalPages}</span>
        <button disabled={pagination.page >= pagination.totalPages} onClick={() => page(pagination.page + 1)}>Next <Icon name="arrow_forward" /></button>
      </div>}
    </section>
  </main>;
}
