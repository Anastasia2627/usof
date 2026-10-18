import React,{useEffect,useMemo,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,Icon,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

// The photo URLs point to freely usable Pexels editorial photographs.
// A color background remains visible if an image cannot be loaded.
const spotlightPhotos = [
  {key:'Music',url:'https://images.pexels.com/photos/8973446/pexels-photo-8973446.jpeg?auto=compress&cs=tinysrgb&w=700',tone:'cyan',number:'01'},
  {key:'Fashion',url:'https://images.pexels.com/photos/35998079/pexels-photo-35998079.jpeg?auto=compress&cs=tinysrgb&w=700',tone:'blue',number:'02'},
  {key:'Art',url:'https://images.pexels.com/photos/14886151/pexels-photo-14886151.jpeg?auto=compress&cs=tinysrgb&w=700',tone:'purple',number:'03'},
  {key:'Photography',url:'https://images.pexels.com/photos/32772036/pexels-photo-32772036.jpeg?auto=compress&cs=tinysrgb&w=700',tone:'orange',number:'04'},
  {key:'Games',url:'https://images.pexels.com/photos/13277099/pexels-photo-13277099.jpeg?auto=compress&cs=tinysrgb&w=700',tone:'red',number:'05'},
  {key:'Travel',url:'https://images.pexels.com/photos/30186072/pexels-photo-30186072.jpeg?auto=compress&cs=tinysrgb&w=700',tone:'violet',number:'06'},
];
const photoByKey=new Map(spotlightPhotos.map(photo=>[photo.key,photo]));

export default function InterestsPage(){
  const auth=useSelector(state=>state.auth);
  const {t,language}=usePreferences();
  const uk=language==='uk';
  const [topics,setTopics]=useState([]);
  const [selected,setSelected]=useState([]);
  const [query,setQuery]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState(null);

  useEffect(()=>{
    if(!auth?.token)return;
    let active=true;
    Promise.all([api('/categories'),api('/social/interests',{token:auth.token})])
      .then(([a,b])=>{
        if(active){setTopics(a.data||[]);setSelected((b.data||[]).map(Number));}
      }).catch(err=>{if(active)setError(err);});
    return()=>{active=false;};
  },[auth?.token]);

  const featured=useMemo(()=>spotlightPhotos
    .map(photo=>({photo,category:topics.find(c=>c.title.toLowerCase()===photo.key.toLowerCase())}))
    .filter(entry=>Boolean(entry.category)),[topics]);

  const regular=useMemo(()=>topics.filter(category=>{
    if(photoByKey.has(category.title))return false;
    const text=(category.title+' '+t(category.title)).toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase());
  }),[topics,query,t]);

  async function save(){
    setSaving(true);setError(null);
    try{
      await api('/social/interests',{method:'PUT',token:auth.token,body:{categories:selected}});
      go('/');
    }catch(err){setError(err);}finally{setSaving(false);}
  }

  const toggle=id=>setSelected(current=>current.includes(Number(id))
    ?current.filter(value=>value!==Number(id)):[...current,Number(id)]);
  if(!auth)return <main className="socialPage">{t('Sign in to select interests')}</main>;

  return <main className="socialPage interestPage interestEditorialPage">
    <section className="interestFashionHero" aria-labelledby="interest-hero-title">
      <div className="interestFashionGlow" aria-hidden="true"/>
      <div className="interestFashionMicro interestFashionLeft" aria-hidden="true">
        <span>▰ CIRCLE</span><span>EXPLORE</span><span>DISCOVER</span>
      </div>
      <div className="interestFashionMicro interestFashionRight" aria-hidden="true">
        <span>NEW CONNECTIONS</span><span>YOUR SPACE</span>
      </div>
      <div className="interestFashionTypography" aria-hidden="true">
        <div className="interestFashionTypeTop">FIND YOUR</div>
        <div className="interestFashionTypeBottom">PEOPLE</div>
      </div>
      <div className="interestFashionRings" aria-hidden="true">
        <i/><i/><i/><i/><i/>
      </div>
      <div className="interestFashionPhotoDeck" role="group" aria-label={uk?'Популярні теми':'Featured interests'}>
        {featured.map(({photo,category},index)=>{
          const chosen=selected.includes(Number(category.id));
          return <button key={category.id} type="button"
            className={'interestFashionPhoto interestFashionPhoto'+index+(chosen?' isSelected':'')}
            aria-pressed={chosen} aria-label={(chosen?(uk?'Прибрати ':'Remove '):(uk?'Обрати ':'Select '))+t(category.title)}
            onClick={()=>toggle(category.id)}>
            <img src={photo.url} alt="" loading={index>3?'lazy':'eager'} decoding="async"/>
            <span className={'interestPhotoTone interestPhotoTone-'+photo.tone} aria-hidden="true"/>
            <span className="interestPhotoTop" aria-hidden="true">
              <span className="interestVideoMeta"><span className="interestPlayMark">▷</span> {photo.number} / 06</span>
              <span className="interestPhotoSelect"><Icon name={chosen?'check':'plus'} size={17}/></span>
            </span>
            <span className="interestPhotoBottom">
              <span className="interestPhotoCategoryMeta">CIRCLE / EDITION {photo.number}</span>
              <strong>{t(category.title)}</strong>
            </span>
          </button>;
        })}
      </div>
      <div className="interestFashionCaption">
        <span className="interestFashionCaptionNumber">01 — 06</span>
        <span id="interest-hero-title">{uk?'Знайди людей зі спільними інтересами':'Find people who get you'}</span>
        <span className="interestFashionCaptionSecondary">{uk?'Обери теми прямо на фото':'Choose topics right on the photos'}</span>
      </div>
    </section>

    <section className="interestEditorialPicker" aria-labelledby="interest-more-title">
      <div className="interestPickerHeading interestMagazineHeading">
        <div><span className="interestEyebrow">02 / YOUR INTERESTS</span>
          <h2 id="interest-more-title">{t('What are you into?')}</h2>
          <p>{uk?'Познач теми, які тобі цікаві. Їх можна буде змінити будь-коли.':
            'Pick what you love. You can always change it later.'}</p>
        </div>
        <label className="interestTopicSearch">
          <Icon name="search" size={18}/>
          <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
            placeholder={uk?'Знайти тему':'Search topics'} aria-label={uk?'Знайти тему':'Search topics'}/>
        </label>
      </div>
      <div className="interestEditorialTopics" role="group" aria-label={t('Topics that interest you')}>
        {regular.map(category=><button key={category.id} type="button"
          className={'interestEditorialChip'+(selected.includes(Number(category.id))?' chosen':'')}
          aria-pressed={selected.includes(Number(category.id))}
          onClick={()=>toggle(category.id)}>
          <span className="interestEditorialChipIcon"><Icon name={selected.includes(Number(category.id))?'check':'plus'} size={17}/></span>
          {t(category.title)}
        </button>)}
      </div>
      {topics.length===0&&!error&&<p className="interestEditorialEmpty">{uk?'Завантажуємо теми…':'Loading interests…'}</p>}
      {query&&regular.length===0&&<p className="interestEditorialEmpty">{uk?'Нічого не знайдено':'No matching topics'}</p>}
      <ErrorBox error={error}/>
    </section>

    <div className="interestEditorialFooter">
      <div className="interestSelectionProgress">
        <strong>{selected.length}</strong>
        <span>{uk?'тем обрано':'interests selected'}</span>
      </div>
      <div className="interestEditorialFooterButtons">
        <button type="button" className="interestSkip" onClick={()=>go('/')}>{t('Maybe later')}</button>
        <button className="primary" type="button" disabled={saving} onClick={save}>
          {saving?(uk?'Зберігаємо…':'Saving…'):t('Continue')} <Icon name="arrow" size={19}/>
        </button>
      </div>
    </div>
  </main>;
}
