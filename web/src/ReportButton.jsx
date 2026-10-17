import React, {useState} from 'react';
import {api} from './api.js';
import {ErrorBox,Icon} from './ui.jsx';
import {usePreferences} from './preferences.jsx';

export default function ReportButton({kind,id,auth,authorId}) {
  const {t}=usePreferences();
  const [open,setOpen]=useState(false),[reason,setReason]=useState('spam');
  const [details,setDetails]=useState(''),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState(null);
  if(!auth||Number(auth.user.id)===Number(authorId))return null;
  const path=kind==='comment'?'/comments/'+id+'/report':'/posts/'+id+'/report';
  async function submit(event){
    event.preventDefault();setError(null);setBusy(true);
    try{
      await api(path,{method:'POST',token:auth.token,body:{reason,details}});
      setMessage('Report sent to moderators.');setOpen(false);setDetails('');
    }catch(err){setError(err);}finally{setBusy(false);}
  }
  return <div className="reportControl">
    {message?<small role="status">{t(message)}</small>:<button type="button" className="quietButton reportIconAction"
      title={t('Report')} aria-label={t('Report')} aria-expanded={open}
      onClick={()=>{setOpen(x=>!x);setError(null);}}><Icon name="shield" size={17}/></button>}
    {open&&<form className="reportForm" onSubmit={submit}>
      <label>Reason<select value={reason} onChange={e=>setReason(e.target.value)}>
        <option value="spam">Spam</option><option value="abuse">Abuse or harassment</option>
        <option value="off_topic">Off-topic</option><option value="other">Other</option>
      </select></label>
      <label>Details (optional)<textarea maxLength="500" value={details} onChange={e=>setDetails(e.target.value)}/></label>
      <div className="toolbar"><button type="submit" disabled={busy}>{busy?'Sending…':'Send report'}</button>
        <button type="button" onClick={()=>setOpen(false)}>Cancel</button></div>
      <ErrorBox error={error}/>
    </form>}
  </div>;
}
