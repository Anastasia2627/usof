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
  const popular=useMemo(()=>[...categories]
    .sort((a,b)=>Number(b.post_count||0)-Number(a.post_count||0)||
      String(a.title).localeCompare(String(b.title)))
    .slice(0,8),[categories]);
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
      <p>{uk?'Обери те, що тобі цікаво, і Circle підлаштує стрічку під тебе':
        'Pick what you love and make your feed feel like yours'}</p>
    </header>

    <section className="topicStudioFeature" aria-labelledby="topic-studio-picks">
      <div className="topicStudioFeatureHeading">
        <h2 id="topic-studio-picks">{uk?'Відкривай цікаве':'Explore what inspires you'}</h2>
        <div className="topicStudioControls">
          <button type="button" onClick={()=>shift(-1)} disabled={cards.length<2}
            aria-label={uk?'Попередні теми':'Previous topics'}>
            <Icon name="arrowBack" size={19}/>
          </button>
          <button type="button" onClick={()=>shift(1)} disabled={cards.length<2}
            aria-label={uk?'Наступні теми':'Next topics'}>
            <Icon name="arrow" size={19}/>
          </button>
        </div>
      </div>
      <div className="topicStudioFan" role="group"
        aria-label={uk?'Картки тем':'Choose from topic cards'}>
        {cards.map((category,index)=>{
          const distance=index-(cards.length-1)/2;
          const chosen=selected.includes(Number(category.id));
          return <div key={category.id}
            className={'topicStudioFanItem'+(chosen?' isSelected':'')}
            style={{
              '--fan-offset':distance,
              '--fan-shift':(distance*112)+'px',
              '--fan-drop':(distance*distance*11)+'px',
              '--fan-mobile-shift':(distance*60)+'px',
              '--fan-mobile-drop':(distance*distance*6.4)+'px',
              '--fan-small-shift':(distance*50)+'px',
              '--fan-small-drop':(distance*distance*5.2)+'px',
              '--fan-rotate':(distance*6.2)+'deg',
              '--fan-depth':String(20-Math.abs(distance)),
            }}>
            <button type="button" className="topicStudioCard" onClick={()=>toggle(category.id)}
              aria-pressed={chosen} aria-label={(chosen?(uk?'Прибрати ':'Remove '):(uk?'Обрати ':'Choose '))+t(category.title)}>
              <img src={categoryCover(category,index)} alt="" loading="eager" decoding="async"/>
              <span className="topicStudioCardShade" aria-hidden="true"/>
              <span className="topicStudioCardSelect" aria-hidden="true">
                <Icon name={chosen?'check':'plusSimple'} size={18}/>
              </span>
              <strong>{t(category.title)}</strong>
            </button>
            <button type="button" className="topicStudioCardBrowse"
              onClick={()=>go('/category/'+category.id)}
              aria-label={(uk?'Переглянути дописи: ':'Browse posts: ')+t(category.title)}>
              <Icon name="arrow" size={14}/>
            </button>
          </div>;
        })}
        {loading&&<p role="status" className="topicStudioFanPlaceholder">
          {uk?'Завантажуємо теми…':'Loading topics…'}</p>}
        {!loading&&!cards.length&&<p className="topicStudioFanPlaceholder">
          {uk?'Поки немає тем':'No topics yet'}</p>}
      </div>
      <div className="topicStudioFanCaption">
        <span>{uk?'Натисни на картку, щоб обрати тему':'Tap a photo to select a topic'}</span>
        <span>{cards.length>0?String((currentSlide%Math.max(visualOrder.length,1))+1).padStart(2,'0')+
          ' / '+String(visualOrder.length).padStart(2,'0'):''}</span>
      </div>
    </section>

    <div className="topicStudioMiddle">
      <div className="topicStudioPopular">
        <div className="topicStudioSectionTitle">
          <h2>{uk?'Популярні теми':'Popular topics'}</h2>
          <span>{uk?'Обери декілька':'Choose a few'}</span>
        </div>
        <div className="topicStudioPopularGrid">
          {popular.map(category=>{
            const chosen=selected.includes(Number(category.id));
            return <button type="button" key={category.id}
              className={'topicStudioPopularButton'+(chosen?' isSelected':'')}
              aria-pressed={chosen} onClick={()=>toggle(category.id)}>
              <span>{t(category.title)}</span>
              <Icon name={chosen?'check':'plusSimple'} size={17}/>
            </button>;
          })}
        </div>
      </div>
      <aside className="topicStudioSelection">
        <h2>{uk?'Налаштуй свою стрічку':'Make your feed yours'}</h2>
        <p>{uk?'Дописів за вибраними темами буде більше, але решта теж залишиться у стрічці':
          'We will show more posts about your interests, without hiding the rest'}</p>
        <div className="topicStudioSelectedTags" aria-live="polite">
          {selected.length?selected.map(id=>{
            const category=categories.find(c=>Number(c.id)===id);
            if(!category)return null;
            return <button type="button" key={id} onClick={()=>toggle(id)}
              title={uk?'Прибрати тему':'Remove interest'}>
              {t(category.title)} <Icon name="close" size={14}/>
            </button>;
          }):<span className="topicStudioEmptySelection">
            {uk?'Поки нічого не обрано':'No topics selected yet'}
          </span>}
        </div>
        <div className="topicStudioActions">
          <button type="button" className="topicStudioSkip" onClick={()=>go('/')}
            disabled={saving}>{uk?'Пропустити':'Skip for now'}</button>
          <button type="button" className="topicStudioSave" onClick={save}
            disabled={loading||saving}>
            {saving?(uk?'Зберігаємо…':'Saving…'):(uk?'Продовжити':'Continue')}
            <Icon name="arrow" size={17}/>
          </button>
        </div>
      </aside>
    </div>

    <section className="topicStudioAll">
      <div className="topicStudioAllHeader">
        <div>
          <h2>{uk?'Усі теми':'All topics'}</h2>
          <span>{results.length}</span>
        </div>
        <div className="topicStudioAllActions">
          <label className="topicStudioSearch">
            <Icon name="search" size={17}/>
            <input type="search" value={query}
              onChange={event=>setQuery(event.target.value)}
              placeholder={uk?'Пошук тем':'Search topics'}
              aria-label={uk?'Пошук тем':'Search topics'}/>
            {query&&<button type="button" onClick={()=>setQuery('')}
              aria-label={uk?'Очистити пошук':'Clear search'}>
              <Icon name="close" size={16}/>
            </button>}
          </label>
          <SuggestTopic/>
        </div>
      </div>
      <div className="topicStudioDirectory">
        {results.map(category=>{
          const chosen=selected.includes(Number(category.id));
          return <div key={category.id} className="topicStudioDirectoryItem">
            <button type="button" className="topicStudioDirectoryOpen"
              onClick={()=>go('/category/'+category.id)}>
              <span>{t(category.title)}</span>
              <Icon name="arrow" size={15}/>
            </button>
            {auth&&<button type="button" className={'topicStudioDirectoryToggle'+(chosen?' isSelected':'')}
              onClick={()=>toggle(category.id)} aria-pressed={chosen}
              aria-label={(chosen?(uk?'Прибрати ':'Remove '):(uk?'Обрати ':'Choose '))+t(category.title)}>
              <Icon name={chosen?'check':'plusSimple'} size={16}/>
            </button>}
          </div>;
        })}
      </div>
      {!loading&&!results.length&&<p className="topicStudioNoResults">
        {uk?'Нічого не знайдено':'No matching topics'}</p>}
    </section>
    <ErrorBox error={error}/>
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
