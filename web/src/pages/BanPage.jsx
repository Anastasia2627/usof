import React,{useEffect,useState} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,Icon,go} from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

export default function BanPage(){
  const {t,language}=usePreferences();
  const auth=useSelector(state=>state.auth);
  const dispatch=useDispatch();
  const [appeal,setAppeal]=useState(null);
  const [initialLoading,setInitialLoading]=useState(true);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);

  const formatDate=value=>value?new Date(value).toLocaleString(
    language==='uk'?'uk-UA':'en-US',{dateStyle:'medium',timeStyle:'short'}):'';

  async function refresh(){
    if(!auth?.token)return;
    try{
      const result=await api('/auth/ban-status',{token:auth.token});
      setAppeal(result.data.appeal);
      const fresh=result.data.user;
      if(!fresh.banned_at){
        dispatch({type:'AUTH_USER_SET',payload:fresh});
        go('/');
      }else if(['login','full_name','email','avatar','role','banned_at','ban_reason'].some(
        key=>String(fresh[key]??'')!==String(auth.user?.[key]??''))){
        dispatch({type:'AUTH_USER_SET',payload:fresh});
      }
      setError(null);
    }catch(err){setError(err);}
    finally{setInitialLoading(false);}
  }

  useEffect(()=>{
    if(!auth?.token)return;
    refresh();
    const timer=window.setInterval(refresh,15000);
    return()=>window.clearInterval(timer);
  },[auth?.token]);

  async function submit(event){
    event.preventDefault();
    if(busy||initialLoading)return;
    setBusy(true);setError(null);
    try{
      await api('/auth/ban-appeal',{
        method:'POST',token:auth.token,body:{explanation:text},
      });
      setText('');
      await refresh();
    }catch(err){setError(err);}
    finally{setBusy(false);}
  }

  function logOut(){
    dispatch({type:'AUTH_CLEAR'});
    go('/login');
  }

  if(!auth)return <main className="banPage banNightPage">
    <h1>{t('Sign in to view your account status.')}</h1>
    <button className="primary" onClick={()=>go('/login')}>{t('Log in')}</button>
  </main>;

  return <main className="banPage banNightPage">
    <section className="banNightStage" aria-labelledby="banNightTitle">
      <div className="banNightLight banNightLightLeft" aria-hidden="true"/>
      <div className="banNightLight banNightLightRight" aria-hidden="true"/>
      <div className="banNightBrand" aria-hidden="true"><span>◎</span> circle</div>

      <div className="banNightHeading">
        <h1 id="banNightTitle">{t('Account blocked')}</h1>
      </div>

      <div className="banNightWord" aria-hidden="true">circle</div>

      <section className="banNightPanel" aria-label={t('Account restriction details')}>
        <div className="banNightPanelTop">
          <span className="banNightPanelBrand">circle</span>
          <span className="banNightPanelStatus">
            <span aria-hidden="true" className="banNightStatusDot"/>
            {t('Access restricted')}
          </span>
        </div>
        <div className="banNightReason">
          <span className="banNightLabel">{t('Official reason')}</span>
          <h2>{auth.user?.ban_reason||
            t('Account access has been restricted by an administrator.')}</h2>
          {auth.user?.banned_at&&<time dateTime={auth.user.banned_at}>
            {t('Blocked on')} · {formatDate(auth.user.banned_at)}
          </time>}
        </div>
        <div className="banNightAppeal">
          {initialLoading
            ? <p role="status" className="banNightLoading">{t('Loading…')}</p>
            : appeal
              ? <>
                <div className="banNightAppealTitle">
                  <h3>{t('Your appeal')}</h3>
                  <span className={'banNightAppealBadge banNightAppealBadge-'+appeal.status}>
                    {t(appeal.status)}
                  </span>
                </div>
                <p className="banNightExplanation">{appeal.explanation}</p>
                {appeal.review_note&&<p className="banNightDecision">
                  <strong>{t('Admin response')}</strong> {appeal.review_note}
                </p>}
                <time className="banNightTime" dateTime={appeal.created_at}>
                  {t('Submitted')} · {formatDate(appeal.created_at)}
                </time>
              </>
              : <form onSubmit={submit} className="banNightForm">
                <h3>{t('Appeal this decision')}</h3>
                <label htmlFor="banNightAppealInput">{t('Your appeal')}</label>
                <textarea id="banNightAppealInput" value={text}
                  onChange={event=>setText(event.target.value)}
                  minLength={5} maxLength={4000} required
                  placeholder={t('Explain why you believe this restriction should be reconsidered…')}/>
                <div className="banNightFormActions">
                  <span>{text.length}/4000</span>
                  <button className="primary" type="submit" disabled={busy||text.trim().length<5}>
                    {t(busy?'Sending…':'Submit appeal')} <Icon name="arrow" size={16}/>
                  </button>
                </div>
              </form>}
        </div>
        <ErrorBox error={error}/>
        <div className="banNightPanelFooter">
          <button type="button" onClick={refresh} disabled={busy}>
            <Icon name="refresh" size={16}/>{t('Refresh status')}
          </button>
          <button type="button" onClick={logOut}>{t('Log out')}</button>
        </div>
      </section>
    </section>
  </main>;
}
