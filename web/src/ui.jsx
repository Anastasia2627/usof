import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, assetUrl } from './api.js';
import { useI18n } from './i18n.jsx';

export const go = (path) => { window.location.hash = path; };
export const fmt = (value) => value ? new Date(value).toLocaleString() : '—';

export function Icon({ name, filled = false, className = '', title }) {
  return <span
    className={`material-symbols-rounded ${className}`}
    aria-hidden={title ? undefined : 'true'}
    title={title}
    style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500, 'GRAD' 0, 'opsz' 24` }}
  >{name}</span>;
}

export function trustName(value) {
  const rating = Number(value || 0);
  if (rating >= 150) return 'Mentor';
  if (rating >= 75) return 'Expert';
  if (rating >= 30) return 'Trusted';
  if (rating >= 10) return 'Contributor';
  return 'Newcomer';
}

export function TrustBadge({ rating }) {
  const name = trustName(rating);
  return <span className={`trustBadge ${name.toLowerCase()}`} title={`${Number(rating || 0)} reputation`}>{name}</span>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="card alert error" role="alert"><Icon name="error" filled /> <span>{error.message || String(error)}</span></div>;
}

export function Avatar({ user, size = 'md' }) {
  if (user?.avatar) {
    return <img className={`avatar avatar-${size}`} src={assetUrl(user.avatar)} alt={`${user.login} avatar`} />;
  }
  return <span className={`avatar avatar-${size} avatar-fallback`} aria-hidden="true">{(user?.login || '?').slice(0, 1).toUpperCase()}</span>;
}

export function StatusBadges({ item }) {
  return <span className="badges">
    {item.status && <span className={`badge ${item.status}`}>{item.status}</span>}
    {Boolean(item.locked) && <span className="badge locked">locked</span>}
  </span>;
}

function topicTone(index) {
  return `tone-${(index % 4) + 1}`;
}

export function PostCard({ post, featured = false, interactive = true }) {
  const categories = post.categories || [];
  const open = interactive ? () => go(`/post/${post.id}`) : undefined;
  return <article
    className={`threadCard ${featured ? 'featured' : ''} ${interactive ? '' : 'previewOnly'}`}
    onClick={open}
    tabIndex={interactive ? 0 : undefined}
    onKeyDown={interactive ? (event) => { if (event.key === 'Enter') open(); } : undefined}
    aria-disabled={interactive ? undefined : 'true'}
  >
    <div className="threadTopline">
      <div className="threadAuthor">
        <Avatar user={{ login: post.author_login, avatar: post.author_avatar }} size="sm" />
        <span>
          <strong>{post.author_login}</strong>
          <small>{fmt(post.created_at)}</small>
        </span>
      </div>
      <div className="threadScore" title="Thread score">
        <Icon name="arrow_upward" />
        <strong>{Number(post.score || 0)}</strong>
      </div>
    </div>
    <div className="threadBody">
      <div className="threadTags">
        {categories.slice(0, 4).map((category, index) => <span className={topicTone(index)} key={category.id}>#{category.title}</span>)}
        <StatusBadges item={post} />
      </div>
      <h2>{post.title}</h2>
      <p>{post.content?.slice(0, featured ? 260 : 190)}{post.content?.length > (featured ? 260 : 190) ? '…' : ''}</p>
    </div>
    <div className="threadFooter">
      <div className="threadMetrics">
        <span><Icon name="chat_bubble" /> {post.comment_count ?? 0}</span>
        <span><Icon name="favorite" /> {post.like_count ?? 0}</span>
        <span><Icon name="bookmark" /> {post.favorite_count ?? 0}</span>
      </div>
      {interactive && <span className="openThread">Open thread <Icon name="arrow_outward" /></span>}
    </div>
  </article>;
}

export function Header() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!auth?.token) {
      setUnread(0);
      return undefined;
    }
    let active = true;
    async function refresh() {
      try {
        const result = await api('/notifications?unread=1&limit=1', { token: auth.token });
        if (active) setUnread(Number(result.unreadCount || 0));
      } catch {
        if (active) setUnread(0);
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener('usof:notifications', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('usof:notifications', refresh);
    };
  }, [auth?.token]);

  async function logout() {
    try {
      if (auth?.token) await api('/auth/logout', { method: 'POST', token: auth.token });
    } catch {
      // A stale server token must never keep the local session alive.
    } finally {
      dispatch({ type: 'AUTH_CLEAR' });
      go('/');
    }
  }

  return <header className="siteHeader">
    <button className="brand" onClick={() => go('/')} aria-label="Circle home">
      <span className="brandMark">c</span><span className="brandWord">circle</span>
    </button>

    <form className="headerSearch" onSubmit={(event) => {
      event.preventDefault();
      const query = search.trim();
      go(query ? `/?search=${encodeURIComponent(query)}` : '/');
    }}>
      <Icon name="search" />
      <label className="srOnly" htmlFor="site-search">Search Circle</label>
      <input id="site-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} />
      {search && <button type="button" className="searchClear" onClick={() => setSearch('')} aria-label="Clear search"><Icon name="close" /></button>}
    </form>

    <nav className="mainNav" aria-label="Main navigation">
      <button onClick={() => go('/')}><Icon name="home" /> <span>{t('home')}</span></button>
      <button onClick={() => go('/categories')}><Icon name="explore" /> <span>{t('explore')}</span></button>
      {auth && <button onClick={() => go('/following')}><Icon name="group" /> <span>{t('following')}</span></button>}
      {auth && <button onClick={() => go('/saved')}><Icon name="bookmark" /> <span>{t('saved')}</span></button>}
      {auth && <button onClick={() => go('/messages')}><Icon name="forum" /> <span>{t('messages')}</span></button>}
    </nav>

    <div className="accountArea">
      {auth ? <>
        <button className="composeButton" onClick={() => go('/create')}><Icon name="add" /> <span>{t('startThread')}</span></button>
        <button className="notificationButton" onClick={() => go('/notifications')} aria-label={`${unread} unread notifications`}>
          <Icon name="notifications" filled={unread > 0} />
          {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
        </button>
        <button className="profileButton" onClick={() => go('/profile')}>
          <Avatar user={auth.user} size="sm" />
          <span><small>@{auth.user.login}</small>{auth.user.full_name || auth.user.login}</span>
        </button>
        {auth.user.role === 'admin' && <button className="iconButton desktopOnly" onClick={() => go('/admin/dashboard')} aria-label="Admin"><Icon name="shield_person" /></button>}
        <button className="iconButton desktopOnly" onClick={logout} aria-label={t('logout')}><Icon name="logout" /></button>
      </> : <>
        <button className="quietButton" onClick={() => go('/login')}>{t('login')}</button>
        <button className="primary compact" onClick={() => go('/register')}>{t('signup')}</button>
      </>}
    </div>
  </header>;
}
