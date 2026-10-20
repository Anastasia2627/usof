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
  const [showAppeal,setShowAppeal]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(null);

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
      setShowAppeal(false);
      await refresh();
    }catch(err){setError(err);}
    finally{setBusy(false);}
  }

  function logOut(){
    dispatch({type:'AUTH_CLEAR'});
    go('/login');
  }


  const isUkrainian = language === 'uk';
  const reason = auth?.user?.ban_reason ||
    (isUkrainian ? 'Причину не вказано' : 'No reason provided');

  if(!auth) return <main className="circleBlockedHeroPage circleBlockedSignedOut">
    <h1>{t('Sign in to view your account status.')}</h1>
    <button type="button" onClick={()=>go('/login')}>{t('Log in')}</button>
  </main>;

  return <main className="circleBlockedHeroPage">
    <img
      className="circleBlockedHeroImage"
      src="/images/Frame%202072750582.png"
      alt=""
      fetchPriority="high"
      decoding="async"
    />
    <section className="circleBlockedHeroOverlay" aria-labelledby="restriction-title">
      <div className="circleBlockedHeroContent">
        <h1 id="restriction-title">{t('Account blocked')}</h1>
        <p className="circleBlockedHeroReason">
          <span>{isUkrainian ? 'Причина:' : 'Reason:'}</span> {reason}
        </p>

        {initialLoading ? <p className="circleBlockedHeroLoading" role="status">{t('Loading…')}</p>
          : appeal ? <>
            <p className="circleBlockedHeroAppealStatus">
              <span>{isUkrainian ? 'Оскарження:' : 'Appeal:'}</span>
              <strong className={`circleBlockedHeroStatus circleBlockedHeroStatus--${appeal.status}`}>
                {t(appeal.status)}
              </strong>
            </p>
            {appeal.review_note && <details className="circleBlockedHeroReview">
              <summary>{t('Admin response')}</summary>
              <p>{appeal.review_note}</p>
            </details>}
          </> : !showAppeal ? <button className="circleBlockedHeroAppealButton" type="button"
              onClick={()=>setShowAppeal(true)}>
              {t('Submit appeal')}
            </button> : <form className="circleBlockedHeroForm" onSubmit={submit}>
              <label htmlFor="banAppealInput">{t('Appeal this decision')}</label>
              <div className="circleBlockedAppealField">
                <textarea id="banAppealInput" required minLength={5} maxLength={4000}
                  rows={3} value={text} onChange={event=>setText(event.target.value)}
                  placeholder={isUkrainian ? 'Напишіть, чому ви не погоджуєтеся з блокуванням…' : 'Tell us why you disagree with this decision…'}/>
                <div className="circleBlockedAppealFieldFooter">
                  <Icon name="edit" size={15}/>
                  <span>{text.length}/4000</span>
                </div>
              </div>
              <div className="circleBlockedHeroFormActions">
                <button type="button" onClick={()=>setShowAppeal(false)}
                  disabled={busy}>{isUkrainian ? 'Скасувати' : 'Cancel'}</button>
                <button type="submit" disabled={busy || text.trim().length < 5}>
                  {t(busy ? 'Sending…' : 'Submit appeal')}
                </button>
              </div>
            </form>}
        <ErrorBox error={error}/>
        <div className="circleBlockedHeroActions">
          <button type="button" onClick={refresh} disabled={busy || initialLoading}>
            {t('Refresh status')}
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={logOut}>{t('Log out')}</button>
        </div>
      </div>
    </section>
  </main>;
}
