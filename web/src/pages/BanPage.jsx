import React,{useEffect,useState} from 'react';
import {useDispatch,useSelector} from 'react-redux';
import {api} from '../api.js';
import {ErrorBox,go} from '../ui.jsx';

export default function BanPage(){
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
      setNotice('Your appeal was received. An administrator will review it.');
      setText('');
      await refresh();
    }catch(err){setError(err);}finally{setBusy(false);}
  }

  function logOut(){
    dispatch({type:'AUTH_CLEAR'});
    go('/login');
  }

  if(!auth)return <main className="banPage"><h1>Sign in to view your account status.</h1><button onClick={()=>go('/login')}>Log in</button></main>;
  return <main className="banPage">
    <div className="banSymbol" aria-hidden="true">✳</div>
    <span className="interestEyebrow">CIRCLE / ACCOUNT STATUS</span>
    <h1>Your account has been restricted.</h1>
    <p className="banLead">You can't access Circle while this restriction is active. You can still send an appeal for review.</p>
    <section className="banReasonCard">
      <span>Official reason</span>
      <p>{auth.user?.ban_reason || 'Account access has been restricted by an administrator.'}</p>
      {auth.user?.banned_at&&<small>Restricted on {new Date(auth.user.banned_at).toLocaleString()}</small>}
    </section>
    {appeal ? <section className="appealState">
      <h2>Appeal {appeal.status}</h2>
      <p>{appeal.explanation}</p>
      {appeal.review_note&&<p>Admin response: {appeal.review_note}</p>}
      <small>Submitted {new Date(appeal.created_at).toLocaleString()}</small>
    </section> : <form className="banAppealForm" onSubmit={submit}>
      <h2>Tell us what happened</h2>
      <label>Your appeal
        <textarea value={text} onChange={e=>setText(e.target.value)}
          minLength={5} maxLength={4000} required placeholder="Explain why you believe this restriction should be reconsidered…"/>
      </label>
      <button className="primary" disabled={busy}>Submit appeal →</button>
    </form>}
    {notice&&<p role="status">{notice}</p>}
    <ErrorBox error={error}/>
    <div className="banUtility"><button type="button" onClick={refresh}>Refresh status</button>
      <button type="button" onClick={logOut}>Log out</button></div>
  </main>;
}
