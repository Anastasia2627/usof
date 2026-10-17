import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, PostCard, go } from '../ui.jsx';
import { usePreferences } from '../preferences.jsx';
import DatePicker from '../DatePicker.jsx';

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
  const filterRef=useRef(null);
  useEffect(()=>{
    const outside=event=>{if(filterRef.current?.open && !filterRef.current.contains(event.target))filterRef.current.open=false;};
    const escape=event=>{if(event.key==='Escape'&&filterRef.current?.open)filterRef.current.open=false;};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
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
    if(filterRef.current)filterRef.current.open=false;
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
  const today=new Date();
  const todayISO=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
  function choosePeriod(days){
    if(!days)return setFilters(f=>({...f,from:'',to:''}));
    const from=new Date(today.getFullYear(),today.getMonth(),today.getDate()-(days-1));
    const fromISO=[from.getFullYear(),String(from.getMonth()+1).padStart(2,'0'),String(from.getDate()).padStart(2,'0')].join('-');
    setFilters(f=>({...f,from:fromISO,to:todayISO}));
  }
  const canReset = activeFilters > 0 || Boolean(params.get('search')) ||
    Boolean(params.get('sort')) || Boolean(params.get('order'));

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
      <span>{t('Join the conversation')}</span>
      <button onClick={() => go('/login')}>{t('Log in')}</button>
    </div>}

    <div className="feedFilterStrip" aria-label="Filter conversations">
      <div className="feedTopicScroller" role="group" aria-label="Filter by topic">
        <button type="button" className={!params.get('category') ? 'topicActive' : ''}
          aria-pressed={!params.get('category')} onClick={() => chooseCategory('')}>{t('All')}</button>
        {categories.map(c => <button key={c.id} type="button"
          aria-pressed={String(params.get('category') || '') === String(c.id)}
          className={String(params.get('category') || '') === String(c.id) ? 'topicActive' : ''}
          onClick={() => chooseCategory(c.id)}>{t(c.title)}</button>)}
      </div>
      <details className="filterDetails" ref={filterRef}>
        <summary title={t('Filter posts')} aria-label="More filters">
          <Icon name="sliders" size={19}/>
          <span>{t('More')}</span>
          {activeFilters > 0 && <span className="activeFilterCount" aria-label={activeFilters + ' active filters'}>{activeFilters}</span>}
        </summary>
        <form className="filterBar" onSubmit={apply}>
          <div className="filterPanelTitle">
            <div><strong>{t('Filter posts')}</strong><small>{t('Filter settings')}</small></div>
            <button type="button" aria-label={t('Close filters')} title={t('Close filters')}
              onClick={()=>{if(filterRef.current)filterRef.current.open=false;}}>
              <Icon name="close" size={18}/></button>
          </div>
          <div className="filterPanelGrid">
            <label>{t('Sort by')}
              <span className="filterSelectWrap"><select value={filters.sort} onChange={e => setFilters({ ...filters, sort: e.target.value })}>
                <option value="likes">{t('Number of likes')}</option>
                <option value="date">{t('Publication date')}</option>
              </select><Icon name="chevron" size={16}/></span>
            </label>
            <label>{t('Direction')}
              <span className="filterSelectWrap"><select aria-label="Sort direction" value={filters.order} onChange={e => setFilters({ ...filters, order: e.target.value })}>
                <option value="desc">{t('Descending')}</option>
                <option value="asc">{t('Ascending')}</option>
              </select><Icon name="chevron" size={16}/></span>
            </label>
            <label>{t('Category')}
              <span className="filterSelectWrap"><select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
                <option value="">{t('All categories')}</option>
                {categories.map(c => <option key={c.id} value={c.id}>{t(c.title)}</option>)}
              </select><Icon name="chevron" size={16}/></span>
            </label>
            {auth && <label>{t('Status')}
              <span className="filterSelectWrap"><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                <option value="">{t('All viewable')}</option>
                <option value="active">{t('Active')}</option>
                <option value="inactive">{t('Inactive')}</option>
              </select><Icon name="chevron" size={16}/></span>
            </label>}
          </div>
          <div className="filterPanelHeading filterDateHeading">{t('Date range')} <small>{t('Optional')}</small></div>
          <div className="filterQuickPeriods" role="group" aria-label={t('Date range')}>
            {[{days:0,title:'Any time'},{days:7,title:'Last 7 days'},{days:30,title:'Last 30 days'}].map(option=>
              <button type="button" key={option.days}
                aria-pressed={option.days===0?!filters.from&&!filters.to:
                  filters.to===todayISO && filters.from===(() => {const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-(option.days-1));
                    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');})()}
                onClick={()=>choosePeriod(option.days)}>{t(option.title)}</button>)}
          </div>
          <div className="filterPanelDates">
            <div className="filterDateControl"><span>{t('From')}</span><DatePicker label={t('From')} value={filters.from} onChange={value=>setFilters(f=>({...f,from:value}))}/></div>
            <div className="filterDateControl"><span>{t('To')}</span><DatePicker label={t('To')} value={filters.to} onChange={value=>setFilters(f=>({...f,to:value}))}/></div>
          </div>
          <div className="filterPanelActions">
            <button className="resetFilters" type="button" onClick={() => { setFilters(readFilters(new URLSearchParams())); if(filterRef.current)filterRef.current.open=false;go(basePath); }}>{t('Clear all')}</button>
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
          : !error ? <div className="feedEmptyState" role="status">
              <span className="feedEmptyIcon"><Icon name="search" size={25}/></span>
              <h2>{t('No conversations found')}</h2>
              <p>{t('Try changing your filters or browse all discussions.')}</p>
              {canReset && <button className="feedEmptyReset" type="button"
                onClick={()=>go(basePath)}><Icon name="refresh" size={18}/>{t('Clear filters')}</button>}
            </div> : null}
      {pagination?.totalPages > 1 && <div className="pager">
        <button disabled={pagination.page <= 1} onClick={() => navigate(pagination.page - 1)}>{t('Previous')}</button>
        <span>{t('Page')} {pagination.page} {t('of')} {pagination.totalPages}</span>
        <button disabled={pagination.page >= pagination.totalPages} onClick={() => navigate(pagination.page + 1)}>{t('Next')}</button>
      </div>}
    </section>
  </main>;
}
