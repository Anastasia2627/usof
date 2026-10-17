import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, PostCard, go } from '../ui.jsx';
import { usePreferences } from '../preferences.jsx';

export default function ProfilePage({ userId = null }) {
  const auth = useSelector(state => state.auth);
  const {t} = usePreferences();
  const dispatch = useDispatch();
  const viewedId = userId || auth?.user?.id;
  const isSelf = Boolean(auth && Number(viewedId) === Number(auth.user.id));
  const [user, setUser] = useState(userId ? null : (auth?.user || null));
  const [name, setName] = useState(auth?.user?.full_name || '');
  const [login, setLogin] = useState(auth?.user?.login || '');
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [sort, setSort] = useState('date');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [followState,setFollowState]=useState({followers:0,following:false});
  const [followBusy,setFollowBusy]=useState(false);
  useEffect(()=>{
    if(!auth?.token||!viewedId||isSelf)return;
    let live=true;
    api('/social/follows/'+viewedId,{token:auth.token})
      .then(r=>{if(live)setFollowState(r.data);}).catch(()=>{});
    return ()=>{live=false;};
  },[auth?.token,viewedId,isSelf]);
  async function toggleFollow(){
    if(!auth)return go('/login');
    setFollowBusy(true);setError(null);
    try{
      const next=!followState.following;
      await api('/social/follows/'+viewedId,{method:next?'POST':'DELETE',token:auth.token});
      setFollowState(v=>({following:next,followers:v.followers+(next?1:-1)}));
    }catch(err){setError(err);}finally{setFollowBusy(false);}
  }

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api('/categories').then(result => { if (active) setCategories(result.data); })
      .catch(err => { if (active) setError(err); });
    return () => { active = false; };
  }, [auth?.token]);

  useEffect(() => {
    if (!viewedId) return;
    let active = true;
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      author: String(viewedId),
      limit: '6',
      page: String(page),
      sort,
      order: 'desc',
    });
    if (status) query.set('status', status);
    if (category) query.set('category', category);

    Promise.all([
      api(`/users/${viewedId}`, { token: auth?.token }),
      api(`/users/${viewedId}/posts?${query}`, { token: auth?.token }),
    ]).then(([userResult, postResult]) => {
      if (!active) return;
      setUser(userResult.data);
      setName(userResult.data.full_name || '');
      setLogin(userResult.data.login || '');
      setPosts(postResult.data);
      setPagination(postResult.pagination);
      if (isSelf) dispatch({ type: 'AUTH_USER_SET', payload: userResult.data });
    }).catch(err => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth?.token, viewedId, isSelf, sort, status, category, page, dispatch]);

  if (!auth && !userId) return <main><div className="card">{t('Log in to view your profile.')} <button onClick={() => go('/login')}>{t('Log in')}</button></div></main>;

  async function save(event) {
    event.preventDefault();
    setError(null);
    setMessage('');
    try {
      const result = await api(`/users/${auth.user.id}`, {
        method: 'PATCH',
        token: auth.token,
        body: { fullName: name, login },
      });
      if (result.sessionInvalidated) {
        dispatch({ type: 'AUTH_CLEAR' });
        go('/login');
      } else {
        setUser(result.data);
        dispatch({ type: 'AUTH_USER_SET', payload: result.data });
        setEditOpen(false);
        setMessage(t('Profile saved.'));
      }
    } catch (err) { setError(err); }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage('');
    setUploading(true);
    const data = new FormData();
    data.append('avatar', file);
    try {
      const result = await api('/users/avatar', { method: 'PATCH', token: auth.token, formData: data });
      setUser(result.data);
      dispatch({ type: 'AUTH_USER_SET', payload: result.data });
      setMessage(t('Avatar updated.'));
    } catch (err) { setError(err); }
    finally { setUploading(false); event.target.value = ''; }
  }

  async function deleteAccount() {
    if (!window.confirm('Delete your Circle account? Your posts, comments and reactions will also be deleted. This cannot be undone.')) return;
    setError(null);
    setMessage('');
    try {
      await api(`/users/${auth.user.id}`, { method: 'DELETE', token: auth.token });
      dispatch({ type: 'AUTH_CLEAR' });
      go('/');
    } catch (err) { setError(err); }
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function cancelEdit() {
    setName(user?.full_name || '');
    setLogin(user?.login || '');
    setError(null);
    setEditOpen(false);
  }

  return <main className="profilePage">
    <section className="profileHeader">
      <div className="profileNames">
        <span className="profileMicroLabel">{t(user?.role === 'admin' ? 'Administrator' : 'Circle member')}</span>
        <h1>{user?.login || t('Profile')}</h1>
        {user?.full_name && <p className="profileFullName">{user.full_name}</p>}
        {isSelf && user?.email && <p className="profilePrivateEmail">{user.email}</p>}
      </div>
      <div className="profilePhoto"><Avatar user={user} size="xl"/></div>
    </section>
    <div className="profileInfoRow">
      <span className="profileRating"><Icon name="favorite" size={18}/><strong>{user?.rating || 0}</strong> {t('Reputation').toLowerCase()}</span>
      {!isSelf && auth && <div className="profileSocialActions">
        <span className="profileFollowers">{followState.followers} followers</span>
        <button type="button" className="profileEditToggle" onClick={toggleFollow} disabled={followBusy}
          aria-pressed={followState.following} title={followState.following?'Unfollow':'Follow'}>
          <Icon name={followState.following?'check':'plus'} size={18}/>
          {followState.following?'Following':'Follow'}
        </button>
        <button type="button" className="profileEditToggle" onClick={()=>go('/messages/'+viewedId)}
          title="Send private message"><Icon name="comment" size={18}/>Message</button>
      </div>}
      {isSelf && <button type="button" className="profileEditToggle" aria-expanded={editOpen}
        onClick={() => { setEditOpen(v => !v); setError(null); setMessage(''); }}>
        <Icon name="edit" size={18}/>{t(editOpen ? 'Close editor' : 'Edit profile')}
      </button>}
    </div>

    {isSelf && editOpen && <form className="profileEditPanel" onSubmit={save}>
      <h2>{t('Edit profile')}</h2>
      <div className="profileEditFields">
        <label>{t('Username')}<input required minLength="3" maxLength="50" value={login} onChange={event => setLogin(event.target.value)} /></label>
        <label>{t('Full name')}<input maxLength="100" value={name} onChange={event => setName(event.target.value)} /></label>
      </div>
      <label className="profilePhotoPicker">
        <Icon name="user" size={19}/>
        {t(uploading ? 'Uploading photo…' : 'Change profile photo')}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload}
          aria-label="Avatar" disabled={uploading} />
      </label>
      <p className="profileEditNote">{t('Changing your username will sign you out. You can log in again with the new username.')}</p>
      <div className="profileEditActions">
        <button className="profileCancelEdit" type="button" onClick={cancelEdit}>{t('Cancel')}</button>
        <button className="primary" type="submit">{t('Save profile')}</button>
      </div>
      <ErrorBox error={error}/>
    </form>}
    {message && <p className="profileSaved" role="status"><Icon name="check" size={19}/>{message}</p>}
    {!editOpen && <ErrorBox error={error}/>}

    <section className="profileActivity">
      <div className="profileActivityHeader">
        <h2>{t(isSelf ? 'Your posts' : 'Posts')}</h2>
        {isSelf && <button type="button" className="profileNewPost" onClick={() => go('/create')}>
          <Icon name="plus" size={20}/> {t('New post')}
        </button>}
      </div>
      <div className="profileActivitySort" role="group" aria-label="Sort profile posts">
        <button type="button" className={sort === 'date' ? 'profileSelected' : ''}
          aria-pressed={sort === 'date'} onClick={() => changeFilter(setSort, 'date')}>{t('Recent')}</button>
        <button type="button" className={sort === 'likes' ? 'profileSelected' : ''}
          aria-pressed={sort === 'likes'} onClick={() => changeFilter(setSort, 'likes')}>{t('Popular')}</button>
      </div>
      <div className="profileTopicBar">
        <div className="profileTopicPills" role="group" aria-label="Filter profile posts by category">
          <button type="button" className={!category ? 'profileTopicActive' : ''}
            aria-pressed={!category} onClick={() => changeFilter(setCategory, '')}>{t('All')}</button>
          {categories.map(item => <button key={item.id} type="button" className={String(category) === String(item.id) ? 'profileTopicActive' : ''}
            aria-pressed={String(category) === String(item.id)}
            onClick={() => changeFilter(setCategory, String(item.id))}>{item.title}</button>)}
        </div>
        {isSelf && <div className="profileStatusSelect">
          <label className="srOnly" htmlFor="profile-status">Status</label>
          <select id="profile-status" value={status} onChange={event => changeFilter(setStatus, event.target.value)}>
            <option value="">{t('All posts')}</option>
            <option value="active">{t('Active')}</option>
            <option value="inactive">{t('Inactive')}</option>
          </select>
        </div>}
      </div>
      {loading
        ? <p className="profilePostMessage">{t('Loading posts…')}</p>
        : posts.length
          ? <div className="profilePostList">{posts.map(post => <PostCard key={post.id} post={post}/>)}</div>
          : <div className="profileEmpty">
            <Icon name="forum" size={26}/>
            <strong>{t('Nothing here yet')}</strong>
            <p>{t(category || status ? 'Try another topic or status.' : isSelf ? 'Your conversations will appear here.' : 'This member has not posted yet.')}</p>
            {isSelf && !category && !status && <button type="button" onClick={() => go('/create')}>{t('Write your first post')} <Icon name="arrow" size={18}/></button>}
          </div>}
      {pagination?.totalPages > 1 && <nav className="pager" aria-label="Profile post pages">
        <button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{t('Previous')}</button>
        <span>{t('Page')} {pagination.page} {t('of')} {pagination.totalPages}</span>
        <button disabled={page >= pagination.totalPages} onClick={() => setPage(value => value + 1)}>{t('Next')}</button>
      </nav>}
    </section>
    {isSelf && <details className="profileSettings">
      <summary>{t('Account settings')} <Icon name="chevron" size={18}/></summary>
      <div className="profileDangerZone">
        <p>{t('Deleting your account permanently removes your posts, comments and reactions.')}</p>
        <button type="button" className="dangerText" onClick={deleteAccount}>{t('Delete account')}</button>
      </div>
    </details>}
  </main>;
}
