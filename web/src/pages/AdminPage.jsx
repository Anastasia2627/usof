import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, StatusBadges, go } from '../ui.jsx';

function UserRow({ user, auth, onSave, onDelete }) {
  const [form, setForm] = useState({
    login: user.login,
    email: user.email,
    fullName: user.full_name || '',
    role: user.role,
  });
  const changed = form.login !== user.login || form.email !== user.email || form.fullName !== (user.full_name || '') || form.role !== user.role;

  return <tr>
    <td><input aria-label={`Login for ${user.login}`} value={form.login} onChange={(event) => setForm({ ...form, login: event.target.value })} /></td>
    <td><input aria-label={`Email for ${user.login}`} type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></td>
    <td><input aria-label={`Full name for ${user.login}`} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></td>
    <td><select aria-label={`Role for ${user.login}`} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="user">user</option><option value="admin">admin</option></select></td>
    <td>{user.rating}</td>
    <td className="rowActions"><button disabled={!changed} onClick={() => onSave(user, form)}>Save</button><button className="dangerText" disabled={Number(user.id) === Number(auth.user.id)} onClick={() => onDelete(user)}>Delete</button></td>
  </tr>;
}

function PostCategoryEditor({ post, categories, auth, run }) {
  const [selected, setSelected] = useState(post.categories?.map((item) => Number(item.id)) || []);
  useEffect(() => setSelected(post.categories?.map((item) => Number(item.id)) || []), [post.id, post.categories]);

  function toggle(id) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return <details className="categoryEditor">
    <summary>Categories</summary>
    <div className="checkGrid">{categories.map((category) => <label className="check" key={category.id}><input type="checkbox" checked={selected.includes(Number(category.id))} onChange={() => toggle(Number(category.id))} />{category.title}</label>)}</div>
    <button disabled={!selected.length} onClick={() => run(() => api(`/posts/${post.id}`, { method: 'PATCH', token: auth.token, body: { categories: selected } }))}>Save categories</button>
  </details>;
}

export default function AdminPage() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [tab, setTab] = useState('users');
  const [data, setData] = useState({ users: [], posts: [], categories: [], comments: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ login: '', email: '', fullName: '', role: 'user', password: '', passwordConfirmation: '' });
  const [newCategory, setNewCategory] = useState({ title: '', description: '' });

  async function load() {
    if (auth?.user?.role !== 'admin') return;
    setError(null);
    setLoading(true);
    try {
      const [users, posts, categories, comments] = await Promise.all([
        api('/users', { token: auth.token }),
        api('/posts?limit=50&sort=date&order=desc', { token: auth.token }),
        api('/categories'),
        api('/comments', { token: auth.token }),
      ]);
      setData({ users: users.data, posts: posts.data, categories: categories.data, comments: comments.data });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [auth?.token, auth?.user?.role]);

  if (auth?.user?.role !== 'admin') return <main><div className="card error">Admin access required.</div></main>;

  async function run(work) {
    setError(null);
    try {
      const result = await work();
      await load();
      return result;
    } catch (err) {
      setError(err);
      return null;
    }
  }

  async function saveUser(user, form) {
    const result = await run(() => api(`/users/${user.id}`, {
      method: 'PATCH',
      token: auth.token,
      body: form,
    }));
    if (result?.sessionInvalidated && Number(user.id) === Number(auth.user.id)) {
      dispatch({ type: 'AUTH_CLEAR' });
      go('/login');
    }
  }

  function deleteUser(user) {
    if (!window.confirm(`Delete ${user.login}? Their posts/comments will also be removed.`)) return;
    run(() => api(`/users/${user.id}`, { method: 'DELETE', token: auth.token }));
  }

  async function createUser(event) {
    event.preventDefault();
    const result = await run(() => api('/users', { method: 'POST', token: auth.token, body: newUser }));
    if (result) setNewUser({ login: '', email: '', fullName: '', role: 'user', password: '', passwordConfirmation: '' });
  }

  async function createCategory(event) {
    event.preventDefault();
    const result = await run(() => api('/categories', { method: 'POST', token: auth.token, body: newCategory }));
    if (result) setNewCategory({ title: '', description: '' });
  }

  return <main className="adminPage">
    <div className="sectionTitle"><div><p className="eyebrow">Protected area</p><h1>Admin console</h1></div></div>
    <div className="tabs">{['users', 'posts', 'categories', 'comments'].map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div>
    <ErrorBox error={error} />
    {loading ? <div className="card loading">Loading admin data…</div> : <>
      {tab === 'users' && <section className="adminStack">
        <form className="card form compactForm" onSubmit={createUser}>
          <h2>Create user</h2>
          <div className="formGrid">
            <label>Login<input required minLength="3" maxLength="50" value={newUser.login} onChange={(event) => setNewUser({ ...newUser, login: event.target.value })} /></label>
            <label>Email<input type="email" required value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} /></label>
            <label>Full name<input maxLength="100" value={newUser.fullName} onChange={(event) => setNewUser({ ...newUser, fullName: event.target.value })} /></label>
            <label>Role<select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}><option value="user">user</option><option value="admin">admin</option></select></label>
            <label>Password<input type="password" minLength="8" maxLength="128" required value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} /></label>
            <label>Confirm<input type="password" minLength="8" maxLength="128" required value={newUser.passwordConfirmation} onChange={(event) => setNewUser({ ...newUser, passwordConfirmation: event.target.value })} /></label>
          </div>
          <button className="primary compact">Create user</button>
        </form>
        <div className="card tableWrap"><table><thead><tr><th>Login</th><th>Email</th><th>Full name</th><th>Role</th><th>Rating</th><th>Actions</th></tr></thead><tbody>{data.users.map((user) => <UserRow key={`${user.id}-${user.updated_at || ''}-${user.role}-${user.login}`} user={user} auth={auth} onSave={saveUser} onDelete={deleteUser} />)}</tbody></table></div>
      </section>}

      {tab === 'posts' && <div className="adminStack">
        {data.posts.length ? data.posts.map((post) => <article className="card adminRow" key={post.id}>
          <div>
            <div className="postMeta"><b>#{post.id} {post.author_login}</b><StatusBadges item={post} /></div>
            <h3>{post.title}</h3>
            <div className="tags">{post.categories?.map((category) => <span key={category.id}>{category.title}</span>)}</div>
            <PostCategoryEditor post={post} categories={data.categories} auth={auth} run={run} />
          </div>
          <div className="adminActions">
            <button onClick={() => go(`/post/${post.id}`)}>Open</button>
            <button onClick={() => run(() => api(`/posts/${post.id}`, { method: 'PATCH', token: auth.token, body: { status: post.status === 'active' ? 'inactive' : 'active' } }))}>{post.status === 'active' ? 'Deactivate' : 'Activate'}</button>
            <button onClick={() => run(() => api(`/posts/${post.id}`, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(post.locked) } }))}>{post.locked ? 'Unlock' : 'Lock'}</button>
            <button className="dangerText" onClick={() => { if (window.confirm('Delete this question?')) run(() => api(`/posts/${post.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button>
          </div>
        </article>) : <div className="card empty">No posts.</div>}
      </div>}

      {tab === 'categories' && <section className="adminStack">
        <form className="card form compactForm" onSubmit={createCategory}>
          <h2>Create category</h2>
          <div className="formGrid"><label>Title<input required maxLength="100" value={newCategory.title} onChange={(event) => setNewCategory({ ...newCategory, title: event.target.value })} /></label><label>Description<input value={newCategory.description} onChange={(event) => setNewCategory({ ...newCategory, description: event.target.value })} /></label></div>
          <button className="primary compact">Create category</button>
        </form>
        <div className="categoryGrid">{data.categories.map((category) => <article className="card" key={category.id}><h3>{category.title}</h3><p>{category.description}</p><div className="toolbar"><button onClick={() => { const title = window.prompt('Category title', category.title); if (title !== null) { const description = window.prompt('Description', category.description) ?? category.description; run(() => api(`/categories/${category.id}`, { method: 'PATCH', token: auth.token, body: { title, description } })); } }}>Edit</button><button className="dangerText" onClick={() => { if (window.confirm(`Delete ${category.title}?`)) run(() => api(`/categories/${category.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button></div></article>)}</div>
      </section>}

      {tab === 'comments' && <div className="adminStack">
        {data.comments.length ? data.comments.map((comment) => <article className="card adminRow" key={comment.id}>
          <div><div className="postMeta"><b>{comment.author_login}</b><span>on “{comment.post_title}”</span><StatusBadges item={comment} /></div><p>{comment.content}</p></div>
          <div className="adminActions"><button onClick={() => go(`/post/${comment.post_id}`)}>Open post</button><button onClick={() => run(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { status: comment.status === 'active' ? 'inactive' : 'active' } }))}>{comment.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => run(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(comment.locked) } }))}>{comment.locked ? 'Unlock' : 'Lock'}</button><button className="dangerText" onClick={() => { if (window.confirm('Delete this comment?')) run(() => api(`/comments/${comment.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button></div>
        </article>) : <div className="card empty">No comments.</div>}
      </div>}
    </>}
  </main>;
}
