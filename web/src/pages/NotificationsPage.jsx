import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, Icon, fmt, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

function announceChange() {
  window.dispatchEvent(new Event('usof:notifications'));
}

// The API stores stable English event strings. Translate only recognized
// server-generated patterns, leaving custom notification text untouched.
function notificationBodyText(body,t) {
  const value=String(body||'');
  const match=value.match(/^(.+?) (added an answer to your question\.|added a reply to your question\.|replied to your comment\.|reacted to your question\.|reacted to your answer\.|updated a question you follow\.|added a reply to a question you follow\.|added an answer to a question you follow\.)$/);
  return match ? match[1]+' '+t(match[2]) : t(value);
}

export default function NotificationsPage() {
  const auth = useSelector((state) => state.auth);
  const {t}=usePreferences();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [contextMenu,setContextMenu] = useState(null);
  const menuRef=useRef(null);
  const longPressRef=useRef(null);
  useEffect(()=>{
    if(!contextMenu)return;
    function close(event){
      if(event.type==='keydown' && event.key!=='Escape')return;
      if(event.type==='pointerdown' && menuRef.current?.contains(event.target))return;
      setContextMenu(null);
    }
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',close);
    return()=>{
      document.removeEventListener('pointerdown',close);
      document.removeEventListener('keydown',close);
    };
  },[contextMenu]);
  useEffect(()=>()=>{if(longPressRef.current)window.clearTimeout(longPressRef.current);},[]);

  function openContextMenu(event,item) {
    event.preventDefault();
    const rect=event.currentTarget.getBoundingClientRect();
    const x=typeof event.clientX==='number'&&event.clientX>0?event.clientX:rect.right-25;
    const y=typeof event.clientY==='number'&&event.clientY>0?event.clientY:rect.top+22;
    setContextMenu({id:item.id,
      x:Math.max(10,Math.min(x,window.innerWidth-195)),
      y:Math.max(10,Math.min(y,window.innerHeight-85))});
  }
  function stopLongPress() {
    if(longPressRef.current)window.clearTimeout(longPressRef.current);
    longPressRef.current=null;
  }
  function startLongPress(event,item) {
    stopLongPress();
    const touch=event.touches?.[0];
    if(!touch)return;
    const x=touch.clientX,y=touch.clientY;
    longPressRef.current=window.setTimeout(()=>{
      setContextMenu({id:item.id,
        x:Math.max(10,Math.min(x,window.innerWidth-195)),
        y:Math.max(10,Math.min(y,window.innerHeight-85))});
      longPressRef.current=null;
    },650);
  }

  async function load() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api(`/notifications?limit=50${unreadOnly ? '&unread=1' : ''}`, { token: auth.token });
      setItems(result.data);
      setUnreadCount(result.unreadCount || 0);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    load();
  }, [auth?.token, unreadOnly]);

  if (!auth) return <main className="narrow"><div className="card empty"><h1>{t('Notifications')}</h1><p>{t('Log in to see updates from your discussions.')}</p><button className="primary" onClick={() => go('/login')}>{t('Log in')}</button></div></main>;

  async function openItem(item) {
    try {
      if (!item.read_at) {
        await api(`/notifications/${item.id}/read`, { method: 'PATCH', token: auth.token });
        announceChange();
      }
      if (item.post_id) go(`/post/${item.post_id}`);
      else await load();
    } catch (err) {
      setError(err);
    }
  }

  async function markAllRead() {
    if (busy || !unreadCount) return;
    setBusy(true);
    try {
      await api('/notifications/read-all', { method: 'PATCH', token: auth.token });
      announceChange();
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item) {
    if (busy || !window.confirm(t('Delete this notification?'))) return;
    setContextMenu(null);
    setBusy(true);
    try {
      await api(`/notifications/${item.id}`, { method: 'DELETE', token: auth.token });
      announceChange();
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return <main className="notificationsPage">
    <header className="notificationsHeader">
      <div className="notificationsHeading">
        <h1>{t('Notifications')}</h1>
        <p>{unreadCount > 0 ? `${unreadCount} ${t('unread')}` : t('All caught up')}</p>
      </div>
      <div className="notificationsToolbar" aria-label={t('Notification filters')}>
        <button type="button" className={'notificationsUnreadToggle'+(unreadOnly?' isSelected':'')}
          aria-pressed={unreadOnly} onClick={() => setUnreadOnly(value => !value)}>
          {unreadOnly && <Icon name="check" size={17}/>}
          <span>{t('Unread only')}</span>
        </button>
        <button type="button" className="notificationsMarkAll" disabled={!unreadCount || busy}
          onClick={markAllRead}><Icon name="check" size={17}/><span>{t('Mark all read')}</span></button>
      </div>
    </header>
    <ErrorBox error={error} />
    {loading
      ? <p className="notificationsLoading" role="status">{t('Loading notifications…')}</p>
      : items.length
        ? <section className="notificationList" aria-label={t('Notifications')}>
          {items.map(item => <article
            className={'notificationItem'+(item.read_at?'':' unread')} key={item.id}
            tabIndex={0} aria-label={t(item.title)+'. '+t('Right-click for options')}
            onContextMenu={event=>openContextMenu(event,item)}
            onKeyDown={event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))
              openContextMenu(event,item);}}
            onTouchStart={event=>startLongPress(event,item)}
            onTouchMove={stopLongPress} onTouchEnd={stopLongPress} onTouchCancel={stopLongPress}>
            <span className="notificationDot" aria-hidden="true" />
            <button type="button" className="notificationMain"
              onClick={() => openItem(item)} aria-label={t(item.title)}>
              <strong className="notificationTitle">{t(item.title)}</strong>
              <span className="notificationDescription">{notificationBodyText(item.body,t)}</span>
              <time className="notificationTime" dateTime={item.created_at}>{fmt(item.created_at)}</time>
            </button>
            <span className="notificationRightHint" aria-hidden="true">···</span>
          </article>)}
        </section>
        : <div className="notificationsEmpty" role="status">
            <span className="notificationsEmptyIcon"><Icon name="check" size={25}/></span>
            <h2>{t('No notifications.')}</h2>
            <p>{t(unreadOnly ? 'You have read everything.' : 'Updates from followed posts and your contributions will appear here.')}</p>
            {unreadOnly && <button type="button" onClick={() => setUnreadOnly(false)}>{t('Show all')}</button>}
          </div>}
    {contextMenu && <div className="notificationContextMenu" role="menu" ref={menuRef}
      style={{left:contextMenu.x,top:contextMenu.y}}>
      <button type="button" role="menuitem" disabled={busy} onClick={()=>{
        const selected=items.find(item=>item.id===contextMenu.id);
        if(selected)remove(selected);
      }}><Icon name="trash" size={16}/>{t('Delete notification')}</button>
    </div>}
  </main>;
}
