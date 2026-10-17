import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, StatusBadges, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

function UserRow({ user, auth, onSave, onDelete }) {
  const {t}=usePreferences();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [form, setForm] = useState({
    login: user.login,
    email: user.email,
    fullName: user.full_name || '',
    role: user.role,
  });

  useEffect(() => {
    setForm({
      login: user.login,
      email: user.email,
      fullName: user.full_name || '',
      role: user.role,
    });
  }, [user.login, user.email, user.full_name, user.role]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await onSave(user, form);
      if (result) setEditing(false);
    } finally { setSaving(false); }
  }

  async function quickRole() {
    const nextRole=user.role==='moderator'?'user':'moderator';
    const question=nextRole==='moderator'
      ? 'Make @'+user.login+' a moderator? They will be able to review reports and moderate posts and replies, but not manage users or roles.'
      : 'Remove moderator permissions from @'+user.login+'?';
    if(!window.confirm(question))return;
    setRoleBusy(true);
    try { await onSave(user,{role:nextRole}); }
    finally { setRoleBusy(false); }
  }

  return <div className="adminListItem adminUserRow">
    <div className="adminItemLine">
      <Avatar user={user} size="md"/>
      <div className="adminItemText">
        <button type="button" className="adminName" onClick={() => go('/profile/' + user.id)}>{user.login}</button>
        <p>{user.full_name || user.email}</p>
      </div>
      <span className="adminRoleChip">{user.role}</span>
      <span className="adminScore" title="User rating">{Number(user.rating || 0)} pts</span>
      <div className="adminRowTools">
        {user.role!=='admin' && <button type="button" className={user.role==='moderator'?'roleQuickButton roleRevoke':'roleQuickButton'}
          disabled={roleBusy || saving} aria-label={(user.role==='moderator'?'Remove moderator from ':'Make moderator: ')+user.login}
          onClick={quickRole}>
          <Icon name={user.role==='moderator'?'close':'shield'} size={17}/>
          <span>{t(roleBusy?'Saving…':user.role==='moderator'?'Remove moderator':'Make moderator')}</span>
        </button>}
        <button type="button" aria-label={'Edit user ' + user.login} onClick={() => setEditing(value => !value)}>
          <Icon name="edit" size={18}/> <span>{t('Edit')}</span>
        </button>
        <button type="button" className="dangerText" disabled={Number(user.id) === Number(auth.user.id)}
          onClick={() => onDelete(user)} title={Number(user.id) === Number(auth.user.id) ? 'You cannot delete your own admin account' : 'Delete user'}>
          <Icon name="close" size={18}/> <span>{t('Delete')}</span>
        </button>
      </div>
    </div>
    {editing && <form className="adminInlineForm" onSubmit={save}>
      <div className="adminFields">
        <label>Username<input aria-label={'Login for ' + user.login} required minLength="3" maxLength="50" value={form.login} onChange={event => setForm({ ...form, login: event.target.value })}/></label>
        <label>Email<input aria-label={'Email for ' + user.login} type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })}/></label>
        <label>Full name<input aria-label={'Full name for ' + user.login} maxLength="100" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })}/></label>
        <label>Role<select aria-label={'Role for ' + user.login} value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option></select></label>
      </div>
      <div className="adminFormActions">
        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        <button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save user'}</button>
      </div>
    </form>}
  </div>;
}

function PostCategoryEditor({ post, categories, auth, run }) {
  const {t}=usePreferences();
  const [selected, setSelected] = useState(post.categories?.map(item => Number(item.id)) || []);
  useEffect(() => setSelected(post.categories?.map(item => Number(item.id)) || []), [post.id, post.categories]);
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  return <details className="adminInnerDetails">
    <summary>Topics <Icon name="chevron" size={17}/></summary>
    <div className="adminTopicChoices">
      {categories.map(category => <label className="adminTopicChoice" key={category.id}>
        <input type="checkbox" checked={selected.includes(Number(category.id))} onChange={() => toggle(Number(category.id))}/>
        <span>{t(category.title)}</span>
      </label>)}
    </div>
    <button className="primary adminSaveTopics" type="button" disabled={!selected.length}
      onClick={() => run(() => api('/posts/' + post.id, { method: 'PATCH', token: auth.token, body: { categories: selected } }))}>Save topics</button>
  </details>;
}

function CategoryRow({ category, auth, run }) {
  const {t}=usePreferences();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(category.title);
  const [description, setDescription] = useState(category.description || '');

  useEffect(() => { setTitle(category.title); setDescription(category.description || ''); }, [category.title, category.description]);

  async function save(event) {
    event.preventDefault();
    const result = await run(() => api('/categories/' + category.id, {
      method: 'PATCH', token: auth.token, body: { title, description },
    }));
    if (result) setEditing(false);
  }
  function remove() {
    if (window.confirm('Delete category ' + category.title + '?')) {
      run(() => api('/categories/' + category.id, { method: 'DELETE', token: auth.token }));
    }
  }

  return <div className="adminListItem">
    <div className="adminItemLine">
      <div className="adminItemText">
        <h3>{t(category.title)}</h3>
        <p>{t(category.description || 'No description')}</p>
      </div>
      <div className="adminRowTools">
        <button type="button" aria-label={'Edit category ' + category.title} onClick={() => setEditing(value => !value)}><Icon name="edit" size={18}/><span>Edit</span></button>
        <button type="button" className="dangerText" onClick={remove}><Icon name="close" size={18}/><span>Delete</span></button>
      </div>
    </div>
    {editing && <form className="adminInlineForm" onSubmit={save}>
      <div className="adminFields">
        <label>Title<input value={title} maxLength="100" required onChange={event => setTitle(event.target.value)} /></label>
        <label>Description<input value={description} onChange={event => setDescription(event.target.value)} /></label>
      </div>
      <div className="adminFormActions">
        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        <button type="submit" className="primary">Save category</button>
      </div>
    </form>}
  </div>;
}

export default function AdminPage() {
  const {t}=usePreferences();
  const auth = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const [tab, setTab] = useState('users');
  const [reportStatus,setReportStatus] = useState('open');
  const [reportPage,setReportPage] = useState(1);
  const [reportPagination,setReportPagination] = useState(null);
  const [postPage, setPostPage] = useState(1);
  const [postPagination, setPostPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [data, setData] = useState({ users: [], posts: [], categories: [], comments: [], reactions: [], reports: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ login: '', email: '', fullName: '', role: 'user', password: '', passwordConfirmation: '' });
  const [newCategory, setNewCategory] = useState({ title: '', description: '' });

  async function load() {
    if (!['admin','moderator'].includes(auth?.user?.role)) return;
    setError(null);
    setLoading(true);
    try {
      const [users, posts, categories, comments, reactions, reports] = await Promise.all([
        moderator ? Promise.resolve({data:[]}) : api('/users', { token: auth.token }),
        api('/posts?limit=20&page=' + postPage + '&sort=date&order=desc', { token: auth.token }),
        api('/categories'),
        api('/comments', { token: auth.token }),
        api('/reactions?limit=100', { token: auth.token }),
        api('/reports?status='+reportStatus+'&page='+reportPage,{token:auth.token}),
      ]);
      setData({ users: users.data, posts: posts.data, categories: categories.data, comments: comments.data, reactions: reactions.data, reports: reports.data });
      setReportPagination(reports.pagination);
      const pagination = posts.pagination || { page: postPage, total: posts.data.length, totalPages: 1 };
      setPostPagination(pagination);
      if (postPage > Math.max(1, pagination.totalPages)) setPostPage(Math.max(1, pagination.totalPages));
    } catch (err) { setError(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [auth?.token, auth?.user?.role, postPage,reportStatus,reportPage]);
  useEffect(()=>{if(auth?.user?.role==='moderator')setTab('reports');},[auth?.user?.role]);

  if (!['admin','moderator'].includes(auth?.user?.role)) return <main><div className="error">Admin access required.</div></main>;

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
    const roleOnly = form.role !== undefined &&
      Object.keys(form).every(key=>key==='role' ||
        (key==='login' && form.login===user.login) ||
        (key==='email' && form.email===user.email) ||
        (key==='fullName' && form.fullName===(user.full_name||'')));
    const path = '/users/' + user.id + (roleOnly ? '/role' : '');
    const result = await run(() => api(path, { method: 'PATCH', token: auth.token,
      body: roleOnly ? {role:form.role} : form }));
    if (result?.sessionInvalidated && Number(user.id) === Number(auth.user.id)) {
      dispatch({ type: 'AUTH_CLEAR' });
      go('/login');
    }
    return result;
  }

  function deleteUser(user) {
    if (!window.confirm('Delete ' + user.login + '? Their posts and comments will also be removed.')) return;
    run(() => api('/users/' + user.id, { method: 'DELETE', token: auth.token }));
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

  const moderator = auth?.user?.role === 'moderator';
  const counts = {
    users: data.users.length,
    posts: postPagination.total,
    categories: data.categories.length,
    comments: data.comments.length,
    reports: reportPagination?.total||0,
  };
  const sections = moderator ? ['reports','posts','comments','reactions'] : ['users','reports','posts','categories','comments','reactions'];

  return <main className="adminPage">
    <header className="adminTop">
      <div>
        <p className="adminEyebrow">Circle / Management</p>
        <h1>{t('Admin')}</h1>
        <p className="adminSubtitle">{t('Keep your community running smoothly.')}</p>
      </div>
      <button className="adminRefresh" type="button" onClick={load} disabled={loading} title="Refresh data">
        <Icon name="refresh" size={19}/><span>{t('Refresh')}</span>
      </button>
    </header>
    <nav className="tabs adminTabs" aria-label="Admin sections">
      {sections.map(name => <button type="button" key={name}
        className={tab === name ? 'active' : ''} aria-pressed={tab === name}
        onClick={() => setTab(name)}>
        {t(name.charAt(0).toUpperCase()+name.slice(1))}{name in counts && <span className="adminTabCount">{counts[name]}</span>}
      </button>)}
    </nav>
    <ErrorBox error={error}/>
    {loading ? <p className="adminLoading">{t('Loading community data…')}</p> : <>
      {tab === 'reports' && <section className="adminStack" aria-label="Content reports">
        <div className="adminSectionHeader"><h2>{t('Reported content')}</h2>
          <span>{reportPagination?.total||0} reports</span></div>
        <label className="reportsFilter">Show
          <select value={reportStatus} onChange={e=>{setReportStatus(e.target.value);setReportPage(1);}}>
            <option value="open">Open</option><option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option><option value="all">All</option>
          </select>
        </label>
        <div className="adminSimpleList">
          {data.reports.length?data.reports.map(report=><article key={report.id} className="adminListItem">
            <div className="adminItemText">
              <strong>{report.reason.replace('_',' ')} · {report.status}</strong>
              <p>Reported by @{report.reporter_login} · {report.post_title||report.comment_content||'Deleted item'}</p>
              {report.details&&<p>{report.details}</p>}
            </div>
            <div className="adminRowTools">
              <button type="button" onClick={()=>go('/post/'+(report.post_id||report.comment_post_id))}>Open discussion</button>
              {report.status!=='reviewed'&&<button type="button" onClick={()=>run(()=>api('/reports/'+report.id,{
                method:'PATCH',token:auth.token,body:{status:'reviewed'}}))}>Mark reviewed</button>}
              {report.status!=='dismissed'&&<button type="button" onClick={()=>run(()=>api('/reports/'+report.id,{
                method:'PATCH',token:auth.token,body:{status:'dismissed'}}))}>Dismiss</button>}
            </div>
          </article>):<p className="adminEmpty">No reports in this category.</p>}
        </div>
        {reportPagination?.totalPages>1&&<nav className="pager" aria-label="Report pages">
          <button type="button" disabled={reportPage<=1} onClick={()=>setReportPage(p=>p-1)}>Previous</button>
          <span>Page {reportPage} of {reportPagination.totalPages}</span>
          <button type="button" disabled={reportPage>=reportPagination.totalPages} onClick={()=>setReportPage(p=>p+1)}>Next</button>
        </nav>}
      </section>}
      {tab === 'users' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Members')}</h2>
          <span>{data.users.length} total</span>
        </div>
        <p className="roleHowTo"><Icon name="shield" size={18}/>
          To give someone moderator access, click <strong>Make moderator</strong> next to their account.
          Moderators can manage reports and content, not users or roles. The change applies automatically and an in-app notification is sent.
        </p>
        <details className="adminCreate">
          <summary><Icon name="plus" size={20}/> {t('Add member')} <Icon name="chevron" size={17}/></summary>
          <form className="adminCreateForm" onSubmit={createUser}>
            <h3>Create user</h3>
            <div className="adminFields">
              <label>Login<input required minLength="3" maxLength="50" value={newUser.login} onChange={event => setNewUser({ ...newUser, login: event.target.value })}/></label>
              <label>Email<input type="email" required value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })}/></label>
              <label>Full name<input maxLength="100" value={newUser.fullName} onChange={event => setNewUser({ ...newUser, fullName: event.target.value })}/></label>
              <label>Role<select value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value })}><option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option></select></label>
              <label>Password<input type="password" minLength="8" maxLength="128" required value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })}/></label>
              <label>Confirm<input type="password" minLength="8" maxLength="128" required value={newUser.passwordConfirmation} onChange={event => setNewUser({ ...newUser, passwordConfirmation: event.target.value })}/></label>
            </div>
            <div className="adminFormActions"><button type="submit" className="primary">Create user</button></div>
          </form>
        </details>
        <div className="adminSimpleList">
          {data.users.map(user => <UserRow key={user.id + '-' + user.login + '-' + user.role} user={user} auth={auth} onSave={saveUser} onDelete={deleteUser}/>)}
        </div>
      </section>}

      {tab === 'posts' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Posts')}</h2><span>{postPagination.total} total</span></div>
        <div className="adminSimpleList">
          {data.posts.length ? data.posts.map(post => <article className="adminListItem adminRow" key={post.id}>
            <div className="adminItemLine">
              <div className="adminItemText">
                <div className="adminPostMeta"><button className="adminName" onClick={() => go('/profile/' + post.author_id)}>@{post.author_login}</button> · #{post.id} <StatusBadges item={post}/></div>
                <h3>{post.title}</h3>
                <div className="adminPostTopics">{post.categories?.map(item => <span key={item.id}>{t(item.title)}</span>)}</div>
                {!moderator&&<PostCategoryEditor post={post} categories={data.categories} auth={auth} run={run}/>}
              </div>
              <div className="adminRowTools adminPostTools">
                <button type="button" onClick={() => go('/post/' + post.id)}>Open</button>
                {(!moderator||post.author_role!=='admin')&&<>
                <button type="button" onClick={() => run(() => api('/posts/' + post.id, { method: 'PATCH', token: auth.token, body: { status: post.status === 'active' ? 'inactive' : 'active' } }))}>{post.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                <button type="button" onClick={() => run(() => api('/posts/' + post.id, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(post.locked) } }))}>{post.locked ? 'Unlock' : 'Lock'}</button>
                <button type="button" className="dangerText" onClick={() => { if (window.confirm('Delete this post?')) run(() => api('/posts/' + post.id, { method: 'DELETE', token: auth.token })); }}>Delete</button></>}
              </div>
            </div>
          </article>) : <p className="adminEmpty">No posts on this page.</p>}
        </div>
        <nav className="pager" aria-label="Admin post pages">
          <button type="button" disabled={postPage <= 1 || loading} onClick={() => setPostPage(value => Math.max(1, value - 1))}>Previous</button>
          <span aria-live="polite">Page {postPage} of {Math.max(1, postPagination.totalPages)} · {postPagination.total} posts</span>
          <button type="button" disabled={postPage >= Math.max(1, postPagination.totalPages) || loading} onClick={() => setPostPage(value => value + 1)}>Next</button>
        </nav>
      </section>}

      {tab === 'categories' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Topics')}</h2><span>{data.categories.length} total</span></div>
        <details className="adminCreate">
          <summary><Icon name="plus" size={20}/> {t('Add topic')} <Icon name="chevron" size={17}/></summary>
          <form className="adminCreateForm" onSubmit={createCategory}>
            <h3>Create category</h3>
            <div className="adminFields">
              <label>Title<input required maxLength="100" value={newCategory.title} onChange={event => setNewCategory({ ...newCategory, title: event.target.value })}/></label>
              <label>Description<input value={newCategory.description} onChange={event => setNewCategory({ ...newCategory, description: event.target.value })}/></label>
            </div>
            <div className="adminFormActions"><button className="primary" type="submit">Create category</button></div>
          </form>
        </details>
        <div className="adminSimpleList">
          {data.categories.map(category => <CategoryRow key={category.id} category={category} auth={auth} run={run}/>)}
        </div>
      </section>}

      {tab === 'comments' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Comments')}</h2><span>{data.comments.length} listed</span></div>
        <div className="adminSimpleList">
          {data.comments.length ? data.comments.map(comment => <article className="adminListItem adminRow" key={comment.id}>
            <div className="adminItemLine">
              <div className="adminItemText">
                <div className="adminPostMeta"><strong>@{comment.author_login}</strong> on {comment.post_title} <StatusBadges item={comment}/></div>
                <p className="adminCommentText">{comment.content}</p>
              </div>
              <div className="adminRowTools adminPostTools">
                <button type="button" onClick={() => go('/post/' + comment.post_id)}>Open</button>
                {(!moderator||(comment.author_role!=='admin' && comment.post_author_role!=='admin'))&&<>
                <button type="button" onClick={() => run(() => api('/comments/' + comment.id, { method: 'PATCH', token: auth.token, body: { status: comment.status === 'active' ? 'inactive' : 'active' } }))}>{comment.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                <button type="button" onClick={() => run(() => api('/comments/' + comment.id, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(comment.locked) } }))}>{comment.locked ? 'Unlock' : 'Lock'}</button>
                <button type="button" className="dangerText" onClick={() => { if (window.confirm('Delete this comment?')) run(() => api('/comments/' + comment.id, { method: 'DELETE', token: auth.token })); }}>Delete</button></>}
              </div>
            </div>
          </article>) : <p className="adminEmpty">No comments.</p>}
        </div>
      </section>}

      {tab === 'reactions' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Reactions')}</h2><span>100 latest maximum</span></div>
        <p className="adminSectionNote">Removing a reaction recalculates the author's rating.</p>
        <div className="adminSimpleList">
          {data.reactions.length ? data.reactions.map(item => <div className="adminListItem" key={item.id}>
            <div className="adminItemLine">
              <div className="adminItemText"><h3>@{item.author_login} <span className="adminRoleChip">{item.type}</span></h3><p>{item.post_title || 'Deleted post'}</p></div>
              <div className="adminRowTools"><button type="button" className="dangerText"
                onClick={() => { if (window.confirm('Remove this reaction?')) run(() => api('/reactions/' + item.id, { method: 'DELETE', token: auth.token })); }}>Delete</button></div>
            </div>
          </div>) : <p className="adminEmpty">No reactions.</p>}
        </div>
      </section>}
    </>}
  </main>;
}
