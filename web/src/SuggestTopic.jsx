import React,{useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from './api.js';
import {usePreferences} from './preferences.jsx';
import TablerIcon from './TablerIcon.jsx';

export default function SuggestTopic(){
  const auth=useSelector(state=>state.auth);
  const {t}=usePreferences();
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState('');
  const [description,setDescription]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [mySuggestions,setMySuggestions]=useState([]);
  useEffect(()=>{
    if(!auth?.token||!open)return;
    let live=true;
    api('/categories/suggestions/mine',{token:auth.token})
      .then(result=>{if(live)setMySuggestions(result.data);}).catch(()=>{});
    return()=>{live=false;};
  },[open,auth?.token]);
  if(!auth)return null;
  async function submit(event){
    event?.preventDefault();
    if(title.trim().length<3){setError(t('Topic name must be 3–100 characters'));return;}
    setBusy(true);setError('');setMessage('');
    try{
      const result=await api('/categories/suggestions',{method:'POST',token:auth.token,body:{title,description}});
      setMySuggestions(v=>[result.data,...v]);
      setTitle('');setDescription('');setMessage(t('Suggestion sent for review'));
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <section className="suggestTopic">
    <button type="button" className="suggestTopicTrigger" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <TablerIcon name="plus" size={17}/>{t('Suggest a topic')}
      <TablerIcon name="chevron" size={16}/>
    </button>
    {open&&<div className="suggestTopicPanel">
      <h3>{t('Have an idea for a new topic?')}</h3>
      <div className="suggestTopicForm" role="group" aria-label={t('Suggest a topic')}>
        <label>{t('Topic name')}<input required minLength="3" maxLength="100" value={title}
          onChange={event=>setTitle(event.target.value)} placeholder={t('Topic name')}/></label>
        <label>{t('Topic description (optional)')}<textarea maxLength="500" rows="2" value={description}
          onChange={event=>setDescription(event.target.value)}/></label>
        <button type="button" className="primary" disabled={busy||title.trim().length<3} onClick={submit}>
          <TablerIcon name="send" size={17}/>{t('Send suggestion')}</button>
      </div>
      {error&&<p role="alert" className="suggestError">{error}</p>}
      {message&&<p role="status" className="suggestSuccess"><TablerIcon name="check" size={16}/>{message}</p>}
      {mySuggestions.length>0&&<div className="suggestHistory">
        <strong>{t('Your suggestions')}</strong>
        {mySuggestions.slice(0,5).map(item=><div key={item.id}><span>{item.title}</span>
          <small>{t(item.status==='pending'?'Pending':item.status==='approved'?'Approved':'Rejected')}</small></div>)}
      </div>}
    </div>}
  </section>;
}
