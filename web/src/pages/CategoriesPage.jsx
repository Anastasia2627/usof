import React,{useEffect,useMemo,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,PostCard,Icon,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';
import {useInfiniteRecords,InfiniteScrollEnd} from '../InfiniteScroll.jsx';

const photoLibrary=Array.from({length:12},(_,index)=>
  '/images/'+encodeURIComponent('Frame '+(2072750583+index)+'.png'));
const coverRules=[
  [/тварин|animal|pets?|соба|кот|cat|dog/i,0],
  [/кіно|фільм|movie|film|cinema|попкорн/i,1],
  [/вишив|craft|рукоділ|хобі|handmade/i,2],
  [/подорож|travel|природ|nature|мандр/i,3],
  [/мод|style|fashion|стиль|одяг/i,4],
  [/крас|beauty|догляд|flower|квіт/i,5],
  [/авіа|літак|plane|flight/i,6],
  [/мистец|art|творч|design|дизайн|малю/i,7],
  [/фітнес|спорт|fitness|sport|йог|gym/i,8],
  [/автомоб|машин|car|auto/i,9],
  [/книг|book|літера|читан/i,10],
  [/робот|кар'єр|career|work|business|бізнес/i,11],
  [/музик|music|anime|аніме/i,2],
];
const coverFor=(category,index)=>{
  const label=String(category?.title||'');
  const photoIndex=coverRules.find(([pattern])=>pattern.test(label))?.[1]??index%photoLibrary.length;
  return photoLibrary[photoIndex];
};

export default function CategoriesPage(){
  const auth=useSelector(state=>state.auth);
  const {t,language}=usePreferences();
  const uk=language==='uk';
  const [categories,setCategories]=useState([]);
  const [selected,setSelected]=useState([]);
  const [query,setQuery]=useState('');
  const [slide,setSlide]=useState(0);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);

  useEffect(()=>{
    const controller=new AbortController();
    const load=async()=>{
      setLoading(true);
      try{
        const [all,interests]=await Promise.all([
          api('/categories',{signal:controller.signal}),
          auth?.token
            ?api('/social/interests',{token:auth.token,signal:controller.signal})
            :Promise.resolve({data:[]})
        ]);
        if(controller.signal.aborted)return;
        setCategories(Array.isArray(all?.data)?all.data:[]);
        setSelected(Array.isArray(interests?.data)?
          interests.data.map(Number).filter(Number.isInteger):[]);
        setError(null);
      }catch(err){
        if(!controller.signal.aborted&&err.name!=='AbortError')setError(err);
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    };
    load();
    const reload=()=>{if(!controller.signal.aborted)load();};
    window.addEventListener('circle:categories-updated',reload);
    return()=>{
      controller.abort();
      window.removeEventListener('circle:categories-updated',reload);
    };
  },[auth?.token]);

  const visual=useMemo(()=>[...categories].sort((a,b)=>{
    const indexA=coverRules.findIndex(([pattern])=>pattern.test(a.title||''));
    const indexB=coverRules.findIndex(([pattern])=>pattern.test(b.title||''));
    return (indexA<0?100:indexA)-(indexB<0?100:indexB)||
      Number(b.post_count||0)-Number(a.post_count||0);
  }),[categories]);

  const cards=useMemo(()=>{
    const length=Math.min(7,visual.length);
    return Array.from({length},(_,index)=>visual[(slide+index)%visual.length]);
  },[visual,slide]);

  const results=useMemo(()=>{
    const search=query.trim().toLocaleLowerCase();
    return categories.filter(category=>!search||
      (String(category.title)+' '+t(category.title)+' '+String(category.description||''))
        .toLocaleLowerCase().includes(search));
  },[categories,query,t]);

  const toggle=id=>{
    if(!auth?.token){go('/login');return;}
    const number=Number(id);
    setSelected(previous=>previous.includes(number)
      ?previous.filter(value=>value!==number):[...previous,number]);
  };

  const save=async()=>{
    if(!auth?.token){go('/login');return;}
    if(loading||saving)return;
    setSaving(true);
    setError(null);
    try{
      await api('/social/interests',{
        token:auth.token,
        method:'PUT',
        body:{categories:selected}
      });
      window.dispatchEvent(new Event('circle:interests-updated'));
      go('/');
    }catch(err){
      setError(err);
    }finally{
      setSaving(false);
    }
  };

  const move=direction=>setSlide(old=>visual.length?
    (old+direction+visual.length)%visual.length:0);

  return <main className="categoriesPage categoryReferencePage">
    <section className="categoryReferenceHero" aria-labelledby="category-reference-heading">
      <h1 id="category-reference-heading">
        {uk?<>Знайди свою<br/>тему</>:<>Find your<br/>thing</>}
      </h1>

      <div className="categoryReferenceCollage" role="group"
        aria-label={uk?'Обрати тему на фото':'Choose an interest from the photos'}>
        {cards.map((category,index)=>{
          const distance=index-(cards.length-1)/2;
          const chosen=selected.includes(Number(category.id));
          return <button type="button" key={category.id}
            className={'categoryReferencePhoto'+(Math.abs(distance)>2?' isOuter':'')+(chosen?' isSelected':'')}
            style={{
              '--photo-x':(distance*108)+'px',
              '--photo-y':(distance*distance*9)+'px',
              '--photo-angle':(distance*5)+'deg',
              '--photo-x-tablet':(distance*79)+'px',
              '--photo-x-phone':(distance*48)+'px',
              '--photo-y-phone':(distance*distance*5)+'px',
              '--photo-layer':String(20-Math.abs(distance))
            }}
            onClick={()=>toggle(category.id)}
            aria-pressed={chosen}
            aria-label={(chosen?(uk?'Зняти вибір: ':'Deselect: '):(uk?'Обрати: ':'Select: '))+t(category.title)}>
            <img src={coverFor(category,index)} alt="" loading="eager" decoding="async"/>
            <span className="categoryReferencePhotoCheck" aria-hidden="true">
              <Icon name={chosen?'check':'plusSimple'} size={17}/>
            </span>
            {(index===1||index===cards.length-2)&&
              <span className={'categoryReferencePhotoLabel'+(index===1?' labelBlue':' labelGreen')}>
                {t(category.title)}
              </span>}
          </button>;
        })}
        {loading&&<span className="categoryReferenceLoad" role="status">
          {uk?'Завантажуємо теми…':'Loading topics…'}
        </span>}
        {!loading&&!cards.length&&<span className="categoryReferenceLoad">
          {uk?'Поки немає тем':'No topics yet'}
        </span>}
      </div>

      <div className="categoryReferenceCaption">
        <button type="button" onClick={()=>move(-1)} disabled={cards.length<2}
          aria-label={uk?'Попередні теми':'Previous topics'}>
          <Icon name="arrowBack" size={18}/>
        </button>
        <span>{uk?'Обирай те, що подобається — і ми підлаштуємо твою стрічку':
          'Choose what you love and make the feed your own'}</span>
        <button type="button" onClick={()=>move(1)} disabled={cards.length<2}
          aria-label={uk?'Наступні теми':'Next topics'}>
          <Icon name="arrow" size={18}/>
        </button>
      </div>

      <div className="categoryReferenceHeroActions">
        <button type="button" className="categoryReferencePrimary"
          onClick={save} disabled={loading||saving}>
          {saving?(uk?'Зберігаємо…':'Saving…'):(uk?'Продовжити':'Continue')}
          <Icon name="arrow" size={16}/>
        </button>
        <button type="button" className="categoryReferenceSkip" onClick={()=>go('/')}
          disabled={saving}>{uk?'Пропустити':'Skip for now'}</button>
      </div>
    </section>

    <section className="categoryReferenceTopics" aria-labelledby="category-topics-label">
      <div className="categoryReferenceTopicsHead">
        <div className="categoryReferenceTitleRow">
          <h2 id="category-topics-label">{uk?'Теми':'Topics'}</h2>
          <span>{selected.length?selected.length+' '+(uk?'обрано':'selected'):''}</span>
        </div>
        <label className="categoryReferenceSearch">
          <Icon name="search" size={18}/>
          <input type="search" value={query}
            placeholder={uk?'Пошук тем':'Search topics'}
            aria-label={uk?'Пошук тем':'Search topics'}
            onChange={event=>setQuery(event.target.value)}/>
          {query&&<button type="button" onClick={()=>setQuery('')}
            aria-label={uk?'Очистити пошук':'Clear search'}>
            <Icon name="close" size={15}/>
          </button>}
        </label>
      </div>

      <div className="categoryReferencePills" role="group"
        aria-label={uk?'Вибір тем':'Topic selection'}>
        {results.map(category=>{
          const chosen=selected.includes(Number(category.id));
          return <button type="button" key={category.id}
            className={'categoryReferencePill'+(chosen?' isSelected':'')}
            aria-pressed={chosen} onClick={()=>toggle(category.id)}>
            <span>{t(category.title)}</span>
            <Icon name={chosen?'check':'plusSimple'} size={17}/>
          </button>;
        })}
        {!loading&&!results.length&&<span className="categoryReferenceEmpty">
          {uk?'Нічого не знайдено':'No matching topics'}
        </span>}
      </div>

      <ErrorBox error={error}/>
    </section>
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

  return <main className="categoryDetailPage categoryEditorialDetail">
    <header className="categoryDetailHeader">
      <button type="button" className="categoryBack" onClick={()=>go('/categories')}
        aria-label={t('All categories')} title={t('All categories')}>
        <Icon name="arrowBack" size={21}/>
      </button>
      <h1>{t(category?.title||'Category')}</h1>
    </header>
    {category?.description&&category.description.trim()!==category.title.trim()&&
      <p className="categoryDetailDescription">{t(category.description)}</p>}
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
