import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, fmt, go } from '../ui.jsx';

function announceChange() {
  window.dispatchEvent(new Event('usof:notifications'));
}

export default function NotificationsPage() {
  const auth = useSelector((state) => state.auth);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (!auth) return <main className="narrow"><div className="card empty"><h1>Notifications</h1><p>Log in to see updates from your discussions.</p><button className="primary" onClick={() => go('/login')}>Log in</button></div></main>;

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
    try {
      await api('/notifications/read-all', { method: 'PATCH', token: auth.token });
      announceChange();
      await load();
    } catch (err) {
      setError(err);
    }
  }

  async function remove(item) {
    try {
      await api(`/notifications/${item.id}`, { method: 'DELETE', token: auth.token });
      announceChange();
      await load();
    } catch (err) {
      setError(err);
    }
  }

  return <main>
    <div className="sectionTitle">
      <div><p className="eyebrow">Inbox</p><h1>Notifications</h1><p>{unreadCount} unread</p></div>
      <div className="toolbar"><label className="check"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />Unread only</label><button className="secondary" disabled={!unreadCount} onClick={markAllRead}>Mark all read</button></div>
    </div>
    <ErrorBox error={error} />
    {loading
      ? <div className="card loading">Loading notifications…</div>
      : items.length
        ? <section className="notificationList">{items.map((item) => <article className={`card notification ${item.read_at ? '' : 'unread'}`} key={item.id}>
          <button className="notificationBody" onClick={() => openItem(item)}>
            <span className="notificationDot" aria-hidden="true" />
            <span><strong>{item.title}</strong><small>{item.body}</small><small>{fmt(item.created_at)}</small></span>
          </button>
          <button className="quietButton dangerText" aria-label="Delete notification" onClick={() => remove(item)}>Delete</button>
        </article>)}</section>
        : <div className="card empty"><h2>No notifications.</h2><p>{unreadOnly ? 'You have read everything.' : 'Updates from followed questions and your contributions will appear here.'}</p></div>}
  </main>;
}
