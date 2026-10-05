import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, assetUrl } from './api.js';

export const go = (path) => { window.location.hash = path; };
export const fmt = (value) => value ? new Date(value).toLocaleString() : '—';

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };

  if (name === 'search') {
    return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  }
  if (name === 'bell') {
    return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
  }
  if (name === 'arrow') {
    return <svg {...common}><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></svg>;
  }
  return null;
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
  return <span className={'trustBadge ' + name.toLowerCase()} title={Number(rating || 0) + ' reputation'}>{name}</span>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="card alert error" role="alert">{error.message || String(error)}</div>;
}

export function Avatar({ user, size = 'md' }) {
  if (user?.avatar) {
    return <img className={'avatar avatar-' + size} src={assetUrl(user.avatar)} alt={(user.login || 'User') + ' avatar'} />;
  }
  return <span className={'avatar avatar-' + size + ' avatar-fallback'} aria-hidden="true">{(user?.login || '?').slice(0, 1).toUpperCase()}</span>;
}

export function StatusBadges({ item }) {
  return <span className="badges">
    {item.status && <span className={'badge ' + item.status}>{item.status}</span>}
    {Boolean(item.locked) && <span className="badge locked">locked</span>}
  </span>;
}

export function PostCard({ post }) {
  return <article
    className="card postCard"
    onClick={() => go('/post/' + post.id)}
    tabIndex="0"
    onKeyDown={(event) => { if (event.key === 'Enter') go('/post/' + post.id); }}
  >
    <div className="postCardRail">
      <div className="scoreBox">{Number(post.score) > 0 ? '+' : ''}{post.score || 0}</div>
      <span className="scoreLabel">score</span>
    </div>
    <div className="postCardContent">
      <div className="postMeta">
        <span className="postAuthor">
          <Avatar user={{ login: post.author_login, avatar: post.author_avatar }} size="sm" />
          <span>{post.author_login}</span>
        </span>
        {post.author_rating !== undefined && <TrustBadge rating={post.author_rating} />}
        <span className="postMetaDot">•</span>
        <span>{fmt(post.created_at)}</span>
        <StatusBadges item={post} />
      </div>
      <h2>{post.title}</h2>
      <p>{post.content?.slice(0, 190)}{post.content?.length > 190 ? '…' : ''}</p>
      <div className="postCardBottom">
        <div className="tags">{post.categories?.map((category) => <span key={category.id}>{category.title}</span>)}</div>
        <div className="postMetrics">
          {post.like_count !== undefined && <span><b>{post.like_count}</b> likes</span>}
          {post.comment_count !== undefined && <span><b>{post.comment_count}</b> answers</span>}
          {post.favorite_count !== undefined && <span><b>{post.favorite_count}</b> saved</span>}
        </div>
      </div>
    </div>
    <div className="postOpen" aria-hidden="true"><Icon name="arrow" size={17} /></div>
  </article>;
}

export function Header() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');
  const [unread, setUnread] = useState(0);
  const [path, setPath] = useState(() => (window.location.hash.slice(1).split('?')[0] || '/'));

  useEffect(() => {
    const syncPath = () => setPath(window.location.hash.slice(1).split('?')[0] || '/');
    window.addEventListener('hashchange', syncPath);
    return () => window.removeEventListener('hashchange', syncPath);
  }, []);

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
      // Clear the local session even if the server token has already expired.
    } finally {
      dispatch({ type: 'AUTH_CLEAR' });
      go('/');
    }
  }

  const nav = [
    ['/', 'Questions'],
    ['/categories', 'Categories'],
    ...(auth ? [['/dashboard', 'Dashboard'], ['/saved', 'Saved']] : []),
    ...(auth?.user?.role === 'admin' ? [['/admin/dashboard', 'Admin']] : []),
  ];

  return <header className="siteHeader">
    <div className="headerShell">
      <button className="brand" onClick={() => go('/')} aria-label="Usof home">
        <span className="brandMark">U</span>
        <span className="brandWord">USOF</span>
        <i>.</i>
      </button>

      <form className="headerSearch" onSubmit={(event) => {
        event.preventDefault();
        const query = search.trim();
        go(query ? '/?search=' + encodeURIComponent(query) : '/');
      }}>
        <label className="srOnly" htmlFor="site-search">Search questions</label>
        <span className="searchIcon"><Icon name="search" size={17} /></span>
        <input id="site-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions, authors, text…" />
      </form>

      <nav className="mainNav" aria-label="Main navigation">
        {nav.map(([href, label]) => <button
          key={href}
          className={(path === href || (href === '/' && path.startsWith('/post/'))) ? 'active' : ''}
          onClick={() => go(href)}
        >{label}</button>)}
      </nav>

      <div className="accountArea">
        {auth ? <>
          <button className="askButton" onClick={() => go('/create')}>Ask <Icon name="arrow" size={15} /></button>
          <button className="notificationButton" onClick={() => go('/notifications')} aria-label={unread + ' unread notifications'}>
            <Icon name="bell" size={18} />{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
          </button>
          <button className="profileButton" onClick={() => go('/profile')}>
            <Avatar user={auth.user} size="sm" />
            <span><small>{auth.user.role}</small>{auth.user.login}</span>
          </button>
          <button className="quietButton logoutButton" onClick={logout}>Log out</button>
        </> : <>
          <button className="quietButton" onClick={() => go('/login')}>Log in</button>
          <button className="primary compact" onClick={() => go('/register')}>Sign up</button>
        </>}
      </div>
    </div>
  </header>;
}
