import React, {useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,Icon,PostCard,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';
import {useInfiniteRecords,InfiniteScrollEnd} from '../InfiniteScroll.jsx';

export default function SavedPage(){
  const auth=useSelector(state=>state.auth);
  const {t,language}=usePreferences();
  const [sort,setSort]=useState('date');
  const [version,setVersion]=useState(0);

  useEffect(()=>{
    const refresh=()=>setVersion(value=>value+1);
    window.addEventListener('circle:saved-updated',refresh);
    window.addEventListener('circle:posts-updated',refresh);
    return()=>{
      window.removeEventListener('circle:saved-updated',refresh);
      window.removeEventListener('circle:posts-updated',refresh);
    };
  },[]);

  const {records:posts,loading,hasMore,error,loadMore,retry}=useInfiniteRecords({
    identity:(auth?.token||'')+'|'+sort+'|'+version,
    enabled:Boolean(auth?.token),
    request:(page,signal)=>{
      const q=new URLSearchParams({page:String(page),limit:'12',sort,order:'desc'});
      return api('/library/favorites?'+q,{token:auth.token,signal});
    },
  });

  if(!auth)return <main className="simpleFeaturePage">
    <h1>{t('Saved posts')}</h1>
    <p>{t('You must sign in to save posts.')}</p>
    <button className="primary" onClick={()=>go('/login')}>{t('Log in')}</button>
  </main>;

  return <main className="simpleFeaturePage">
    <div className="featureHeading"><Icon name="bookmark" size={26}/><h1>{t('Saved posts')}</h1></div>
    <p className="featureSubheading">{t('Your saved posts, all in one place.')}</p>
    <div className="featureTabs" role="group" aria-label="Saved post sorting">
      <button type="button" className={sort==='date'?'selectedTab':''}
        aria-pressed={sort==='date'} onClick={()=>setSort('date')}>{t('Recent')}</button>
      <button type="button" className={sort==='likes'?'selectedTab':''}
        aria-pressed={sort==='likes'} onClick={()=>setSort('likes')}>{t('Popular')}</button>
    </div>
    {!posts.length&&<ErrorBox error={error} onRetry={retry}/>}
    {loading&&!posts.length?<p className="featureEmpty">{t('Loading…')}</p>:
      posts.length?<div className="savedPostsList">
        {posts.map(post=><PostCard post={post} key={post.id}/>)}
      </div>:!error?<div className="featureEmpty">
        <Icon name="bookmarkBorder" size={33}/>
        <h2>{t('Nothing saved yet')}</h2>
        <p>{t('Save posts from the feed to find them here.')}</p>
        <button className="featureTextLink" onClick={()=>go('/')}>
          {t('Home')} <Icon name="arrow" size={18}/>
        </button>
      </div>:null}
    <InfiniteScrollEnd records={posts} loading={loading} hasMore={hasMore}
      error={error} loadMore={loadMore} retry={retry} language={language}/>
  </main>;
}
