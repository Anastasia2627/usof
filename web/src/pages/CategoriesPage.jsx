import React, {useEffect,useMemo,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox, PostCard, Icon, go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';
import SuggestTopic from '../SuggestTopic.jsx';
import {useInfiniteRecords, InfiniteScrollEnd} from '../InfiniteScroll.jsx';

// Use the original photo cards already included with Circle, never duplicate
// categories or invent available interests; IDs come from /api/categories
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
const categoryCover=(category,index)=>{
  const text=String(category?.title||'');
  const photoIndex=coverRules.find(([pattern])=>pattern.test(text))?.[1]??index%photoLibrary.length;
  return photoLibrary[photoIndex];
};

export default function CategoriesPage() {
  const auth=useSelector(state=>state.auth);
  const {t,language}=usePreferences();
  const uk=language==='uk';
  const [categories,setCategories]=useState([]);
  const [selected,setSelected]=useState([]);
  const [query,setQuery]=useState('');
  const [currentSlide,setCurrentSlide]=useState(0);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);

  useEffect(()=>{
    const controller=new AbortController();
    const load=async()=>{
      setLoading(true);
      try{
        const [all,choices]=await Promise.all([
          api('/categories',{signal:controller.signal}),
          auth?.token?api('/social/interests',{token:auth.token,signal:controller.signal}):Promise.resolve({data:[]}),
        ]);
        if(controller.signal.aborted)return;
        setCategories(Array.isArray(all?.data)?all.data:[]);
        setSelected(Array.isArray(choices?.data)?choices.data.map(Number):[]);
        setError(null);
      }catch(err){
        if(!controller.signal.aborted&&err.name!=='AbortError')setError(err);
      }finally{
        if(!controller.signal.aborted)setLoading(false);
      }
    };
    load();
    const changed=()=>{if(!controller.signal.aborted)load();};
    window.addEventListener('circle:categories-updated',changed);
    return()=>{controller.abort();window.removeEventListener('circle:categories-updated',changed);};
  },[auth?.token]);

  const visualOrder=useMemo(()=>[...categories].sort((a,b)=>{
    const aIndex=coverRules.findIndex(([p])=>p.test(a.title||''));
    const bIndex=coverRules.findIndex(([p])=>p.test(b.title||''));
    return (aIndex<0?100:aIndex)-(bIndex<0?100:bIndex)||
      Number(b.post_count||0)-Number(a.post_count||0);
  }),[categories]);
  const cards=useMemo(()=>{
    const n=Math.min(7,visualOrder.length);
    return Array.from({length:n},(_,i)=>visualOrder[(currentSlide+i)%visualOrder.length]);
  },[visualOrder,currentSlide]);
  const results=useMemo(()=>{
    const search=query.trim().toLocaleLowerCase();
    return categories.filter(c=>(String(c.title)+' '+t(c.title)+' '+String(c.description||''))
      .toLocaleLowerCase().includes(search));
  },[categories,query,t]);

  function toggle(id){
    if(!auth?.token){go('/login');return;}
    const number=Number(id);
    setSelected(current=>current.includes(number)
      ?current.filter(value=>value!==number)
      :[...current,number]);
  }
  async function save(){
    if(!auth?.token){go('/login');return;}
    if(loading||saving)return;
    setSaving(true);setError(null);
    try{
      await api('/social/interests',{method:'PUT',token:auth.token,
        body:{categories:selected}});
      window.dispatchEvent(new Event('circle:interests-updated'));
      go('/');
    }catch(err){setError(err);}
    finally{setSaving(false);}
  }
  const shift=step=>setCurrentSlide(position=>visualOrder.length?
    (position+step+visualOrder.length)%visualOrder.length:0);

  return <main className="categoriesPage topicStudioPage">
    <header className="topicStudioIntro">
      <h1>{uk?'Знайди свою тему':'Find your thing'}</h1>
      <p>{uk?'Вибирай те, що любиш, і наповнюй стрічку своїм':
        'Choose what inspires you and shape your own feed'}</p>
    </header>

    <section className="topicStudioFeature" aria-label={uk?'Картки тем':'Topic cards'}>
      <div className="topicStudioFan">
        {cards.map((category,index)=>{
          const offset=index-(cards.length-1)/2;
          const chosen=selected.includes(Number(category.id));
          return <div key={category.id}
            className={'topicGalleryItem'+(Math.abs(offset)>2?' isOuter':'')+
              (chosen?' isSelected':'')}
            style={{
              '--card-shift':(offset*117)+'px',
              '--card-shift-md':(offset*80)+'px',
              '--card-drop':(offset*offset*9)+'px',
              '--card-angle':(offset*5.3)+'deg',
              '--card-shift-sm':(offset*59)+'px',
              '--card-drop-sm':(offset*offset*5)+'px',
              '--card-shift-xs':(offset*51)+'px',
              '--card-drop-xs':(offset*offset*4)+'px',
              '--card-level':String(10-Math.abs(offset)),
            }}>
            <button type="button" className="topicGalleryCard"
              aria-pressed={chosen}
              aria-label={(chosen?(uk?'Прибрати тему ':'Remove topic '):(uk?'Обрати тему ':'Select topic '))+t(category.title)}
              onClick={()=>toggle(category.id)}>
              <img src={categoryCover(category,index)} alt="" decoding="async" loading="eager"/>
              <span className="topicGalleryTint" aria-hidden="true"/>
              <span className="topicGalleryMark" aria-hidden="true">
                <Icon name={chosen?'check':'plusSimple'} size={17}/>
              </span>
              <strong>{t(category.title)}</strong>
            </button>
            <button type="button" className="topicGalleryBrowse"
              onClick={()=>go('/category/'+category.id)}
              aria-label={(uk?'Переглянути дописи: ':'Browse posts: ')+t(category.title)}>
              <Icon name="arrow" size={16}/>
            </button>
          </div>;
        })}
        {loading&&<span className="topicStudioLoading" role="status">
          {uk?'Завантажуємо теми…':'Loading topics…'}</span>}
        {!loading&&!cards.length&&<span className="topicStudioLoading">
          {uk?'Поки немає тем':'No topics yet'}</span>}
      </div>
      <div className="topicGalleryNavigation">
        <button type="button" onClick={()=>shift(-1)} disabled={cards.length<2}
          aria-label={uk?'Попередні теми':'Previous topics'}>
          <Icon name="arrowBack" size={19}/>
        </button>
        <span>{cards.length?String(currentSlide%visualOrder.length+1).padStart(2,'0')+
          ' / '+String(visualOrder.length).padStart(2,'0'):''}</span>
        <button type="button" onClick={()=>shift(1)} disabled={cards.length<2}
          aria-label={uk?'Наступні теми':'Next topics'}>
          <Icon name="arrow" size={19}/>
        </button>
      </div>
    </section>

    <section className="topicCapsuleSection" aria-labelledby="topics-caption">
      <div className="topicCapsuleHeading">
        <div>
          <h2 id="topics-caption">{uk?'Обери цікаві теми':'Pick your interests'}</h2>
          <p>{uk?'За вибраними темами ми налаштуємо твою стрічку':
            'Your chosen topics help personalize your feed'}</p>
        </div>
        <label className="topicCapsuleSearch">
          <Icon name="search" size={18}/>
          <input type="search" value={query}
            onChange={event=>setQuery(event.target.value)}
            placeholder={uk?'Пошук тем':'Search topics'}
            aria-label={uk?'Пошук тем':'Search topics'}/>
          {query&&<button type="button" onClick={()=>setQuery('')}
            aria-label={uk?'Очистити':'Clear search'}><Icon name="close" size={16}/></button>}
        </label>
      </div>
      <div className="topicCapsuleRail" role="group"
        aria-label={uk?'Вибери теми':'Select topics'}>
        {results.map(category=>{
          const chosen=selected.includes(Number(category.id));
          return <button key={category.id} type="button"
            className={'topicCapsule'+(chosen?' isSelected':'')}
            aria-pressed={chosen} onClick={()=>toggle(category.id)}>
            <span>{t(category.title)}</span>
            <Icon name={chosen?'check':'plusSimple'} size={17}/>
          </button>;
        })}
        {!loading&&!results.length&&<span className="topicCapsuleEmpty">
          {uk?'Нічого не знайдено':'No matching topics'}</span>}
      </div>
      <div className="topicCapsuleFooter">
        <div className="topicCapsuleFooterLeft">
          <span className="topicCapsuleCount">
            {selected.length>0?(uk?'Обрано: ':'Selected: ')+selected.length:
              (uk?'Ще нічого не обрано':'Nothing selected yet')}
          </span>
          <SuggestTopic/>
        </div>
        <div className="topicCapsuleActions">
          <button type="button" className="topicCapsuleSkip" onClick={()=>go('/')}
            disabled={saving}>{uk?'Пропустити':'Skip'}</button>
          <button type="button" className="topicCapsuleContinue"
            disabled={loading||saving} onClick={save}>
            {saving?(uk?'Зберігаємо…':'Saving…'):(uk?'Продовжити':'Continue')}
            <Icon name="arrow" size={17}/>
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
