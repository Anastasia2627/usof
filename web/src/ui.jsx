import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, assetUrl } from './api.js';
import { usePreferences } from './preferences.jsx';

export const go = (path) => { window.location.hash = path; };
export const fmt = (date) => date ? new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

// Fixed Google Material Round SVGs bundled locally from Google's official icon source.
import { iconsA } from './googleIconsA.js';
import { iconsB } from './googleIconsB.js';
const googleIcons = { ...iconsA, ...iconsB, favorite: iconsA.heart, chat: iconsA.comment };
export function Icon({ name, size = 22 }) {
  // Static, trusted SVG strings only. No user input is ever interpolated.
  const svg = googleIcons[name] || googleIcons.categories;
  return <span className="circleIcon googleSvgIcon notranslate" translate="no"
    aria-hidden="true" style={{ width: size, height: size }}
    dangerouslySetInnerHTML={{ __html: svg }}/>;
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
  const {t} = usePreferences();
  const [counts, setCounts] = useState({
    like: Number(post.like_count || 0),
    dislike: Number(post.dislike_count || 0),
    comment: Number(post.comment_count || 0),
  });
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const contextRef = useRef(null);
  const [error, setError] = useState(null);
  const showStatus = auth?.user?.role === 'admin' || Number(auth?.user?.id) === Number(post.author_id);
  const selfPost = Boolean(auth && Number(auth.user.id) === Number(post.author_id));
  const isAdmin = auth?.user?.role === 'admin';
  const isModerated = (post.status !== 'active' || Boolean(post.locked)) && !isAdmin;
  const voteDisabled = busy || selfPost || isModerated;
  const voteTitle = selfPost
    ? 'You cannot react to your own post'
    : isModerated ? 'Reactions are disabled on this post' : '';

  useEffect(() => {
    setCounts({ like: Number(post.like_count || 0), dislike: Number(post.dislike_count || 0), comment: Number(post.comment_count || 0) });
  }, [post.id, post.like_count, post.dislike_count, post.comment_count]);

  useEffect(() => {
    if (!auth?.token) { setMyVote(null); setSaved(false); return; }
    let active = true;
    api('/posts/' + post.id + '/engagement', { token: auth.token })
      .then(r => { if (active) setSaved(Boolean(r.data.favorite)); })
      .catch(() => { if (active) setSaved(false); });
    api('/posts/' + post.id + '/like', { token: auth.token })
      .then(result => {
        if (active) setMyVote(result.data.find(item => Number(item.author_id) === Number(auth.user.id))?.type || null);
      })
      .catch(() => { if (active) setMyVote(null); });
    return () => { active = false; };
  }, [post.id, auth?.token, auth?.user?.id]);

  async function vote(type) {
    if (!auth) { go('/login'); return; }
    if (voteDisabled) return;
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

  async function toggleSave() {
    if (!auth) { go('/login'); return; }
    if (saving) return;
    setSaving(true);setError(null);
    try {
      const value = !saved;
      await api('/posts/' + post.id + '/favorite',{method:value?'POST':'DELETE',token:auth.token});
      setSaved(value);
      window.dispatchEvent(new Event('circle:saved-updated'));
    } catch(e){setError(e);} finally{setSaving(false);}
  }
  async function moderate(method,body) {
    setContextMenu(null);
    try {
      await api('/posts/' + post.id,{method,token:auth.token,...(body?{body}:{})});
      window.dispatchEvent(new Event('circle:posts-updated'));
    } catch(e){setError(e);}
  }
  useEffect(()=>{
    if(!contextMenu)return;
    const outside=event=>{if(!contextRef.current?.contains(event.target))setContextMenu(null);};
    const escape=event=>{if(event.key==='Escape')setContextMenu(null);};
    const close=()=>setContextMenu(null);
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    window.addEventListener('scroll',close,true);
    return()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape);
      window.removeEventListener('scroll',close,true);
    };
  },[contextMenu]);
  function openModeration(event) {
    if (!isAdmin) return;
    event.preventDefault();
    setContextMenu({
      x:Math.max(8,Math.min(event.clientX,window.innerWidth-225)),
      y:Math.max(8,Math.min(event.clientY,window.innerHeight-225))
    });
  }
  const actions = [
    {text:t('Open post'),icon:'arrow',fn:()=>{setContextMenu(null);go('/post/'+post.id);}},
    {text:t(post.status==='active'?'Deactivate':'Activate'),
      icon:post.status==='active'?'lock':'check',
      fn:()=>moderate('PATCH',{status:post.status==='active'?'inactive':'active'})},
    {text:t(post.locked?'Unlock':'Lock'),icon:post.locked?'unlock':'lock',
      fn:()=>moderate('PATCH',{locked:!Boolean(post.locked)})},
    {text:t('Delete post'),icon:'trash',danger:true,fn:()=>{
      setContextMenu(null);
      if(window.confirm(t('Delete post?')))moderate('DELETE');
    }}
  ];
  return <article className="threadCard" onContextMenu={isAdmin?openModeration:undefined}>
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
        <button type="button" aria-label="Like" title={voteTitle || 'Like'} disabled={voteDisabled}
          aria-pressed={myVote === 'like'} className={myVote === 'like' ? 'activeVote' : ''} onClick={() => vote('like')}>
          <Icon name="heart" size={20}/><span>{counts.like}</span>
        </button>
        <button type="button" aria-label="Comment" title="View replies" onClick={() => go(`/post/${post.id}`)}>
          <Icon name="comment" size={20}/><span>{counts.comment}</span>
        </button>
        <button type="button" aria-label="Dislike" title={voteTitle || 'Dislike'} disabled={voteDisabled}
          aria-pressed={myVote === 'dislike'} className={myVote === 'dislike' ? 'activeVote' : ''} onClick={() => vote('dislike')}>
          <Icon name="dislike" size={19}/><span>{counts.dislike}</span>
        </button>
        {auth && <button type="button" aria-label={saved?t('Unsave post'):t('Save post')}
          title={saved?t('Unsave post'):t('Save post')} aria-pressed={saved}
          className={saved?'activeSave':''} disabled={saving} onClick={toggleSave}>
          <Icon name={saved?'bookmark':'bookmarkBorder'} size={20}/>
        </button>}
        {isAdmin && <button type="button" aria-label={t('Post actions')}
          title={t('Post actions')} className="postModerationTrigger"
          onClick={openModeration}><Icon name="more" size={20}/></button>}
      </div>
      <ErrorBox error={error} />
    </div>
    {contextMenu && isAdmin && <div ref={contextRef} className="postContextMenu"
      style={{left:contextMenu.x,top:contextMenu.y}} role="menu" aria-label={t('Post actions')}>
      {actions.map(action=><button type="button" role="menuitem" key={action.text}
        className={action.danger?'dangerText':''} onClick={action.fn}>
        <Icon name={action.icon} size={18}/>{action.text}</button>)}
    </div>}
  </article>;
}

export function Header() {
  const auth = useSelector(state => state.auth);
  const {t} = usePreferences();
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');
  const menuRef = useRef(null);

  // Keep logout accessible everywhere without a permanent header button.
  useEffect(() => {
    const closeOutside = event => {
      if (menuRef.current?.open && !menuRef.current.contains(event.target)) menuRef.current.open = false;
    };
    const closeEscape = event => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector('summary')?.focus();
      }
    };
    const closeOnRoute = () => { if (menuRef.current) menuRef.current.open = false; };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    window.addEventListener('hashchange', closeOnRoute);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
      window.removeEventListener('hashchange', closeOnRoute);
    };
  }, []);
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
    ...(auth ? [
      { key:'create', text:'New post', destination:'/create', icon:'plus' },
      { key:'saved', text:'Saved', destination:'/saved', icon:'bookmarkBorder' },
      { key:'dashboard', text:'Dashboard', destination:'/dashboard', icon:'analytics' },
    ] : []),
    { key:'settings', text:'Settings', destination:'/settings', icon:'settings' },
    ...(auth?.user?.role === 'admin' ? [{ key: 'admin', text: 'Admin', destination: '/admin', icon: 'shield' }] : []),
  ];
  const current = window.location.hash.split('?')[0].slice(1) || '/';
  const guestLanding = !auth && current === '/';

  return <header className="siteHeader">
    <div className={guestLanding ? "headerInner guestOnlyHeader" : "headerInner"}>
      <button className="brand" onClick={() => go('/')} aria-label="Circle home"><span className="circleLogo">◎</span><span>circle</span></button>
      {!guestLanding && <form className="headerSearch" role="search" onSubmit={event => {
        event.preventDefault();
        go(search.trim() ? `/search?q=${encodeURIComponent(search.trim())}` : '/search');
      }}>
        <Icon name="search" size={18}/>
        <input aria-label="Search posts, people and categories" placeholder={t('Search')} value={search} onChange={event => setSearch(event.target.value)} />
        <button className="searchSubmit" type="submit" aria-label="Search" title="Search"><Icon name="arrow" size={19}/></button>
      </form>}
      {!guestLanding && <nav className="mainNav" aria-label="Main navigation">
        {nav.map(item => <button key={item.key} type="button" title={item.text}
          className={current === item.destination ? 'navActive' : ''}
          aria-label={t(item.text)} onClick={() => go(item.destination)}>
          <Icon name={item.icon} size={24}/><span className="navLabel">{t(item.text)}</span>
        </button>)}
      </nav>}
      <div className="accountArea">
        {auth ? <>
          <button className="profileButton" aria-label={`Profile of ${auth.user.login} (${auth.user.role})`} onClick={() => go('/profile')}>
            <Avatar user={auth.user} size="sm" />
            <span className="accountIdentity"><small>@{auth.user.login}</small><span className="accountRole">{auth.user.role}</span></span>
          </button>
          <details className="accountMenu" ref={menuRef}>
            <summary aria-label="Account menu" title="Account menu"><Icon name="more" size={23}/></summary>
            <div className="accountDropdown">
              <p className="accountDropdownTitle">@{auth.user.login} <small>{auth.user.role}</small></p>
              <button type="button" onClick={() => { menuRef.current.open = false; go('/profile'); }}>
                <Icon name="user" size={19}/> {t('My profile')}
              </button>
              <button type="button" className="accountLogout" onClick={logout}>
                <Icon name="logout" size={19}/> {t('Log out')}
              </button>
            </div>
          </details>
        </> : <>
          <button className="loginButton" onClick={() => go('/login')}>{t('Log in')}</button>
          <button className="primary signupButton" onClick={() => go('/register')}>{t('Sign up')}</button>
        </>}
      </div>
    </div>
  </header>;
}
