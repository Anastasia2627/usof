import React, {useState} from 'react';
import {api} from './api.js';
import {ErrorBox,Icon} from './ui.jsx';
import {usePreferences} from './preferences.jsx';

export default function ReportButton({kind,id,auth,authorId,panel=false,onClose}) {
  const {t}=usePreferences();
  const [open,setOpen]=useState(false),[reason,setReason]=useState('spam');
  const [details,setDetails]=useState(''),[busy,setBusy]=useState(false);
  const [message,setMessage]=useState(''),[error,setError]=useState(null);
  const [recommendBan,setRecommendBan]=useState(false);
  const canRecommend=auth?.user?.role==='moderator';
  if(!auth||Number(auth.user.id)===Number(authorId))return null;
  const path=kind==='comment'?'/comments/'+id+'/report':'/posts/'+id+'/report';
  async function submit(event){
    event.preventDefault();setError(null);setBusy(true);
    try{
      await api(path,{method:'POST',token:auth.token,body:{reason,details,recommendBan:canRecommend && recommendBan}});
      setMessage(t(recommendBan?'Ban recommendation sent to admin':'Report submitted for review'));setOpen(false);setDetails('');setRecommendBan(false);
    }catch(err){setError(err);}finally{setBusy(false);}
  }
  return <div className={'reportControl'+(panel?' discussionReportPanel':'')}>
    {message?<small role="status">{t(message)} {panel&&<button type="button" onClick={onClose}>{t('Close')}</button>}</small>:!panel&&<button type="button" className="quietButton reportIconAction"
      title={t('Report')} aria-label={t('Report')} aria-expanded={open}
      onClick={()=>{setOpen(x=>!x);setError(null);}}><Icon name="shield" size={17}/></button>}
    {(open||panel)&&!message&&<form className="reportForm" onSubmit={submit}>
      <label>{t('Reason')}<select value={reason} onChange={e=>setReason(e.target.value)}>
        <option value="spam">{t('Spam')}</option><option value="abuse">{t('Abuse or harassment')}</option>
        <option value="off_topic">{t('Off-topic')}</option><option value="other">{t('Other')}</option>
      </select></label>
      <label>{t('Details (optional)')}<textarea maxLength="500" value={details} onChange={e=>setDetails(e.target.value)}/></label>
      {canRecommend&&<label className="reportBanSuggest">
        <input type="checkbox" checked={recommendBan} onChange={e=>setRecommendBan(e.target.checked)}/>
        <span>{t('Recommend banning this author to an administrator')}</span>
      </label>}
      <div className="toolbar"><button type="submit" disabled={busy}>{t(busy?'Sending…':recommendBan?'Send recommendation':'Send report')}</button>
        <button type="button" onClick={()=>{setOpen(false);onClose?.();}}>{t('Cancel')}</button></div>
      <ErrorBox error={error}/>
    </form>}
  </div>;
}
