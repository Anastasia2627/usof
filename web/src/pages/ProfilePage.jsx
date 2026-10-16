import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, PostCard, go } from '../ui.jsx';

export default function ProfilePage({ userId = null }) {
  const auth = useSelector((state) => state.auth);
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
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/categories').then((result) => setCategories(result.data)).catch(setError);
  }, [auth?.token]);

  useEffect(() => {
    if (!viewedId) return;
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
    ])
      .then(([userResult, postResult]) => {
        setUser(userResult.data);
        setName(userResult.data.full_name || '');
        setLogin(userResult.data.login || '');
        setPosts(postResult.data);
        setPagination(postResult.pagination);
        if (isSelf) dispatch({ type: 'AUTH_USER_SET', payload: userResult.data });
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [auth?.token, viewedId, isSelf, sort, status, category, page]);

  if (!auth) return <main><div className="card">Log in to view profiles. <button onClick={() => go('/login')}>Log in</button></div></main>;

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
        // Login name changes revoke the previous JWT; require a fresh login.
        dispatch({ type: 'AUTH_CLEAR' });
        go('/login');
      } else {
        setUser(result.data);
        dispatch({ type: 'AUTH_USER_SET', payload: result.data });
        setMessage('Profile saved.');
      }
    } catch (err) {
      setError(err);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage('');
    const data = new FormData();
    data.append('avatar', file);
    try {
      const result = await api('/users/avatar', {
        method: 'PATCH',
        token: auth.token,
        formData: data,
      });
      setUser(result.data);
      dispatch({ type: 'AUTH_USER_SET', payload: result.data });
      setMessage('Avatar updated.');
    } catch (err) {
      setError(err);
    }
  }

  async function deleteAccount() {
    if (!window.confirm('Delete your Circle account? Your posts, comments and reactions will also be deleted. This cannot be undone.')) return;
    setError(null);
    setMessage('');
    try {
      await api(`/users/${auth.user.id}`, {
        method: 'DELETE',
        token: auth.token,
      });
      dispatch({ type: 'AUTH_CLEAR' });
      go('/');
    } catch (err) {
      setError(err);
    }
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  return <main>
    <section className="profileHero card">
      <Avatar user={user} size="xl" />
      <div><p className="eyebrow">{user?.role}</p><h1>{user?.login}</h1>{isSelf ? <p>{user?.email}</p> : <p>{user?.full_name || 'Circle member'}</p>}</div>
      <div className="profileScore"><small>Rating</small><strong>{user?.rating || 0}</strong></div>
    </section>
    <div className="twoColumn">
      {isSelf ? <form className="card form" onSubmit={save}>
        <h2>Profile details</h2>
        <label>Username<input required minLength="3" maxLength="50" value={login} onChange={event => setLogin(event.target.value)} /></label>
        <label>Full name<input maxLength="100" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Avatar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label>
        <button className="primary">Save profile</button>
        <small>Changing your username signs you out. Log in again with the new username.</small>
        {message && <div className="alert success">{message}</div>}
        <ErrorBox error={error} />
        <div className="dangerZone">
          <h3>Danger zone</h3>
          <p className="muted">Deleting the account permanently removes its posts, comments and reactions.</p>
          <button type="button" className="dangerText" onClick={deleteAccount}>Delete account</button>
        </div>
      </form> : <section className="card"><h2>About {user?.login}</h2><p>{user?.full_name || 'Member of Circle'}</p></section>}
      <section>
        <div className="sectionTitle">
          <div><p className="eyebrow">Activity</p><h2>{isSelf ? 'Your posts' : `Posts by ${user?.login || 'member'}`}</h2></div>
          <div className="inlineFilters">
            <label className="srOnly" htmlFor="profile-sort">Sort posts</label>
            <select id="profile-sort" value={sort} onChange={(event) => changeFilter(setSort, event.target.value)}><option value="date">Newest</option><option value="likes">Most liked</option></select>
            <label className="srOnly" htmlFor="profile-category">Category</label>
            <select id="profile-category" value={category} onChange={(event) => changeFilter(setCategory, event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
            {isSelf && <><label className="srOnly" htmlFor="profile-status">Status</label>
            <select id="profile-status" value={status} onChange={(event) => changeFilter(setStatus, event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></>}
          </div>
        </div>
        {loading
          ? <div className="card loading">Loading posts…</div>
          : posts.length
            ? <div className="miniList">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
            : <div className="card empty">No posts match these filters.</div>}
        {pagination && pagination.totalPages > 1 && <div className="pager"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button><span>Page {pagination.page} / {pagination.totalPages}</span><button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next →</button></div>}
      </section>
    </div>
  </main>;
}
