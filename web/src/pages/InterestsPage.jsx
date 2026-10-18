import React,{useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,Icon,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

export default function InterestsPage(){
  const auth=useSelector(state=>state.auth);
  const {t}=usePreferences();
  const [topics,setTopics]=useState([]),[selected,setSelected]=useState([]),[saving,setSaving]=useState(false),[error,setError]=useState(null);
  useEffect(()=>{
    if(!auth?.token)return;
    Promise.all([api('/categories'),api('/social/interests',{token:auth.token})])
      .then(([a,b])=>{setTopics(a.data);setSelected(b.data||[]);}).catch(setError);
  },[auth?.token]);
  async function save(){
    setSaving(true);setError(null);
    try{
      await api('/social/interests',{method:'PUT',token:auth.token,body:{categories:selected}});
      go('/');
    }catch(e){setError(e);}finally{setSaving(false);}
  }
  const toggle=id=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  if(!auth)return <main className="socialPage">{t('Sign in to select interests')}</main>;
  return <main className="socialPage interestPage interestStudio">
    <section className="interestCover">
      <div className="interestCopy">
        <span className="interestEyebrow">CIRCLE / YOUR SPACE</span>
        <h1>Find your <em>people.</em></h1>
        <p>Good conversations start with something you love. Choose a few worlds you want to explore.</p>
        <span className="interestIndex">01 — MAKE IT YOURS</span>
      </div>
      <div className="interestScene" aria-hidden="true">
        <span className="interestBackdrop">DISCOVER</span>
        <span className="sceneCard sceneCardOne"><span>✳</span> CREATE</span>
        <span className="sceneCard sceneCardTwo"><span>◎</span> CONNECT</span>
        <span className="sceneCard sceneCardThree"><span>↗</span> EXPLORE</span>
        <span className="sceneOrb"></span>
      </div>
    </section>
    <div className="interestPickerHeading">
      <div><span className="interestEyebrow">02 / YOUR INTERESTS</span><h2>{t('What are you into?')}</h2></div>
      <p>Select as many as you like. You can always change them later.</p>
    </div>
    <div className="interestSelection interestMosaic" role="group" aria-label={t('Topics that interest you')}>
      {topics.map((c,index)=><button key={c.id} type="button"
        className={'interestTile interestTile'+(index%6)+(selected.includes(c.id)?' interestChosen':'')}
        aria-pressed={selected.includes(c.id)} onClick={()=>toggle(c.id)}>
        <span className="interestTileNumber">{String(index+1).padStart(2,'0')}</span>
        <span className="interestTileName">{t(c.title)}</span>
        <span className="interestTileMark"><Icon name={selected.includes(c.id)?'check':'plus'} size={18}/></span>
      </button>)}
    </div>
    <ErrorBox error={error}/>
    <div className="interestFooter interestStudioFooter">
      <small>{selected.length} {t('selected')}</small>
      <button type="button" onClick={()=>go('/')}>{t('Maybe later')}</button>
      <button className="primary" disabled={saving} onClick={save}>{t('Continue')} <Icon name="arrow" size={18}/></button>
    </div>
  </main>;
}
