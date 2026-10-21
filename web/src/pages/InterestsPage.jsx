import React, {useEffect,useMemo,useRef,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,Icon,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

// Photographs already uploaded for Circle's login/registration gallery.
// Actual categories come from the database; no dummy topics are introduced.
const visuals=[
  {match:/тварин|pets?|animals?|соба|кот|cat|dog/i,image:0},
  {match:/кіно|фільм|movie|film|cinema/i,image:1},
  {match:/вишив|хобі|handcraft|knit|рукоділ|craft/i,image:2},
  {match:/подорож|travel|мандр|туризм|nature|природ/i,image:3},
  {match:/мод|style|fashion|стиль|одяг/i,image:4},
  {match:/крас|beauty|квіти|flower|догляд/i,image:5},
  {match:/авіа|flight|літак|plane/i,image:6},
  {match:/мистец|art|творч|design|дизайн|малю/i,image:5},
  {match:/фітнес|спорт|fitness|sport|йог|здоров|gym/i,image:8},
  {match:/автомоб|машин|car|auto|технік/i,image:9},
  {match:/книг|book|літера|читан/i,image:10},
  {match:/робот|кар'єр|career|work|business|бізнес/i,image:11},
  {match:/музик|music/i,image:2},
  {match:/аніме|anime|games?|ігр|гейм/i,image:7},
];
const galleryPhoto=(category,index=0)=>{
  const title=String(category.title||'');
  const item=visuals.find(entry=>entry.match.test(title));
  const n=item?item.image:index%12;
  return '/images/'+encodeURIComponent('Frame '+String(2072750583+n)+'.png');
};
const selectedNumber=value=>Number(value);
const interestUpdated=()=>window.dispatchEvent(new Event('circle:interests-updated'));

export default function InterestsPage(){
  const auth=useSelector(state=>state.auth);
  const {t,language}=usePreferences();
  const uk=language==='uk';
  const [topics,setTopics]=useState([]);
  const [selected,setSelected]=useState([]);
  const [query,setQuery]=useState('');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);
  const rail=useRef(null);

  useEffect(()=>{
    if(!auth?.token){setLoading(false);return;}
    const controller=new AbortController();
    setLoading(true);
    Promise.all([
      api('/categories',{signal:controller.signal}),
      api('/social/interests',{token:auth.token,signal:controller.signal}),
    ]).then(([categories,interests])=>{
      if(controller.signal.aborted)return;
      setTopics(Array.isArray(categories.data)?categories.data:[]);
      setSelected((Array.isArray(interests.data)?interests.data:[])
        .map(selectedNumber).filter(Number.isInteger));
      setError(null);
    }).catch(err=>{
      if(!controller.signal.aborted)setError(err);
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[auth?.token]);

  const toggle=id=>{
    const number=Number(id);
    setSelected(current=>current.includes(number)
      ?current.filter(value=>value!==number)
      :[...current,number]);
  };
  // Show relevant visually recognizable categories first. The same IDs
  // are used for the image rail, quick-add list, and the backend PUT.
  const ordered=useMemo(()=>[...topics].sort((a,b)=>{
    const aa=visuals.findIndex(v=>v.match.test(a.title||''));
    const bb=visuals.findIndex(v=>v.match.test(b.title||''));
    return (aa<0?999:aa)-(bb<0?999:bb);
  }),[topics]);
  const featured=ordered.slice(0,Math.min(10,ordered.length));
  const popular=ordered.slice(0,Math.min(9,ordered.length));
  const filtered=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase();
    return topics.filter(category=>
      !term || (category.title+' '+t(category.title)).toLocaleLowerCase().includes(term));
  },[topics,query,t]);

  function moveRail(direction){
    if(!rail.current)return;
    const width=rail.current.querySelector('.circleTopicCard')?.getBoundingClientRect().width||220;
    rail.current.scrollBy({left:direction*(width+14)*2,behavior:'smooth'});
  }

  async function save(){
    if(!auth?.token||saving||loading)return;
    setSaving(true);setError(null);
    try{
      await api('/social/interests',{method:'PUT',token:auth.token,
        body:{categories:selected}});
      interestUpdated();
      go('/');
    }catch(err){setError(err);}
    finally{setSaving(false);}
  }

  if(!auth)return <main className="circleInterestsSignIn">
    <h1>{uk?'Увійдіть, щоб обрати теми':'Sign in to choose your topics'}</h1>
    <button type="button" onClick={()=>go('/login')}>{t('Log in')}</button>
  </main>;

  return <main className="circleInterestPage">
    <section className="circleInterestHero" aria-labelledby="circle-interest-title">
      <div className="circleInterestHeroCopy">
        <span className="circleInterestHeroEyebrow">CIRCLE <span aria-hidden="true">✳</span> {uk?'ТВОЇ ІНТЕРЕСИ':'YOUR INTERESTS'}</span>
        <h1 id="circle-interest-title">{uk?'Знайди свою тему':'Find your thing'}</h1>
        <p>{uk?'Обери те, що тобі цікаво. Решту зробить Circle.':
          'Choose what inspires you. Circle will take care of the rest.'}</p>
      </div>
      <div className="circleInterestHeroArt" aria-hidden="true">
        <div className="circleInterestMascot">
          <img src="/images/Frame%202072750582.png" alt="" decoding="async"/>
        </div>
      </div>
    </section>

    <div className="circleInterestLayout">
      <section className="circleInterestDiscover" aria-labelledby="circle-discover-title">
        <div className="circleInterestSectionHead">
          <div>
            <h2 id="circle-discover-title">{uk?'Надихайся':'Get inspired'}</h2>
            <p>{uk?'Гортай та натискай, щоб додати тему':'Browse and tap to add an interest'}</p>
          </div>
          <div className="circleInterestArrows">
            <button type="button" onClick={()=>moveRail(-1)}
              aria-label={uk?'Попередні теми':'Previous topics'}>
              <Icon name="arrowLeft" size={19}/>
            </button>
            <button type="button" onClick={()=>moveRail(1)}
              aria-label={uk?'Наступні теми':'Next topics'}>
              <Icon name="arrow" size={19}/>
            </button>
          </div>
        </div>
        <div className="circleInterestRail" ref={rail} role="group"
          aria-label={uk?'Картки тем':'Featured topics'}>
          {featured.map((category,index)=>{
            const chosen=selected.includes(Number(category.id));
            return <button key={category.id} type="button"
              aria-pressed={chosen} onClick={()=>toggle(category.id)}
              className={'circleTopicCard'+(chosen?' isSelected':'')}>
              <img src={galleryPhoto(category,index)} loading={index<4?'eager':'lazy'}
                alt="" decoding="async"/>
              <span className="circleTopicImageFade" aria-hidden="true"/>
              <span className="circleTopicCardTop">
                <span className="circleTopicNumber">{String(index+1).padStart(2,'0')}</span>
                <span className="circleTopicSelect" aria-hidden="true">
                  <Icon name={chosen?'check':'plus'} size={17}/>
                </span>
              </span>
              <strong>{t(category.title)}</strong>
            </button>;
          })}
        </div>
        {loading&&<p className="circleInterestMessage" role="status">
          {uk?'Завантажуємо теми…':'Loading topics…'}</p>}
        {!loading&&!featured.length&&<p className="circleInterestMessage">
          {uk?'Теми поки що відсутні':'No topics available yet'}</p>}
      </section>

      <aside className="circleInterestQuickPick" aria-labelledby="circle-popular-title">
        <div className="circleInterestSectionHead">
          <div>
            <h2 id="circle-popular-title">{uk?'Популярні теми':'Popular topics'}</h2>
            <p>{uk?'Додай у свою добірку':'Add to your favorites'}</p>
          </div>
        </div>
        <div className="circleInterestPopularList">
          {popular.map(category=>{
            const chosen=selected.includes(Number(category.id));
            return <button key={category.id} type="button" onClick={()=>toggle(category.id)}
              aria-pressed={chosen} className={'circleInterestPopularItem'+(chosen?' isSelected':'')}>
              <span>{t(category.title)}</span>
              <span className="circleInterestPopularIcon" aria-hidden="true">
                <Icon name={chosen?'check':'plus'} size={17}/>
              </span>
            </button>;
          })}
        </div>
        <p className="circleInterestFeedHint">
          <Icon name="sparkles" size={16}/>
          {uk?'За вибраними темами ми покажемо більше цікавих тобі дописів.':
            'We will show more posts about the topics you choose.'}
        </p>
      </aside>
    </div>

    <section className="circleInterestAll" aria-labelledby="circle-all-topics">
      <details className="circleInterestAllDetails">
        <summary><span id="circle-all-topics">{uk?'Усі теми':'All topics'}</span>
          <Icon name="chevron" size={17}/>
        </summary>
        <label className="circleInterestSearch">
          <Icon name="search" size={17}/>
          <input value={query} onChange={event=>setQuery(event.target.value)}
            type="search" placeholder={uk?'Пошук тем':'Search topics'}
            aria-label={uk?'Пошук тем':'Search topics'}/>
        </label>
        <div className="circleInterestAllChips">
          {filtered.map(category=>{
            const chosen=selected.includes(Number(category.id));
            return <button type="button" key={category.id} onClick={()=>toggle(category.id)}
              aria-pressed={chosen} className={chosen?'isSelected':''}>
              <Icon name={chosen?'check':'plus'} size={15}/>
              {t(category.title)}
            </button>;
          })}
        </div>
        {!loading&&!filtered.length&&<p className="circleInterestMessage">
          {uk?'Нічого не знайдено':'No matching topics'}</p>}
      </details>
    </section>

    <footer className="circleInterestFooter">
      <span className="circleInterestCounter">
        <strong>{selected.length}</strong> {uk?'обрано':'selected'}
      </span>
      <div className="circleInterestFooterButtons">
        <button type="button" className="circleInterestSkip"
          onClick={()=>go('/')} disabled={saving}>
          {uk?'Пропустити':'Skip for now'}
        </button>
        <button type="button" className="circleInterestContinue" onClick={save}
          disabled={saving||loading||Boolean(error)}>
          {saving?(uk?'Зберігаємо…':'Saving…'):(uk?'Продовжити':'Continue')}
          <Icon name="arrow" size={18}/>
        </button>
      </div>
      <ErrorBox error={error}/>
    </footer>
  </main>;
}
