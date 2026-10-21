import React,{useEffect,useMemo,useRef,useState} from 'react';
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
  const orbitRef=useRef(null);
  const orbitPaused=useRef(false);
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

  const cards=useMemo(()=>visual.slice(0,Math.min(7,visual.length)),[visual]);

  useEffect(()=>{
    if(!cards.length||!orbitRef.current)return undefined;
    const element=orbitRef.current;
    const tiles=Array.from(element.querySelectorAll('.categoryReferencePhoto'));
    if(!tiles.length)return undefined;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame=0;
    let visible=true;
    let elapsed=0;
    let last=0;
    let radius=340;
    let arcHeight=105;
    let baseY=118;
    const measure=()=>{
      const width=element.clientWidth;
      radius=Math.min(365,Math.max(95,(width-185)*.47));
      arcHeight=width<620?69:width<850?90:105;
      baseY=width<620?79:width<850?104:119;
    };
    // Each card travels across the same upper semicircle from left to right
    // The short invisible return connects both ends without a visible jump
    // This keeps approximately six cards visible instead of a rotating oval
    const position=()=>{
      tiles.forEach((tile,index)=>{
        if(tiles.length===1){
          tile.style.transform='translate3d(-50%,14px,0)';
          tile.style.opacity='1';
          tile.style.zIndex='20';
          return;
        }
        const phase=((index/tiles.length)+elapsed/52000)%1;
        const travel=.86;
        const reduced=motion.matches;
        const onArc=reduced||phase<travel;
        const u=reduced?index/(tiles.length-1):onArc?phase/travel:(phase-travel)/(1-travel);
        const x=onArc?radius*(2*u-1):radius*(1-2*u);
        const height=Math.sin(Math.PI*u);
        const y=onArc?baseY-arcHeight*height:baseY+23*height;
        const rotate=onArc?(u-.5)*13:0;
        const scale=onArc?.94+.06*height:.94;
        // Fully faded before the turn-around, visible through the main arc
        const opacity=reduced?1:onArc?Math.min(1,u/.065,(1-u)/.065):0;
        tile.style.transform=`translate3d(calc(-50% + ${x.toFixed(2)}px),${y.toFixed(2)}px,0) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        tile.style.zIndex=String(onArc?10+Math.round(height*14):1);
        tile.style.opacity=String(Math.max(0,opacity));
      });
    };
    const tick=now=>{
      if(!last)last=now;
      if(!orbitPaused.current&&visible&&!motion.matches)
        elapsed+=Math.min(now-last,40);
      last=now;
      position();
      frame=window.requestAnimationFrame(tick);
    };
    const onVisibility=()=>{visible=!document.hidden;last=0;};
    const onMotionChange=()=>{last=0;};
    const observer=typeof IntersectionObserver!=='undefined'
      ?new IntersectionObserver(entries=>{
        visible=!document.hidden&&entries.some(entry=>entry.isIntersecting);
        last=0;
      },{threshold:0}):null;
    measure();
    position();
    observer?.observe(element);
    document.addEventListener('visibilitychange',onVisibility);
    window.addEventListener('resize',measure);
    motion.addEventListener?.('change',onMotionChange);
    frame=window.requestAnimationFrame(tick);
    return()=>{
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange',onVisibility);
      window.removeEventListener('resize',measure);
      motion.removeEventListener?.('change',onMotionChange);
      tiles.forEach(tile=>{
        tile.style.transform='';
        tile.style.zIndex='';
        tile.style.opacity='';
      });
    };
  },[cards]);

  const results=useMemo(()=>{
    const search=query.trim().toLocaleLowerCase();
    return categories.filter(category=>!search||
      (String(category.title)+' '+t(category.title)+' '+String(category.description||''))
        .toLocaleLowerCase().includes(search));
  },[categories,query,t]);

  const toggle=id=>{
    // Selection is local until Continue so more than one topic can be chosen
    // Guests can explore and choose without being redirected on each click
    const number=Number(id);
    setSelected(previous=>previous.includes(number)
      ?previous.filter(value=>value!==number):[...previous,number]);
  };

  const save=async()=>{
    if(!auth?.token){
      setError(new Error(uk?'Увійдіть у свій акаунт, щоб зберегти вибрані теми':'Sign in to save your topics'));
      return;
    }
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

  return <main className="categoriesPage categoryReferencePage">
    <section className="categoryReferenceHero" aria-labelledby="category-reference-heading">
      <h1 id="category-reference-heading">{uk?'Знайди свою тему':'Find your thing'}</h1>

      <div ref={orbitRef} className="categoryReferenceCollage" role="group"
        onPointerEnter={()=>{orbitPaused.current=true;}}
        onPointerLeave={()=>{orbitPaused.current=false;}}
        onFocusCapture={()=>{orbitPaused.current=true;}}
        onBlurCapture={event=>{
          if(!event.currentTarget.contains(event.relatedTarget))orbitPaused.current=false;
        }}
        aria-label={uk?'Обрати цікаві теми на фото':'Select interests from the photos'}>
        {cards.map((category,index)=>{
          const offset=index-(cards.length-1)/2;
          const chosen=selected.includes(Number(category.id));
          return <button type="button" key={category.id}
            className={'categoryReferencePhoto'+(chosen?' isSelected':'')}
            style={{
              '--photo-x':(offset*108)+'px',
              '--photo-y':(offset*offset*9)+'px',
              '--photo-angle':(offset*5)+'deg'
            }}
            onClick={()=>toggle(category.id)}
            aria-pressed={chosen}
            aria-label={(chosen?(uk?'Зняти вибір: ':'Deselect: '):(uk?'Обрати: ':'Select: '))+t(category.title)}>
            <img src={coverFor(category,index)} alt="" loading="eager" decoding="async"/>
            <span className="categoryReferencePhotoCheck" aria-hidden="true">
              <Icon name={chosen?'check':'plusSimple'} size={17}/>
            </span>
          </button>;
        })}
        {loading&&<span className="categoryReferenceLoad" role="status">
          {uk?'Завантажуємо теми…':'Loading topics…'}
        </span>}
        {!loading&&!cards.length&&<span className="categoryReferenceLoad">
          {uk?'Поки немає тем':'No topics yet'}
        </span>}
      </div>
    </section>

    <section className="categoryReferenceTopics" aria-label={uk?'Вибір тем':'Choose your topics'}>
      <label className="categoryReferenceSearch">
        <Icon name="search" size={19}/>
        <input type="search" value={query}
          placeholder={uk?'Пошук тем':'Search topics'}
          aria-label={uk?'Пошук тем':'Search topics'}
          onChange={event=>setQuery(event.target.value)}/>
        {query&&<button type="button" onClick={()=>setQuery('')}
          aria-label={uk?'Очистити пошук':'Clear search'}>
          <Icon name="close" size={15}/>
        </button>}
      </label>
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
      <div className="categoryReferenceFooter">
        <span className="categoryReferenceCount" aria-live="polite">
          {selected.length>0?(uk?'Обрано: ':'Selected: ')+selected.length:''}
        </span>
        <div className="categoryReferenceHeroActions">
          <button type="button" className="categoryReferenceSkip"
            onClick={()=>go('/')} disabled={saving}>{uk?'Пропустити':'Skip'}</button>
          <button type="button" className="categoryReferencePrimary"
            onClick={save} disabled={loading||saving}>
            {saving?(uk?'Зберігаємо…':'Saving…'):(uk?'Продовжити':'Continue')}
            <Icon name="arrow" size={16}/>
          </button>
        </div>
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
