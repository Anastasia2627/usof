import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, assetUrl } from './api.js';

export const go = (path) => { window.location.hash = path; };
export const fmt = (date) => date ? new Date(date).toLocaleString() : '—';

export function Icon({ name }) {
  return <span className="material-symbols-rounded" aria-hidden="true">{name}</span>;
}

export function trustName(rating) {
  if (Number(rating) >= 150) return 'Mentor';
  if (Number(rating) >= 75) return 'Expert';
  if (Number(rating) >= 30) return 'Trusted';
  if (Number(rating) >= 10) return 'Contributor';
  return 'Newcomer';
}

export function TrustBadge({ rating }) {
  return <small className="trustBadge" title={`${rating || 0} points`}>{trustName(rating)}</small>;
}

export function ErrorBox({ error }) {
  return error ? <div className="card error" role="alert">{error.message || String(error)}</div> : null;
}

export function Avatar({ user, size = 'md' }) {
  const name = user?.login || 'Guest';
  return user?.avatar
    ? <img className={`avatar avatar-${size}`} src={assetUrl(user.avatar)} alt={`${name} avatar`} />
    : <span className={`avatar avatar-${size}`} aria-label={name}>{name[0].toUpperCase()}</span>;
}

export function StatusBadges({ item }) {
  return <span className="badges">
    {item?.status && <small>{item.status}</small>}
    {Boolean(item?.locked) && <small>locked</small>}
  </span>;
}

export function PostCard({ post }) {
  const auth = useSelector(state => state.auth);
  const showStatus = auth?.user?.role === 'admin' || Number(auth?.user?.id) === Number(post.author_id);
  return <article className="card threadCard">
    <div className="postMeta">
      <Avatar user={{ login: post.author_login, avatar: post.author_avatar }} size="sm" />
      <button className="authorLink" onClick={() => go(`/profile/${post.author_id}`)}>{post.author_login}</button>
      <span>{fmt(post.created_at)}</span>
      <StatusBadges item={showStatus ? post : { locked: post.locked }} />
    </div>
    <h2><button className="postTitleLink" onClick={() => go(`/post/${post.id}`)}>{post.title}</button></h2>
    <p>{post.content?.slice(0, 200)}{post.content?.length > 200 ? '…' : ''}</p>
    <div className="tags">{(post.categories || []).map(category => <span key={category.id}>{category.title}</span>)}</div>
    <small>{post.like_count || 0} likes · {post.comment_count || 0} comments</small>
  </article>;
}

export function Header() {
  const auth = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');

  async function logout() {
    try {
      if (auth?.token) await api('/auth/logout', { method: 'POST', token: auth.token });
    } catch {
      // An unavailable API must not trap a user in a local session.
    } finally {
      dispatch({ type: 'AUTH_CLEAR' });
      go('/');
    }
  }

  return <header className="siteHeader">
    <div className="headerInner">
      <button className="brand" onClick={() => go('/')}>Circle</button>
      <form className="headerSearch" role="search" onSubmit={event => {
        event.preventDefault();
        go(search.trim() ? `/search?q=${encodeURIComponent(search.trim())}` : '/');
      }}>
        <input aria-label="Search posts, people and categories" placeholder="Search posts, people, categories" value={search} onChange={e => setSearch(e.target.value)} />
        <button type="submit">Search</button>
      </form>
      <nav className="mainNav" aria-label="Main navigation">
        <button onClick={() => go('/')}>Home</button>
        <button onClick={() => go('/categories')}>Categories</button>
        {auth && <button onClick={() => go('/create')}>New post</button>}
        {auth?.user?.role === 'admin' && <button onClick={() => go('/admin')}>Admin</button>}
      </nav>
      <div className="accountArea">
        {auth ? <>
          <button className="profileButton" aria-label={`Profile of ${auth.user.login} (${auth.user.role})`} onClick={() => go('/profile')}>
            <Avatar user={auth.user} size="sm" />
            <span className="accountIdentity"><small>@{auth.user.login}</small><span className="accountRole">{auth.user.role}</span></span>
          </button>
          <button className="headerLogout" title="Log out" onClick={logout}>Log out</button>
        </> : <>
          <button onClick={() => go('/login')}>Log in</button>
          <button className="primary" onClick={() => go('/register')}>Sign up</button>
        </>}
      </div>
    </div>
  </header>;
}
