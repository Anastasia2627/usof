import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, assetUrl } from './api.js';

export const go = (path) => { window.location.hash = path; };
export const fmt = (date) => date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

// Google Material Symbols Rounded, a lightweight shared icon font.
// A single accessible component keeps icons consistent in nav and reactions.
export function Icon({ name, size = 22 }) {
  const glyphs = {
    home: 'home',
    search: 'search',
    plus: 'add_circle',
    categories: 'grid_view',
    user: 'person',
    shield: 'admin_panel_settings',
    heart: 'favorite',
    comment: 'chat_bubble',
    dislike: 'thumb_down',
    arrow: 'arrow_forward',
    logout: 'logout',
    sliders: 'tune',
    forum: 'forum',
    favorite: 'favorite',
    chat: 'chat_bubble',
    group: 'groups',
  };
  return <span className="material-symbols-rounded circleIcon" aria-hidden="true"
    style={{ fontSize: size }}>{glyphs[name] || 'grid_view'}</span>;
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
export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return <div className="error inlineError" role="alert">
    <div>{error.message || String(error)}</div>
    {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
  </div>;
}
export function Avatar({ user, size = 'md' }) {
  const name = user?.login || 'Guest';
  return user?.avatar
    ? <img className={`avatar avatar-${size}`} src={assetUrl(user.avatar)} alt={`${name} avatar`} />
    : <span className={`avatar avatar-${size}`} aria-label={name}>{name[0].toUpperCase()}</span>;
}
export function StatusBadges({ item }) {
  return <span className="badges">
    {item?.status && item.status !== 'active' && <small>{item.status}</small>}
    {Boolean(item?.locked) && <small>locked</small>}
  </span>;
}

export function PostCard({ post }) {
  const auth = useSelector(state => state.auth);
  const [counts, setCounts] = useState({
    like: Number(post.like_count || 0),
    dislike: Number(post.dislike_count || 0),
    comment: Number(post.comment_count || 0),
  });
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const showStatus = auth?.user?.role === 'admin' || Number(auth?.user?.id) === Number(post.author_id);
  const selfPost = Boolean(auth && Number(auth.user.id) === Number(post.author_id));

  useEffect(() => {
    setCounts({ like: Number(post.like_count || 0), dislike: Number(post.dislike_count || 0), comment: Number(post.comment_count || 0) });
  }, [post.id, post.like_count, post.dislike_count, post.comment_count]);

  useEffect(() => {
    if (!auth?.token) { setMyVote(null); return; }
    let active = true;
    api('/posts/' + post.id + '/like', { token: auth.token })
      .then(result => {
        if (active) setMyVote(result.data.find(item => Number(item.author_id) === Number(auth.user.id))?.type || null);
      })
      .catch(() => { if (active) setMyVote(null); });
    return () => { active = false; };
  }, [post.id, auth?.token, auth?.user?.id]);

  async function vote(type) {
    if (!auth) { go('/login'); return; }
    if (selfPost || busy) return;
    setBusy(true); setError(null);
    try {
      if (myVote === type) {
        await api('/posts/' + post.id + '/like', { method: 'DELETE', token: auth.token });
        setMyVote(null);
      } else {
        await api('/posts/' + post.id + '/like', { method: 'POST', token: auth.token, body: { type } });
        setMyVote(type);
      }
      const fresh = await api('/posts/' + post.id, { token: auth.token });
      setCounts({
        like: Number(fresh.data.like_count || 0),
        dislike: Number(fresh.data.dislike_count || 0),
        comment: Number(fresh.data.comment_count || 0),
      });
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  }

  return <article className="threadCard">
    <div className="threadAvatarColumn">
      <button className="avatarButton" aria-label={`Profile of ${post.author_login}`} onClick={() => go(`/profile/${post.author_id}`)}>
        <Avatar user={{ login: post.author_login, avatar: post.author_avatar }} size="md" />
      </button>
      <span className="threadVerticalLine" aria-hidden="true"/>
    </div>
    <div className="threadBody">
      <div className="postMeta">
        <button className="authorLink" onClick={() => go(`/profile/${post.author_id}`)}>{post.author_login}</button>
        <time dateTime={post.created_at}>{fmt(post.created_at)}</time>
        <StatusBadges item={showStatus ? post : { locked: post.locked }} />
      </div>
      <h2><button className="postTitleLink" onClick={() => go(`/post/${post.id}`)}>{post.title}</button></h2>
      <p className="threadExcerpt">{post.content?.slice(0, 260)}{post.content?.length > 260 ? '…' : ''}</p>
      <div className="tags">{(post.categories || []).map(category => <span key={category.id}>{category.title}</span>)}</div>
      <div className="threadActions">
        <button type="button" aria-label="Like" title={selfPost ? 'You cannot like your own post' : 'Like'} disabled={busy || selfPost}
          aria-pressed={myVote === 'like'} className={myVote === 'like' ? 'activeVote' : ''} onClick={() => vote('like')}>
          <Icon name="heart" size={20}/><span>{counts.like}</span>
        </button>
        <button type="button" aria-label="Comment" title="View replies" onClick={() => go(`/post/${post.id}`)}>
          <Icon name="comment" size={20}/><span>{counts.comment}</span>
        </button>
        <button type="button" aria-label="Dislike" title={selfPost ? 'You cannot dislike your own post' : 'Dislike'} disabled={busy || selfPost}
          aria-pressed={myVote === 'dislike'} className={myVote === 'dislike' ? 'activeVote' : ''} onClick={() => vote('dislike')}>
          <Icon name="dislike" size={19}/><span>{counts.dislike}</span>
        </button>
      </div>
      <ErrorBox error={error} />
    </div>
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
      // Users can always clear their local session even while offline.
    } finally {
      dispatch({ type: 'AUTH_CLEAR' });
      go('/');
    }
  }

  const nav = [
    { key: 'home', text: 'Home', destination: '/', icon: 'home' },
    ...(!auth ? [{ key: 'explore', text: 'Explore', destination: '/explore', icon: 'forum' }] : []),
    { key: 'search', text: 'Search', destination: '/search', icon: 'search' },
    { key: 'categories', text: 'Categories', destination: '/categories', icon: 'categories' },
    ...(auth ? [{ key: 'create', text: 'New post', destination: '/create', icon: 'plus' }] : []),
    ...(auth?.user?.role === 'admin' ? [{ key: 'admin', text: 'Admin', destination: '/admin', icon: 'shield' }] : []),
  ];
  const current = window.location.hash.split('?')[0].slice(1) || '/';

  return <header className="siteHeader">
    <div className="headerInner">
      <button className="brand" onClick={() => go('/')} aria-label="Circle home"><span className="circleLogo">◎</span><span>circle</span></button>
      <form className="headerSearch" role="search" onSubmit={event => {
        event.preventDefault();
        go(search.trim() ? `/search?q=${encodeURIComponent(search.trim())}` : '/search');
      }}>
        <Icon name="search" size={18}/>
        <input aria-label="Search posts, people and categories" placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} />
        <button className="searchSubmit" type="submit">Search</button>
      </form>
      <nav className="mainNav" aria-label="Main navigation">
        {nav.map(item => <button key={item.key} type="button" title={item.text}
          className={current === item.destination ? 'navActive' : ''}
          aria-label={item.text} onClick={() => go(item.destination)}>
          <Icon name={item.icon} size={24}/><span className="navLabel">{item.text}</span>
        </button>)}
      </nav>
      <div className="accountArea">
        {auth ? <>
          <button className="profileButton" aria-label={`Profile of ${auth.user.login} (${auth.user.role})`} onClick={() => go('/profile')}>
            <Avatar user={auth.user} size="sm" />
            <span className="accountIdentity"><small>@{auth.user.login}</small><span className="accountRole">{auth.user.role}</span></span>
          </button>
          <button className="headerLogout" title="Log out" onClick={logout}><Icon name="logout" size={17}/><span>Log out</span></button>
        </> : <>
          <button className="loginButton" onClick={() => go('/login')}>Log in</button>
          <button className="primary signupButton" onClick={() => go('/register')}>Sign up</button>
        </>}
      </div>
    </div>
  </header>;
}
