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


  const blockedCopy = language === 'uk'
    ? 'Доступ до вашого акаунта обмежено. Нижче можна переглянути причину та оскаржити рішення.'
    : 'Access to your account has been restricted. You can review the reason and appeal below.';
  const detailsLabel = language === 'uk' ? 'Переглянути деталі' : 'View details';
  const refreshLabel = t('Refresh status');

  if (!auth) return <main className="circleBlockedPage circleBlockedLoggedOut">
    <h1>{t('Sign in to view your account status.')}</h1>
    <button type="button" onClick={() => go('/login')} className="circleBlockedPrimary">
      {t('Log in')}
    </button>
  </main>;

  return <main className="circleBlockedPage">
    <section className="circleBlockedIntro" aria-labelledby="restriction-title">
      <div className="circleBlockedArtwork">
        <img src="/images/Frame%202072750582.png" alt="" decoding="async" fetchPriority="high"/>
      </div>
      <div className="circleBlockedIntroText">
        <h1 id="restriction-title">{t('Account blocked')}</h1>
        <p>{blockedCopy}</p>
        <a className="circleBlockedPrimary" href="#circleBlockedDetails">
          {detailsLabel}<span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>

    <section id="circleBlockedDetails" className="circleBlockedDetails"
      aria-label={t('Account restriction details')}>
      <div className="circleBlockedReason">
        <span className="circleBlockedLabel">{t('Official reason')}</span>
        <h2>{auth.user?.ban_reason || t('Account access has been restricted by an administrator.')}</h2>
        {auth.user?.banned_at && <time dateTime={auth.user.banned_at}>
          {t('Blocked on')} · {formatDate(auth.user.banned_at)}
        </time>}
      </div>
      <div className="circleBlockedAppeal">
        {initialLoading ? <p className="circleBlockedLoading" role="status">{t('Loading…')}</p>
          : appeal ? <div className="circleBlockedAppealReview">
            <div className="circleBlockedStatusLine">
              <h2>{t('Your appeal')}</h2>
              <span className={`circleBlockedStatus circleBlockedStatus--${appeal.status}`}>
                {t(appeal.status)}
              </span>
            </div>
            <p className="circleBlockedExplanation">{appeal.explanation}</p>
            {appeal.review_note && <div className="circleBlockedReviewNote">
              <strong>{t('Admin response')}</strong>
              <p>{appeal.review_note}</p>
            </div>}
            <time dateTime={appeal.created_at}>{t('Submitted')} · {formatDate(appeal.created_at)}</time>
          </div> : <form className="circleBlockedAppealForm" onSubmit={submit}>
            <h2>{t('Appeal this decision')}</h2>
            <label className="srOnly" htmlFor="banAppealInput">{t('Your appeal')}</label>
            <textarea id="banAppealInput" required minLength={5} maxLength={4000}
              rows="4" value={text} onChange={event => setText(event.target.value)}
              placeholder={t('Explain why you believe this restriction should be reconsidered…')}/>
            <div className="circleBlockedFormActions">
              <span>{text.length}/4000</span>
              <button type="submit" className="circleBlockedPrimary"
                disabled={busy || initialLoading || text.trim().length < 5}>
                {t(busy ? 'Sending…' : 'Submit appeal')}
              </button>
            </div>
          </form>}
        <ErrorBox error={error}/>
      </div>
    </section>
    <div className="circleBlockedFooter">
      <button type="button" onClick={refresh} disabled={busy || initialLoading}>
        <Icon name="refresh" size={17}/>{refreshLabel}
      </button>
      <button type="button" onClick={logOut}>{t('Log out')}</button>
    </div>
  </main>;
}
