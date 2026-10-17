import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, Icon, PostCard, go } from '../ui.jsx';
import { usePreferences } from '../preferences.jsx';

export default function SavedPage() {
  const auth = useSelector(state => state.auth);
  const { t } = usePreferences();
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('date');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const changed = () => setVersion(value => value + 1);
    window.addEventListener('circle:saved-updated', changed);
    window.addEventListener('circle:posts-updated', changed);
    return () => { window.removeEventListener('circle:saved-updated', changed);
      window.removeEventListener('circle:posts-updated', changed); };
  }, []);

  useEffect(() => {
    if (!auth?.token) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ page:String(page),limit:'8',sort,order:'desc' });
    api('/library/favorites?' + q, { token: auth.token })
      .then(result => {
        if (!live) return;
        setPosts(result.data);
        setPagination(result.pagination);
        if (page > 1 && !result.data.length) setPage(value => Math.max(1,value - 1));
      }).catch(e => { if (live) setError(e); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [auth?.token,page,sort,version]);

  if (!auth) return <main className="simpleFeaturePage">
    <h1>{t('Saved posts')}</h1>
    <p>{t('You must sign in to save posts.')}</p>
    <button className="primary" onClick={() => go('/login')}>{t('Log in')}</button>
  </main>;

  return <main className="simpleFeaturePage">
    <div className="featureHeading"><Icon name="bookmark" size={26}/><h1>{t('Saved posts')}</h1></div>
    <p className="featureSubheading">{t('Your saved posts, all in one place.')}</p>
    <div className="featureTabs" role="group" aria-label="Saved post sorting">
      <button type="button" className={sort === 'date' ? 'selectedTab' : ''}
        aria-pressed={sort === 'date'} onClick={() => {setSort('date');setPage(1);}}>{t('Recent')}</button>
      <button type="button" className={sort === 'likes' ? 'selectedTab' : ''}
        aria-pressed={sort === 'likes'} onClick={() => {setSort('likes');setPage(1);}}>{t('Popular')}</button>
    </div>
    <ErrorBox error={error} onRetry={() => setVersion(value => value + 1)}/>
    {loading ? <p className="featureEmpty">{t('Loading…')}</p>
      : posts.length ? <div className="savedPostsList">{posts.map(post => <PostCard post={post} key={post.id}/>)}</div>
      : !error ? <div className="featureEmpty"><Icon name="bookmarkBorder" size={33}/>
        <h2>{t('Nothing saved yet')}</h2>
        <p>{t('Save posts from the feed to find them here.')}</p>
        <button className="featureTextLink" onClick={() => go('/')}>{t('Home')} <Icon name="arrow" size={18}/></button>
      </div> : null}
    {pagination?.totalPages > 1 && <nav className="pager" aria-label="Saved pages">
      <button disabled={page<=1} onClick={() => setPage(v=>v-1)}>{t('Previous')}</button>
      <span>{t('Page')} {page} {t('of')} {pagination.totalPages}</span>
      <button disabled={page>=pagination.totalPages} onClick={() => setPage(v=>v+1)}>{t('Next')}</button>
    </nav>}
  </main>;
}
