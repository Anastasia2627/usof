import React, { useState } from 'react';
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
      <div className="tags">{post.categories?.map((category) => <span key={category.id}>{category.title}</span>)}</div>
    </div>
  </article>;
}

export function Header() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');

  async function logout() {
    try {
      if (auth?.token) await api('/auth/logout', { method: 'POST', token: auth.token });
    } catch {
      // Always clear the local session if the server session is already invalid.
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
      {auth && <button onClick={() => go('/create')}>Ask</button>}
      {auth?.user?.role === 'admin' && <button onClick={() => go('/admin')}>Admin</button>}
    </nav>
    <div className="accountArea">
      {auth ? <>
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
