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
  const [notice,setNotice]=useState('');

  const date=value=>value?new Date(value).toLocaleString(language==='uk'?'uk-UA':'en-US',{
    dateStyle:'medium',timeStyle:'short',
  }):'';

  async function refresh(){
    if(!auth?.token)return;
    try{
      const result=await api('/auth/ban-status',{token:auth.token});
      setAppeal(result.data.appeal);
      if(result.data.appeal)setNotice('');
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
    setBusy(true);setError(null);setNotice('');
    try{
      await api('/auth/ban-appeal',{
        method:'POST',token:auth.token,body:{explanation:text},
      });
      setText('');
      await refresh();
    }catch(err){setError(err);}finally{setBusy(false);}
  }

  function logOut(){
    dispatch({type:'AUTH_CLEAR'});
    go('/login');
  }

  if(!auth)return <main className="banPage">
    <h1>{t('Sign in to view your account status.')}</h1>
    <button className="primary" onClick={()=>go('/login')}>{t('Log in')}</button>
  </main>;

  const appealPending=appeal?.status==='pending';
  return <main className="banPage banStudioPage">
    <div className="banStudioLayout">
      <section className="banStudioVisual" aria-labelledby="ban-page-title">
        <div className="banStudioBrand" aria-hidden="true"><span className="banBrandRing">◎</span> circle</div>
        <div className="banStudioArt" aria-hidden="true">
          <span className="banArtHalo"/>
          <span className="banArtDisc"/>
          <span className="banArtOrbit banArtOrbitOne"/>
          <span className="banArtOrbit banArtOrbitTwo"/>
          <span className="banArtGlass"><Icon name="lock" size={60}/></span>
        </div>
        <div className="banStudioMessage">
          <span className="banStatusBadge"><span aria-hidden="true" className="banStatusDot"/>
            {t('Access restricted')}</span>
          <h1 id="ban-page-title">{t('Account blocked')}</h1>
        </div>
      </section>

      <section className="banStudioContent" aria-label={t('Account restriction details')}>
        <div className="banStudioReason">
          <span className="banStudioLabel">{t('Official reason')}</span>
          <p className="banStudioReasonText">{auth.user?.ban_reason ||
            t('Account access has been restricted by an administrator.')}</p>
          {auth.user?.banned_at&&
            <time className="banStudioTime" dateTime={auth.user.banned_at}>
              {t('Blocked on')} · {date(auth.user.banned_at)}
            </time>}
        </div>
        <div className="banStudioAppeal">
          {initialLoading
            ? <p role="status" className="banStudioLoading">{t('Loading…')}</p>
            : appeal
              ? <>
                <div className="banStudioAppealHead">
                  <h2>{t('Your appeal')}</h2>
                  <span className={'banAppealStatus banAppealStatus-'+appeal.status}>
                    <span className="banAppealStatusDot" aria-hidden="true"/>{t(appeal.status)}
                  </span>
                </div>
                <p className="banStudioExplanation">{appeal.explanation}</p>
                {appeal.review_note&&<p className="banStudioReviewNote">
                  <strong>{t('Admin response')}</strong>{appeal.review_note}
                </p>}
                <time className="banStudioTime" dateTime={appeal.created_at}>
                  {t('Submitted')} · {date(appeal.created_at)}
                </time>
              </>
              : <form className="banAppealForm banStudioForm" onSubmit={submit}>
                <h2>{t('Appeal this decision')}</h2>
                <label htmlFor="ban-appeal-text">{t('Your appeal')}</label>
                <textarea id="ban-appeal-text" value={text}
                  onChange={event=>setText(event.target.value)}
                  minLength={5} maxLength={4000} required
                  placeholder={t('Explain why you believe this restriction should be reconsidered…')}/>
                <div className="banStudioSubmitRow">
                  <span>{text.length} / 4000</span>
                  <button type="submit" className="primary" disabled={busy||text.trim().length<5}>
                    {t(busy?'Sending…':'Submit appeal')} <Icon name="arrow" size={17}/>
                  </button>
                </div>
              </form>}
        </div>
        {notice&&<p role="status" className="banStudioNotice">{notice}</p>}
        <ErrorBox error={error}/>
        <div className="banUtility banStudioActions">
          <button type="button" onClick={refresh} disabled={busy}>
            <Icon name="refresh" size={17}/> {t('Refresh status')}
          </button>
          <button type="button" onClick={logOut}>{t('Log out')}</button>
        </div>
      </section>
    </div>
  </main>;
}
