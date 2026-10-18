import React,{useEffect,useState} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

export default function BanPage(){
  const {t}=usePreferences();
  const auth=useSelector(state=>state.auth);
  const dispatch=useDispatch();
  const [appeal,setAppeal]=useState(null);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);
  const [notice,setNotice]=useState('');

  async function refresh(){
    if(!auth?.token)return;
    try{
      const result=await api('/auth/ban-status',{token:auth.token});
      setAppeal(result.data.appeal);
      const fresh=result.data.user;
      if(!fresh.banned_at){
        dispatch({type:'AUTH_USER_SET',payload:fresh});
        go('/');
      }else if(['login','full_name','email','avatar','role','banned_at','ban_reason'].some(k=>String(fresh[k]??'')!==String(auth.user[k]??''))){
        dispatch({type:'AUTH_USER_SET',payload:fresh});
      }
    }catch(err){setError(err);}
  }

  useEffect(()=>{
    if(!auth?.token)return;
    refresh();
    const timer=window.setInterval(refresh,15000);
    return()=>window.clearInterval(timer);
  },[auth?.token]);

  async function submit(event){
    event.preventDefault();setBusy(true);setError(null);setNotice('');
    try{
      await api('/auth/ban-appeal',{method:'POST',token:auth.token,body:{explanation:text}});
      setNotice(t('Your appeal was received. An administrator will review it.'));
      setText('');
      await refresh();
    }catch(err){setError(err);}finally{setBusy(false);}
  }

  function logOut(){
    dispatch({type:'AUTH_CLEAR'});
    go('/login');
  }

  if(!auth)return <main className="banPage"><h1>{t('Sign in to view your account status.')}</h1><button onClick={()=>go('/login')}>{t('Log in')}</button></main>;
  return <main className="banPage">
    <div className="banSymbol" aria-hidden="true">✳</div>
    <h1>{t('Your account has been restricted.')}</h1>
    <p className="banLead">{t("You can't access Circle while this restriction is active. You can still send an appeal for review.")}</p>
    <section className="banReasonCard">
      <span>{t('Official reason')}</span>
      <p>{auth.user?.ban_reason || t('Account access has been restricted by an administrator.')}</p>
      {auth.user?.banned_at&&<small>{t('Blocked on')} {new Date(auth.user.banned_at).toLocaleString()}</small>}
    </section>
    {appeal ? <section className="appealState">
      <h2>{t('Your appeal')} · {t(appeal.status)}</h2>
      <p>{appeal.explanation}</p>
      {appeal.review_note&&<p>{t('Decision')}: {appeal.review_note}</p>}
      <small>{t('Submitted')} {new Date(appeal.created_at).toLocaleString()}</small>
    </section> : <form className="banAppealForm" onSubmit={submit}>
      <h2>{t('Tell us what happened')}</h2>
      <label>{t('Your appeal')}
        <textarea value={text} onChange={e=>setText(e.target.value)}
          minLength={5} maxLength={4000} required placeholder={t('Explain why you believe this restriction should be reconsidered…')}/>
      </label>
      <button className="primary" disabled={busy}>{t('Submit appeal')} →</button>
    </form>}
    {notice&&<p role="status">{notice}</p>}
    <ErrorBox error={error}/>
    <div className="banUtility"><button type="button" onClick={refresh}>{t('Refresh status')}</button>
      <button type="button" onClick={logOut}>{t('Log out')}</button></div>
  </main>;
}
