import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, fmt, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

function announceChange() {
  window.dispatchEvent(new Event('usof:notifications'));
}

export default function NotificationsPage() {
  const auth = useSelector((state) => state.auth);
  const {t}=usePreferences();
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
      <div><p className="eyebrow">{t('Inbox')}</p><h1>{t('Notifications')}</h1><p>{unreadCount} {t('unread')}</p></div>
      <div className="toolbar"><label className="check"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />{t('Unread only')}</label><button className="secondary" disabled={!unreadCount} onClick={markAllRead}>{t('Mark all read')}</button></div>
    </div>
    <ErrorBox error={error} />
    {loading
      ? <div className="card loading">{t('Loading notifications…')}</div>
      : items.length
        ? <section className="notificationList">{items.map((item) => <article className={`card notification ${item.read_at ? '' : 'unread'}`} key={item.id}>
          <button className="notificationBody" onClick={() => openItem(item)}>
            <span className="notificationDot" aria-hidden="true" />
            <span><strong>{t(item.title)}</strong><small>{t(item.body)}</small><small>{fmt(item.created_at)}</small></span>
          </button>
          <button className="quietButton dangerText" aria-label="Delete notification" onClick={() => remove(item)}>{t('Delete')}</button>
        </article>)}</section>
        : <div className="card empty"><h2>{t('No notifications.')}</h2><p>{t(unreadOnly ? 'You have read everything.' : 'Updates from followed posts and your contributions will appear here.')}</p></div>}
  </main>;
}
