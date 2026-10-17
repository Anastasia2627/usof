import React, {useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from './api.js';
import {usePreferences} from './preferences.jsx';

// One reusable role control, visible on profiles, searches, posts and replies.
// All permissions are enforced again in the backend.
export default function ModeratorControl({userId,login,role,onChanged}) {
  const auth=useSelector(state=>state.auth);
  const {t}=usePreferences();
  const [open,setOpen]=useState(false);
  const [currentRole,setCurrentRole]=useState(role||null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const allowed=auth?.user?.role==='admin' && userId && Number(userId)!==Number(auth.user.id);
  useEffect(()=>setCurrentRole(role||null),[role,userId]);
  useEffect(()=>{
    if(!open||!allowed)return;
    let live=true;
    setError('');
    api('/users/'+userId,{token:auth.token})
      .then(result=>{if(live)setCurrentRole(result.data.role);})
      .catch(err=>{if(live)setError(err.message);});
    return ()=>{live=false;};
  },[open,userId,allowed,auth?.token]);
  if(!allowed)return null;
  const canToggle=currentRole==='user'||currentRole==='moderator';
  async function change(){
    if(!canToggle||busy)return;
    const target=currentRole==='user'?'moderator':'user';
    if(!window.confirm(t(target==='moderator'?'Make moderator?':'Remove moderator?')+' @'+(login||userId)))return;
    setBusy(true);setError('');
    try{
      await api('/users/'+userId+'/role',{token:auth.token,method:'PATCH',body:{role:target}});
      setCurrentRole(target);
      setOpen(false);
      window.dispatchEvent(new CustomEvent('circle:user-role-updated',{detail:{id:Number(userId),role:target}}));
      onChanged?.(target);
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <span className="moderatorControl" onClick={event=>event.stopPropagation()}>
    <button className="moderatorControlTrigger" type="button"
      title={t('Manage role')} aria-label={t('Manage role')+' @'+(login||userId)}
      aria-expanded={open} onClick={()=>setOpen(v=>!v)}>⋯</button>
    {open&&<span className="moderatorControlPopover" role="group" aria-label={t('Manage role')}>
      <strong>@{login||userId}</strong>
      <small>{currentRole?t('Role')+': '+t(currentRole):t('Loading…')}</small>
      {canToggle&&<button type="button" disabled={busy} onClick={change}>
        {t(currentRole==='user'?'Make moderator':'Remove moderator')}
      </button>}
      {currentRole==='admin'&&<small>{t('Administrators cannot be changed here.')}</small>}
      {error&&<small role="alert">{error}</small>}
    </span>}
  </span>;
}
