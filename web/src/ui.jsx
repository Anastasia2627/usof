import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, assetUrl } from './api.js';

export const go = (path) => { window.location.hash = path; };
export const fmt = (value) => value ? new Date(value).toLocaleString() : '—';

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="card alert error" role="alert">{error.message || String(error)}</div>;
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

export function PostCard({ post }) {
  return <article
    className="card postCard"
    onClick={() => go(`/post/${post.id}`)}
    tabIndex="0"
    onKeyDown={(event) => { if (event.key === 'Enter') go(`/post/${post.id}`); }}
  >
    <div className="scoreBox">{Number(post.score) > 0 ? '+' : ''}{post.score || 0}</div>
    <div>
      <div className="postMeta">
        <span>{post.author_login}</span><span>·</span><span>{fmt(post.created_at)}</span>
        <StatusBadges item={post} />
      </div>
      <h2>{post.title}</h2>
      <p>{post.content?.slice(0, 190)}{post.content?.length > 190 ? '…' : ''}</p>
      <div className="postCardBottom">
        <div className="tags">{post.categories?.map((category) => <span key={category.id}>{category.title}</span>)}</div>
        <div className="postMetrics">
          {post.like_count !== undefined && <span>{post.like_count} likes</span>}
          {post.comment_count !== undefined && <span>{post.comment_count} answers</span>}
          {post.favorite_count !== undefined && <span>{post.favorite_count} saved</span>}
        </div>
      </div>
    </div>
  </article>;
}

export function Header() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
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
      // The local session still needs to disappear if the token has already expired.
    } finally {
      dispatch({ type: 'AUTH_CLEAR' });
      go('/');
    }
  }

  return <header className="siteHeader">
    <button className="brand" onClick={() => go('/')} aria-label="Usof home">USOF<span>.</span></button>
    <form className="headerSearch" onSubmit={(event) => {
      event.preventDefault();
      const query = search.trim();
      go(query ? `/?search=${encodeURIComponent(query)}` : '/');
    }}>
      <label className="srOnly" htmlFor="site-search">Search questions</label>
      <input id="site-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, authors, text…" />
    </form>
    <nav className="mainNav" aria-label="Main navigation">
      <button onClick={() => go('/')}>Questions</button>
      <button onClick={() => go('/categories')}>Categories</button>
      {auth && <button onClick={() => go('/dashboard')}>Dashboard</button>}
      {auth && <button onClick={() => go('/saved')}>Saved</button>}
      {auth && <button onClick={() => go('/create')}>Ask</button>}
      {auth?.user?.role === 'admin' && <button onClick={() => go('/admin/dashboard')}>Admin</button>}
    </nav>
    <div className="accountArea">
      {auth ? <>
        <button className="notificationButton" onClick={() => go('/notifications')} aria-label={`${unread} unread notifications`}>
          <span aria-hidden="true">◔</span>{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
        </button>
        <button className="profileButton" onClick={() => go('/profile')}>
          <Avatar user={auth.user} size="sm" />
          <span><small>{auth.user.role}</small>{auth.user.login}</span>
        </button>
        <button className="quietButton" onClick={logout}>Log out</button>
      </> : <>
        <button className="quietButton" onClick={() => go('/login')}>Log in</button>
        <button className="primary compact" onClick={() => go('/register')}>Sign up</button>
      </>}
    </div>
  </header>;
}
