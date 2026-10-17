import React,{useEffect,useState} from 'react';
import {useSelector} from 'react-redux';
import {api} from '../api.js';
import {Avatar,ErrorBox,Icon,fmt,go} from '../ui.jsx';

export default function MessagesPage({userId}){
  const auth=useSelector(state=>state.auth);
  const [users,setUsers]=useState([]),[conversation,setConversation]=useState(null);
  const [text,setText]=useState(''),[error,setError]=useState(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
  async function loadInbox(){
    try{const r=await api('/social/conversations',{token:auth.token});setUsers(r.data);}catch(e){setError(e);}
  }
  async function loadMessages(){
    if(!userId)return;
    setLoading(true);
    try{const r=await api('/social/messages/'+userId,{token:auth.token});setConversation(r.data);setError(null);}
    catch(e){setError(e);}finally{setLoading(false);}
  }
  useEffect(()=>{if(auth?.token)loadInbox()},[auth?.token]);
  useEffect(()=>{if(auth?.token)loadMessages()},[auth?.token,userId]);
  async function send(e){
    e.preventDefault();
    if(!text.trim())return;
    setBusy(true);setError(null);
    try{
      await api('/social/messages/'+userId,{method:'POST',token:auth.token,body:{content:text}});
      setText('');await loadMessages();await loadInbox();
    }catch(e){setError(e);}finally{setBusy(false);}
  }
  if(!auth)return <main className="simpleFeaturePage"><button onClick={()=>go('/login')}>Log in to message people</button></main>;
  return <main className="socialPage messagesPage">
    <div className="socialHeading"><Icon name="comment" size={24}/><h1>Messages</h1></div>
    <div className="messageLayout">
      <aside className="messageContacts" aria-label="Conversations">
        <h2>Your conversations</h2>
        {users.length?users.map(u=><button key={u.id} type="button" className={String(u.id)===String(userId)?'selectedContact':''}
          onClick={()=>go('/messages/'+u.id)}>
          <Avatar user={u} size="sm"/><span><strong>{u.login}</strong><small>{u.last_message}</small></span>
          {Number(u.unread)>0&&<b className="unreadCount">{u.unread}</b>}
        </button>):<p>No conversations yet</p>}
      </aside>
      <section className="messageThread" aria-label="Direct messages">
        {userId?<><header className="messageThreadHeading" onClick={()=>go('/profile/'+userId)}>
          <Avatar user={conversation?.user} size="sm"/><strong>{conversation?.user?.login||'Conversation'}</strong>
        </header>
          <div className="messageStream" aria-live="polite">
            {loading?<p>Loading conversation…</p>:
              conversation?.messages?.map(m=><div key={m.id} className={'messageBubble '+(Number(m.sender_id)===Number(auth.user.id)?'mine':'theirs')}>
                <p>{m.content}</p><time dateTime={m.created_at}>{fmt(m.created_at)}</time>
              </div>)}
          </div>
          <form className="messageCompose" onSubmit={send}>
            <label className="srOnly" htmlFor="message-text">Your message</label>
            <input id="message-text" maxLength="2000" placeholder="Write a message…" value={text}
              onChange={e=>setText(e.target.value)} required/>
            <button disabled={busy||!text.trim()} className="primary" aria-label="Send message"><Icon name="arrow" size={20}/></button>
          </form></>:<p className="messageIntro">Select a conversation or open a person's profile to start talking</p>}
      </section>
    </div><ErrorBox error={error}/>
  </main>;
}
