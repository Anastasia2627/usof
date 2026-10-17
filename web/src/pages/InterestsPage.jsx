import React,{useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,Icon,go} from '../ui.jsx';

export default function InterestsPage(){
  const auth=useSelector(state=>state.auth);
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
  if(!auth)return <main className="socialPage">Sign in to select interests</main>;
  return <main className="socialPage interestPage">
    <div className="socialIntro"><div className="socialCircle"><Icon name="heart" size={26}/></div>
      <span className="profileMicroLabel">Make Circle yours</span>
      <h1>What are you into?</h1>
      <p>Pick a few things you love, there are no wrong answers</p>
    </div>
    <div className="interestSelection" role="group" aria-label="Topics that interest you">
      {topics.map(c=><button key={c.id} type="button" className={selected.includes(c.id)?'interestChosen':''}
        aria-pressed={selected.includes(c.id)} onClick={()=>toggle(c.id)}>
        <Icon name={selected.includes(c.id)?'check':'plus'} size={16}/>{c.title}
      </button>)}
    </div>
    <ErrorBox error={error}/>
    <div className="interestFooter"><small>{selected.length} selected</small>
      <button type="button" onClick={()=>go('/')}>Maybe later</button>
      <button className="primary" disabled={saving} onClick={save}>Continue <Icon name="arrow" size={18}/></button>
    </div>
  </main>;
}
