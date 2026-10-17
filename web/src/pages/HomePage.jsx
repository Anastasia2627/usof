import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, PostCard, go } from '../ui.jsx';
import { usePreferences } from '../preferences.jsx';

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
  const {t} = usePreferences();
  const params = useMemo(() => new URLSearchParams(hash.split('?')[1] || ''), [hash]);
  const [filters, setFilters] = useState(() => readFilters(params));
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = () => setRetry(value => value + 1);
    window.addEventListener('circle:posts-updated',refresh);
    return () => window.removeEventListener('circle:posts-updated',refresh);
  }, []);


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
    const query = new URLSearchParams(params);
    for (const name of FILTERS) {
      if (filters[name]) query.set(name, filters[name]);
      else query.delete(name);
    }
    query.delete('page');
    go(query.size ? basePath + '?' + query : basePath);
  }

  function chooseCategory(categoryId) {
    const query = new URLSearchParams(params);
    if (categoryId) query.set('category', String(categoryId));
    else query.delete('category');
    query.delete('page');
    setFilters(current => ({ ...current, category: String(categoryId) }));
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
  const activeFilters = ['category', 'from', 'to', 'status'].filter(key => Boolean(params.get(key))).length;

  return <main className="homePage">
    <h1 className="feedPageTitle">{t(basePath === '/explore' ? 'Explore' : 'Home')}</h1>
    <div className="feedTabs" role="group" aria-label="Feed views">
      <button aria-pressed={popular} className={popular ? 'selectedTab' : ''} onClick={() => changeSort('likes', 'desc')}>{t('Popular')}</button>
      <button aria-pressed={latest} className={latest ? 'selectedTab' : ''} onClick={() => changeSort('date', 'desc')}>{t('Latest')}</button>
    </div>

    {auth ? <button className="feedComposer" onClick={() => go('/create')}>
      <Avatar user={auth.user} size="md"/>
      <span>{t("What's on your mind?")}</span>
      <strong>{t('Post')}</strong>
    </button> : <div className="feedComposer guestComposer">
      <span className="guestAvatar"><Icon name="user" size={21}/></span>
      <span>Join the conversation</span>
      <button onClick={() => go('/login')}>{t('Log in')}</button>
    </div>}

    <div className="feedFilterStrip" aria-label="Filter conversations">
      <div className="feedTopicScroller" role="group" aria-label="Filter by topic">
        <button type="button" className={!params.get('category') ? 'topicActive' : ''}
          aria-pressed={!params.get('category')} onClick={() => chooseCategory('')}>{t('All')}</button>
        {categories.map(c => <button key={c.id} type="button"
          aria-pressed={String(params.get('category') || '') === String(c.id)}
          className={String(params.get('category') || '') === String(c.id) ? 'topicActive' : ''}
          onClick={() => chooseCategory(c.id)}>{c.title}</button>)}
      </div>
      <details className="filterDetails">
        <summary title="More filters" aria-label="More filters">
          <Icon name="sliders" size={19}/>
          <span>{t('More')}</span>
          {activeFilters > 0 && <span className="activeFilterCount" aria-label={activeFilters + ' active filters'}>{activeFilters}</span>}
        </summary>
        <form className="filterBar" onSubmit={apply}>
          <div className="filterPanelHeading">{t('Fine-tune your feed')}</div>
          <div className="filterPanelGrid">
            <label>{t('Sort by')}
              <select value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value })}>
                <option value="likes">{t('Number of likes')}</option>
                <option value="date">{t('Publication date')}</option>
              </select>
            </label>
            <label>{t('Direction')}
              <select aria-label="Sort direction" value={filters.order} onChange={e => setFilters({ ...filters, order: e.target.value })}>
                <option value="desc">{t('Descending')}</option>
                <option value="asc">{t('Ascending')}</option>
              </select>
            </label>
            <label>{t('Category')}
              <select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
                <option value="">{t('All categories')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>
            {auth && <label>{t('Status')}
              <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                <option value="">{t('All viewable')}</option>
                <option value="active">{t('Active')}</option>
                <option value="inactive">{t('Inactive')}</option>
              </select>
            </label>}
          </div>
          <div className="filterPanelHeading filterDateHeading">{t('Date range')} <small>{t('Optional')}</small></div>
          <div className="filterPanelDates">
            <label>{t('From')}<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
            <label>{t('To')}<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
          </div>
          <div className="filterPanelActions">
            <button className="resetFilters" type="button" onClick={() => { setFilters(readFilters(new URLSearchParams())); go(basePath); }}>{t('Clear all')}</button>
            <button className="primary applyFilters" type="submit" aria-label="Apply filters"><Icon name="check" size={18}/><span>{t('Apply')}</span></button>
          </div>
        </form>
      </details>
    </div>

    <ErrorBox error={error} onRetry={() => setRetry(value => value + 1)} />
    <section className="feedShell" aria-label="Posts">
      {loading ? <p className="feedMessage">{t('Loading conversations…')}</p>
        : posts.length
          ? <div className="threadGrid">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>
          : !error ? <div className="feedMessage">{t("No conversations found. Try changing your filters.")}</div> : null}
      {pagination?.totalPages > 1 && <div className="pager">
        <button disabled={pagination.page <= 1} onClick={() => navigate(pagination.page - 1)}>{t('Previous')}</button>
        <span>{t('Page')} {pagination.page} {t('of')} {pagination.totalPages}</span>
        <button disabled={pagination.page >= pagination.totalPages} onClick={() => navigate(pagination.page + 1)}>{t('Next')}</button>
      </div>}
    </section>
  </main>;
}
