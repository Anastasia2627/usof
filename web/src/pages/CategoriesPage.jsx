import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, PostCard, Icon, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';
import SuggestTopic from '../SuggestTopic.jsx';
import { useInfiniteRecords, InfiniteScrollEnd } from '../InfiniteScroll.jsx';

export default function CategoriesPage() {
  const {t}=usePreferences();
  const [categories, setCategories] = useState([]);
  const [query,setQuery]=useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active=true;
    const refresh=()=>api('/categories').then(result=>{if(active)setCategories(result.data);})
      .catch(err=>{if(active)setError(err);})
      .finally(()=>{if(active)setLoading(false);});
    refresh();
    window.addEventListener('circle:categories-updated',refresh);
    return()=>{active=false;window.removeEventListener('circle:categories-updated',refresh);};
  }, []);

  const found=categories.filter(category=>[category.title,t(category.title),category.description||'',t(category.description||'')]
    .some(value=>String(value).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())));
  return <main className="categoriesPage">
    <p className="eyebrow">{t('Browse posts by topic')}</p>
    <h1>{t('Categories')}</h1>
    <div className="topicSearchField categorySearchField">
      <Icon name="search" size={19}/>
      <input type="search" aria-label={t('Search topics')} placeholder={t('Search topics')}
        value={query} onChange={event=>setQuery(event.target.value)}/>
      {query&&<button type="button" aria-label={t('Clear search')} title={t('Clear search')}
        onClick={()=>setQuery('')}><Icon name="close" size={17}/></button>}
    </div>
    <SuggestTopic/>
    <ErrorBox error={error} />
    {loading
      ? <div className="card loading">{t('Loading categories…')}</div>
      : found.length
        ? <section className="categoryGrid">{found.map((category) => <button className="card categoryCard" key={category.id} onClick={() => go(`/category/${category.id}`)}><span className="categoryIndex">{String(category.id).padStart(2, '0')}</span><h2>{t(category.title)}</h2><p>{t(category.description)}</p></button>)}</section>
        :
          <div className="topicsEmpty">
            <p>{t(query?'No matching topics':'No categories yet.')}</p>
            {query&&<button type="button" onClick={()=>setQuery('')}>{t('Clear search')}</button>}
          </div>}
  </main>;
}

export function CategoryDetailPage({id}){
  const {t,language}=usePreferences();
  const auth=useSelector(state=>state.auth);
  const [category,setCategory]=useState(null);
  const [categoryError,setCategoryError]=useState(null);
  const [categoryLoading,setCategoryLoading]=useState(true);
  const {records:posts,loading,hasMore,error,loadMore,retry}=useInfiniteRecords({
    identity:String(id)+'|'+(auth?.token||''),
    request:(page,signal)=>{
      const query=new URLSearchParams({
        category:String(id),page:String(page),limit:'12',sort:'date',order:'desc',
      });
      return api('/posts?'+query,{token:auth?.token,signal});
    },
  });

  useEffect(()=>{
    const controller=new AbortController();
    setCategoryLoading(true);setCategoryError(null);
    api('/categories/'+id,{signal:controller.signal})
      .then(result=>{if(!controller.signal.aborted)setCategory(result.data);})
      .catch(err=>{if(err.name!=='AbortError')setCategoryError(err);})
      .finally(()=>{if(!controller.signal.aborted)setCategoryLoading(false);});
    return()=>controller.abort();
  },[id]);

  return <main className="categoryDetailPage">
    <button className="linkButton" onClick={()=>go('/categories')}>
      <Icon name="arrowBack" size={17}/> {t('All categories')}
    </button>
    <section className="hero categoryHero">
      <p className="eyebrow">{t('Category')} {String(id).padStart(2,'0')}</p>
      <h1>{t(category?.title||'Category')}</h1>
      {category?.description&&<p>{t(category.description)}</p>}
    </section>
    <ErrorBox error={categoryError||(!posts.length?error:null)} onRetry={retry}/>
    {categoryLoading || (loading&&!posts.length)
      ? <div className="card loading">{t('Loading category…')}</div>
      :posts.length?<section className="postList">{posts.map(post=><PostCard key={post.id} post={post}/>)}</section>
      : !error&&!categoryError?<div className="card empty">
          <h2>{t('No posts here yet')}</h2>
          <p>{t('Choose another topic or start the conversation.')}</p>
        </div>:null}
    <InfiniteScrollEnd records={posts} loading={loading} hasMore={hasMore}
      error={error} loadMore={loadMore} retry={retry} language={language}/>
  </main>;
}
