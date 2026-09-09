import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api, assetUrl } from './api.js';

const go = (path) => { window.location.hash = path; };
const currentHash = () => window.location.hash.slice(1) || '/';
const fmt = (value) => value ? new Date(value).toLocaleString() : '—';

function useHash() {
  const [hash, setHash] = useState(currentHash());
  useEffect(() => {
    const onHash = () => setHash(currentHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="card alert error" role="alert">{error.message || String(error)}</div>;
}

function Avatar({ user, size = 'md' }) {
  if (user?.avatar) return <img className={`avatar avatar-${size}`} src={assetUrl(user.avatar)} alt={`${user.login} avatar`} />;
  return <span className={`avatar avatar-${size} avatar-fallback`} aria-hidden="true">{(user?.login || '?').slice(0, 1).toUpperCase()}</span>;
}

function StatusBadges({ item }) {
  return <span className="badges">
    {item.status && <span className={`badge ${item.status}`}>{item.status}</span>}
    {Boolean(item.locked) && <span className="badge locked">locked</span>}
  </span>;
}

function Header() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');

  async function logout() {
    try {
      if (auth?.token) await api('/auth/logout', { method: 'POST', token: auth.token });
    } catch {
      // Local session still has to be cleared when the server session is already invalid.
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

function AuthPage({ mode }) {
  const dispatch = useDispatch();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ identifier: '', login: '', email: '', fullName: '', password: '', passwordConfirmation: '' });
  const [error, setError] = useState(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isRegister) {
        const result = await api('/auth/register', { method: 'POST', body: {
          login: form.login,
          email: form.email,
          fullName: form.fullName,
          password: form.password,
          passwordConfirmation: form.passwordConfirmation,
        } });
        if (result.verificationToken) setVerificationToken(result.verificationToken);
        else go('/login');
      } else {
        const identifier = form.identifier.trim();
        const body = identifier.includes('@') ? { email: identifier, password: form.password } : { login: identifier, password: form.password };
        const result = await api('/auth/login', { method: 'POST', body });
        dispatch({ type: 'AUTH_SET', payload: result });
        go('/');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (verificationToken) return <main className="narrow">
    <div className="card successPanel">
      <p className="eyebrow">Account created</p>
      <h1>Verify your email</h1>
      <p>In development mode Usof exposes the verification token so the flow can be tested without SMTP.</p>
      <code className="tokenBox">{verificationToken}</code>
      <button className="primary" onClick={() => go(`/verify/${verificationToken}`)}>Verify this account</button>
    </div>
  </main>;

  return <main className="narrow authPage">
    <p className="eyebrow">{isRegister ? 'Join the knowledge loop' : 'Good to see you again'}</p>
    <h1>{isRegister ? 'Create account' : 'Log in'}</h1>
    <form className="card form" onSubmit={submit}>
      {isRegister ? <>
        <label>Login<input autoComplete="username" minLength="3" maxLength="50" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} /></label>
        <label>Full name<input maxLength="100" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
        <label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      </> : <label>Login or email<input autoComplete="username" required value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} /></label>}
      <label>Password<input type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength="8" maxLength="128" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      {isRegister && <label>Confirm password<input type="password" autoComplete="new-password" minLength="8" maxLength="128" required value={form.passwordConfirmation} onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })} /></label>}
      <button className="primary" disabled={busy}>{busy ? 'Working…' : isRegister ? 'Create account' : 'Log in'}</button>
      <ErrorBox error={error} />
    </form>
    <div className="underForm">
      <button className="linkButton" onClick={() => go(isRegister ? '/login' : '/register')}>{isRegister ? 'Already have an account? Log in' : 'Need an account? Sign up'}</button>
      {!isRegister && <button className="linkButton" onClick={() => go('/reset')}>Forgot password?</button>}
    </div>
  </main>;
}

function VerifyPage({ token }) {
  const [state, setState] = useState({ busy: Boolean(token), message: '', error: null });
  const [manual, setManual] = useState(token || '');

  async function verify(value) {
    const clean = String(value || '').trim();
    if (!clean) return;
    setState({ busy: true, message: '', error: null });
    try {
      const result = await api(`/auth/verify-email/${encodeURIComponent(clean)}`, { method: 'POST' });
      setState({ busy: false, message: result.message, error: null });
    } catch (error) {
      setState({ busy: false, message: '', error });
    }
  }

  useEffect(() => { if (token) verify(token); }, [token]);

  return <main className="narrow">
    <h1>Email verification</h1>
    <div className="card form">
      {state.busy ? <p>Verifying…</p> : state.message ? <>
        <div className="alert success">{state.message}</div>
        <button className="primary" onClick={() => go('/login')}>Continue to login</button>
      </> : <>
        <label>Verification token<input value={manual} onChange={(e) => setManual(e.target.value)} /></label>
        <button className="primary" onClick={() => verify(manual)}>Verify email</button>
      </>}
      <ErrorBox error={state.error} />
    </div>
  </main>;
}

function ResetPage({ token }) {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [devToken, setDevToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);

  async function request(event) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api('/auth/password-reset', { method: 'POST', body: { email } });
      setMessage(result.message);
      setDevToken(result.resetToken || '');
    } catch (err) { setError(err); }
  }

  async function change(event) {
    event.preventDefault();
    setError(null);
    if (newPassword !== confirm) return setError(new Error('Password confirmation does not match'));
    try {
      const result = await api(`/auth/password-reset/${encodeURIComponent(token)}`, { method: 'POST', body: { newPassword } });
      setMessage(result.message);
    } catch (err) { setError(err); }
  }

  return <main className="narrow">
    <h1>{token ? 'Choose a new password' : 'Reset password'}</h1>
    <form className="card form" onSubmit={token ? change : request}>
      {token ? <>
        <label>New password<input type="password" minLength="8" maxLength="128" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
        <label>Confirm password<input type="password" minLength="8" maxLength="128" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        <button className="primary">Change password</button>
      </> : <>
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <button className="primary">Create reset link</button>
      </>}
      {message && <div className="alert success">{message}</div>}
      {devToken && <div className="devToken"><small>Development token</small><code>{devToken}</code><button type="button" className="secondary" onClick={() => go(`/reset/${devToken}`)}>Use token</button></div>}
      <ErrorBox error={error} />
    </form>
  </main>;
}

function PostCard({ post }) {
  return <article className="card postCard" onClick={() => go(`/post/${post.id}`)} tabIndex="0" onKeyDown={(e) => { if (e.key === 'Enter') go(`/post/${post.id}`); }}>
    <div className="scoreBox">{Number(post.score) > 0 ? '+' : ''}{post.score || 0}</div>
    <div>
      <div className="postMeta"><span>{post.author_login}</span><span>·</span><span>{fmt(post.created_at)}</span><StatusBadges item={post} /></div>
      <h2>{post.title}</h2>
      <p>{post.content?.slice(0, 190)}{post.content?.length > 190 ? '…' : ''}</p>
      <div className="tags">{post.categories?.map((category) => <span key={category.id}>{category.title}</span>)}</div>
    </div>
  </article>;
}

function HomePage({ hash }) {
  const auth = useSelector((state) => state.auth);
  const params = useMemo(() => new URLSearchParams(hash.split('?')[1] || ''), [hash]);
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    sort: params.get('sort') || 'date',
    category: params.get('category') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    status: params.get('status') || '',
  });

  useEffect(() => { api('/categories').then((r) => setCategories(r.data)).catch(setError); }, []);
  useEffect(() => {
    setFilters({ sort: params.get('sort') || 'date', category: params.get('category') || '', from: params.get('from') || '', to: params.get('to') || '', status: params.get('status') || '' });
    const controller = new AbortController();
    const query = new URLSearchParams({ page: params.get('page') || '1', limit: '8', sort: params.get('sort') || 'date', order: params.get('order') || 'desc' });
    for (const key of ['search', 'category', 'from', 'to', 'status']) if (params.get(key)) query.set(key, params.get(key));
    setLoading(true); setError(null);
    api(`/posts?${query}`, { token: auth?.token, signal: controller.signal }).then((r) => { setPosts(r.data); setPagination(r.pagination); }).catch((err) => { if (err.name !== 'AbortError') setError(err); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [hash, auth?.token]);

  function applyFilters(event) {
    event.preventDefault();
    const query = new URLSearchParams();
    const search = params.get('search');
    if (search) query.set('search', search);
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    go(query.size ? `/?${query}` : '/');
  }

  function page(number) {
    const query = new URLSearchParams(params);
    query.set('page', String(number));
    go(`/?${query}`);
  }

  return <main>
    <section className="hero">
      <p className="eyebrow">Programming questions, answered by people.</p>
      <h1>Ask clearly.<br />Answer usefully.</h1>
      {params.get('search') && <p className="searchCaption">Results for “{params.get('search')}” <button className="linkButton" onClick={() => go('/')}>clear</button></p>}
    </section>
    <form className="filterBar card" onSubmit={applyFilters}>
      <label>Sort<select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="date">Newest</option><option value="likes">Score</option></select></label>
      <label>Category<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <label>From<input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
      <label>To<input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
      {auth?.user?.role === 'admin' && <label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
      <button className="secondary">Apply</button>
    </form>
    <ErrorBox error={error} />
    {loading ? <div className="card loading">Loading questions…</div> : posts.length ? <section className="postList">{posts.map((post) => <PostCard key={post.id} post={post} />)}</section> : <div className="card empty"><h2>No questions found</h2><p>Try changing the filters or ask the first question.</p></div>}
    {pagination && pagination.totalPages > 1 && <div className="pager"><button disabled={pagination.page <= 1} onClick={() => page(pagination.page - 1)}>← Previous</button><span>Page {pagination.page} / {pagination.totalPages}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => page(pagination.page + 1)}>Next →</button></div>}
  </main>;
}

function CommentNode({ comment, allComments, postId, auth, reload, depth = 0 }) {
  const children = allComments.filter((item) => Number(item.parent_comment_id) === Number(comment.id));
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState(null);
  const isAdmin = auth?.user?.role === 'admin';
  const isOwner = Number(auth?.user?.id) === Number(comment.author_id);

  async function action(work) {
    setError(null);
    try { await work(); await reload(); } catch (err) { setError(err); }
  }

  async function submitReply(event) {
    event.preventDefault();
    await action(() => api(`/posts/${postId}/comments`, { method: 'POST', token: auth.token, body: { content: reply, parentCommentId: comment.id } }));
    setReply(''); setReplying(false);
  }

  return <div className="commentBranch" style={{ '--depth': Math.min(depth, 5) }}>
    <article className="card commentCard">
      <div className="commentTop"><div className="authorLine"><Avatar user={{ login: comment.author_login, avatar: comment.author_avatar }} size="sm" /><b>{comment.author_login}</b><span className="muted">{fmt(comment.created_at)}</span></div><StatusBadges item={comment} /></div>
      <p className="commentContent">{comment.content}</p>
      <div className="commentActions">
        <span className="scoreText">Score {comment.score || 0}</span>
        {auth && <><button onClick={() => action(() => api(`/comments/${comment.id}/like`, { method: 'POST', token: auth.token, body: { type: 'like' } }))}>▲ Like</button><button onClick={() => action(() => api(`/comments/${comment.id}/like`, { method: 'POST', token: auth.token, body: { type: 'dislike' } }))}>▼ Dislike</button>{!comment.locked && comment.status === 'active' && <button onClick={() => setReplying(!replying)}>Reply</button>}</>}
        {(isOwner || isAdmin) && <button onClick={() => action(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { status: comment.status === 'active' ? 'inactive' : 'active' } }))}>{comment.status === 'active' ? 'Hide' : 'Activate'}</button>}
        {isAdmin && <button onClick={() => action(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(comment.locked) } }))}>{comment.locked ? 'Unlock' : 'Lock'}</button>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={() => { if (window.confirm('Delete this comment and its replies?')) action(() => api(`/comments/${comment.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button>}
      </div>
      {replying && <form className="replyForm" onSubmit={submitReply}><label className="srOnly" htmlFor={`reply-${comment.id}`}>Reply</label><textarea id={`reply-${comment.id}`} required value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${comment.author_login}…`} /><div><button className="primary compact">Post reply</button><button type="button" className="quietButton" onClick={() => setReplying(false)}>Cancel</button></div></form>}
      <ErrorBox error={error} />
    </article>
    {children.map((child) => <CommentNode key={child.id} comment={child} allComments={allComments} postId={postId} auth={auth} reload={reload} depth={depth + 1} />)}
  </div>;
}

function PostPage({ id }) {
  const auth = useSelector((state) => state.auth);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    try {
      const [postResult, commentResult] = await Promise.all([api(`/posts/${id}`, { token: auth?.token }), api(`/posts/${id}/comments`, { token: auth?.token })]);
      setPost(postResult.data); setComments(commentResult.data);
    } catch (err) { setError(err); } finally { setLoading(false); }
  }
  useEffect(() => { setLoading(true); load(); }, [id, auth?.token]);

  if (loading) return <main><div className="card loading">Loading question…</div></main>;
  if (!post) return <main><ErrorBox error={error} /></main>;
  const isAdmin = auth?.user?.role === 'admin';
  const isOwner = Number(auth?.user?.id) === Number(post.author_id);
  const roots = comments.filter((comment) => !comment.parent_comment_id);

  async function react(type) { try { await api(`/posts/${id}/like`, { method: 'POST', token: auth.token, body: { type } }); await load(); } catch (err) { setError(err); } }
  async function comment(event) { event.preventDefault(); try { await api(`/posts/${id}/comments`, { method: 'POST', token: auth.token, body: { content: text } }); setText(''); await load(); } catch (err) { setError(err); } }
  async function moderate(body) { try { await api(`/posts/${id}`, { method: 'PATCH', token: auth.token, body }); await load(); } catch (err) { setError(err); } }
  async function remove() { if (!window.confirm('Delete this question? This also removes its comments and reactions.')) return; try { await api(`/posts/${id}`, { method: 'DELETE', token: auth.token }); go('/'); } catch (err) { setError(err); } }

  return <main className="postPage">
    <article className="card questionCard">
      <div className="questionHeading"><div><p className="eyebrow">Question #{post.id}</p><h1>{post.title}</h1></div><div className="scoreHero">{Number(post.score) > 0 ? '+' : ''}{post.score || 0}</div></div>
      <div className="postMeta"><span>by <b>{post.author_login}</b></span><span>{fmt(post.created_at)}</span><StatusBadges item={post} /></div>
      <p className="content">{post.content}</p>
      <div className="tags">{post.categories?.map((c) => <span key={c.id}>{c.title}</span>)}</div>
      <div className="toolbar">
        {auth && <><button onClick={() => react('like')}>▲ Like</button><button onClick={() => react('dislike')}>▼ Dislike</button></>}
        {isOwner && !isAdmin && <button onClick={() => go(`/edit/${post.id}`)}>Edit question</button>}
        {isAdmin && <><button onClick={() => moderate({ status: post.status === 'active' ? 'inactive' : 'active' })}>{post.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => moderate({ locked: !Boolean(post.locked) })}>{post.locked ? 'Unlock' : 'Lock'}</button></>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={remove}>Delete</button>}
      </div>
      <ErrorBox error={error} />
    </article>
    <section className="commentsSection">
      <div className="sectionTitle"><div><p className="eyebrow">Discussion</p><h2>{comments.length} comment{comments.length === 1 ? '' : 's'}</h2></div></div>
      {roots.length ? roots.map((comment) => <CommentNode key={comment.id} comment={comment} allComments={comments} postId={post.id} auth={auth} reload={load} />) : <div className="card empty">No comments yet.</div>}
      {auth ? post.locked && !isAdmin ? <div className="card alert">This question is locked. New comments are disabled.</div> : <form className="card form commentComposer" onSubmit={comment}><label>Add a comment<textarea required value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a useful answer or clarification…" /></label><button className="primary">Post comment</button></form> : <div className="card signInPrompt">Log in to comment or react. <button className="linkButton" onClick={() => go('/login')}>Log in</button></div>}
    </section>
  </main>;
}

function PostEditor({ id }) {
  const auth = useSelector((state) => state.auth);
  const editing = Boolean(id);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', categories: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    api('/categories').then((r) => setCategories(r.data)).catch(setError);
    if (editing && auth) api(`/posts/${id}`, { token: auth.token }).then((r) => setForm({ title: r.data.title, content: r.data.content, categories: r.data.categories.map((c) => Number(c.id)) })).catch(setError).finally(() => setLoading(false));
  }, [id, editing, auth?.token]);

  if (!auth) return <main><div className="card">Log in to create or edit questions.</div></main>;
  if (auth.user.role === 'admin' && editing) return <main><div className="card alert">Admins moderate post status, lock state and categories without editing user content. Use the post page or Admin console.</div></main>;
  if (loading) return <main><div className="card loading">Loading editor…</div></main>;

  function toggle(categoryId) { setForm({ ...form, categories: form.categories.includes(categoryId) ? form.categories.filter((idValue) => idValue !== categoryId) : [...form.categories, categoryId] }); }
  async function submit(event) {
    event.preventDefault(); setError(null);
    try {
      const result = await api(editing ? `/posts/${id}` : '/posts', { method: editing ? 'PATCH' : 'POST', token: auth.token, body: form });
      go(`/post/${result.data.id}`);
    } catch (err) { setError(err); }
  }

  return <main className="narrow editorPage"><p className="eyebrow">{editing ? 'Improve your question' : 'Share a problem'}</p><h1>{editing ? 'Edit question' : 'Ask a question'}</h1><form className="card form" onSubmit={submit}>
    <label>Title<input maxLength="180" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What exactly are you trying to solve?" /></label>
    <label>Details<textarea maxLength="50000" required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Explain what you tried, expected and observed." /></label>
    <fieldset><legend>Categories</legend><div className="checkGrid">{categories.map((category) => <label className="check" key={category.id}><input type="checkbox" checked={form.categories.includes(Number(category.id))} onChange={() => toggle(Number(category.id))} />{category.title}</label>)}</div></fieldset>
    <button className="primary">{editing ? 'Save changes' : 'Publish question'}</button><ErrorBox error={error} />
  </form></main>;
}

function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => { api('/categories').then((r) => setCategories(r.data)).catch(setError); }, []);
  return <main><p className="eyebrow">Browse by technology</p><h1>Categories</h1><ErrorBox error={error} /><section className="categoryGrid">{categories.map((category) => <button className="card categoryCard" key={category.id} onClick={() => go(`/?category=${category.id}`)}><span className="categoryIndex">{String(category.id).padStart(2, '0')}</span><h2>{category.title}</h2><p>{category.description}</p></button>)}</section></main>;
}

function ProfilePage() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [user, setUser] = useState(auth?.user || null);
  const [name, setName] = useState(auth?.user?.full_name || '');
  const [posts, setPosts] = useState([]);
  const [sort, setSort] = useState('date');
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  async function load() {
    if (!auth) return;
    try {
      const [userResult, postResult] = await Promise.all([api(`/users/${auth.user.id}`, { token: auth.token }), api(`/posts?author=${auth.user.id}&limit=50&sort=${sort}${status ? `&status=${status}` : ''}`, { token: auth.token })]);
      setUser(userResult.data); setName(userResult.data.full_name || ''); setPosts(postResult.data); dispatch({ type: 'AUTH_USER_SET', payload: userResult.data });
    } catch (err) { setError(err); }
  }
  useEffect(() => { load(); }, [auth?.token, sort, status]);
  if (!auth) return <main><div className="card">Log in to view your profile.</div></main>;

  async function save(event) { event.preventDefault(); setError(null); try { const result = await api(`/users/${auth.user.id}`, { method: 'PATCH', token: auth.token, body: { fullName: name } }); setUser(result.data); dispatch({ type: 'AUTH_USER_SET', payload: result.data }); setMessage('Profile saved.'); } catch (err) { setError(err); } }
  async function upload(event) { const file = event.target.files?.[0]; if (!file) return; const data = new FormData(); data.append('avatar', file); try { const result = await api('/users/avatar', { method: 'PATCH', token: auth.token, formData: data }); setUser(result.data); dispatch({ type: 'AUTH_USER_SET', payload: result.data }); setMessage('Avatar updated.'); } catch (err) { setError(err); } }

  return <main>
    <section className="profileHero card"><Avatar user={user} size="xl" /><div><p className="eyebrow">{user?.role}</p><h1>{user?.login}</h1><p>{user?.email}</p></div><div className="profileScore"><small>Rating</small><strong>{user?.rating || 0}</strong></div></section>
    <div className="twoColumn">
      <form className="card form" onSubmit={save}><h2>Profile details</h2><label>Full name<input maxLength="100" value={name} onChange={(e) => setName(e.target.value)} /></label><label>Avatar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label><button className="primary">Save profile</button>{message && <div className="alert success">{message}</div>}<ErrorBox error={error} /></form>
      <section><div className="sectionTitle"><div><p className="eyebrow">Your activity</p><h2>Your questions</h2></div><div className="inlineFilters"><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="date">Newest</option><option value="likes">Score</option></select><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div></div>{posts.length ? <div className="miniList">{posts.map((post) => <PostCard key={post.id} post={post} />)}</div> : <div className="card empty">You have not published any questions yet.</div>}</section>
    </div>
  </main>;
}

function AdminPage() {
  const auth = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const [tab, setTab] = useState('users');
  const [data, setData] = useState({ users: [], posts: [], categories: [], comments: [] });
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ login: '', email: '', fullName: '', role: 'user', password: '', passwordConfirmation: '' });
  const [newCategory, setNewCategory] = useState({ title: '', description: '' });

  async function load() {
    if (auth?.user?.role !== 'admin') return;
    setError(null);
    try {
      const [users, posts, categories, comments] = await Promise.all([api('/users', { token: auth.token }), api('/posts?limit=50&sort=date', { token: auth.token }), api('/categories'), api('/comments', { token: auth.token })]);
      setData({ users: users.data, posts: posts.data, categories: categories.data, comments: comments.data });
    } catch (err) { setError(err); }
  }
  useEffect(() => { load(); }, [auth?.token]);
  if (auth?.user?.role !== 'admin') return <main><div className="card error">Admin access required.</div></main>;

  async function run(work) { setError(null); try { const result = await work(); await load(); return result; } catch (err) { setError(err); return null; } }
  async function changeUser(user, patch) { const result = await run(() => api(`/users/${user.id}`, { method: 'PATCH', token: auth.token, body: patch })); if (result?.sessionInvalidated && Number(user.id) === Number(auth.user.id)) { dispatch({ type: 'AUTH_CLEAR' }); go('/login'); } }
  async function createUser(event) { event.preventDefault(); const result = await run(() => api('/users', { method: 'POST', token: auth.token, body: newUser })); if (result) setNewUser({ login: '', email: '', fullName: '', role: 'user', password: '', passwordConfirmation: '' }); }
  async function createCategory(event) { event.preventDefault(); const result = await run(() => api('/categories', { method: 'POST', token: auth.token, body: newCategory })); if (result) setNewCategory({ title: '', description: '' }); }

  return <main className="adminPage"><div className="sectionTitle"><div><p className="eyebrow">Protected area</p><h1>Admin console</h1></div></div><div className="tabs">{['users', 'posts', 'categories', 'comments'].map((name) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>)}</div><ErrorBox error={error} />
    {tab === 'users' && <section className="adminStack"><form className="card form compactForm" onSubmit={createUser}><h2>Create user</h2><div className="formGrid"><label>Login<input required minLength="3" value={newUser.login} onChange={(e) => setNewUser({ ...newUser, login: e.target.value })} /></label><label>Email<input type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label><label>Full name<input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} /></label><label>Role<select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}><option value="user">user</option><option value="admin">admin</option></select></label><label>Password<input type="password" minLength="8" required value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} /></label><label>Confirm<input type="password" minLength="8" required value={newUser.passwordConfirmation} onChange={(e) => setNewUser({ ...newUser, passwordConfirmation: e.target.value })} /></label></div><button className="primary compact">Create user</button></form><div className="card tableWrap"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Rating</th><th>Actions</th></tr></thead><tbody>{data.users.map((user) => <tr key={user.id}><td><b>{user.login}</b><br /><small>{user.full_name}</small></td><td>{user.email}</td><td><select value={user.role} onChange={(e) => changeUser(user, { role: e.target.value })}><option value="user">user</option><option value="admin">admin</option></select></td><td>{user.rating}</td><td><button className="dangerText" disabled={Number(user.id) === Number(auth.user.id)} onClick={() => { if (window.confirm(`Delete ${user.login}?`)) run(() => api(`/users/${user.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button></td></tr>)}</tbody></table></div></section>}
    {tab === 'posts' && <div className="adminStack">{data.posts.map((post) => <article className="card adminRow" key={post.id}><div><div className="postMeta"><b>#{post.id} {post.author_login}</b><StatusBadges item={post} /></div><h3>{post.title}</h3><div className="tags">{post.categories?.map((c) => <span key={c.id}>{c.title}</span>)}</div></div><div className="adminActions"><button onClick={() => go(`/post/${post.id}`)}>Open</button><button onClick={() => run(() => api(`/posts/${post.id}`, { method: 'PATCH', token: auth.token, body: { status: post.status === 'active' ? 'inactive' : 'active' } }))}>{post.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => run(() => api(`/posts/${post.id}`, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(post.locked) } }))}>{post.locked ? 'Unlock' : 'Lock'}</button><button className="dangerText" onClick={() => { if (window.confirm('Delete this question?')) run(() => api(`/posts/${post.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button></div></article>)}</div>}
    {tab === 'categories' && <section className="adminStack"><form className="card form compactForm" onSubmit={createCategory}><h2>Create category</h2><div className="formGrid"><label>Title<input required value={newCategory.title} onChange={(e) => setNewCategory({ ...newCategory, title: e.target.value })} /></label><label>Description<input value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} /></label></div><button className="primary compact">Create category</button></form><div className="categoryGrid">{data.categories.map((category) => <article className="card" key={category.id}><h3>{category.title}</h3><p>{category.description}</p><div className="toolbar"><button onClick={() => { const title = window.prompt('Category title', category.title); if (title !== null) { const description = window.prompt('Description', category.description) ?? category.description; run(() => api(`/categories/${category.id}`, { method: 'PATCH', token: auth.token, body: { title, description } })); } }}>Edit</button><button className="dangerText" onClick={() => { if (window.confirm(`Delete ${category.title}?`)) run(() => api(`/categories/${category.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button></div></article>)}</div></section>}
    {tab === 'comments' && <div className="adminStack">{data.comments.map((comment) => <article className="card adminRow" key={comment.id}><div><div className="postMeta"><b>{comment.author_login}</b><span>on “{comment.post_title}”</span><StatusBadges item={comment} /></div><p>{comment.content}</p></div><div className="adminActions"><button onClick={() => go(`/post/${comment.post_id}`)}>Open post</button><button onClick={() => run(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { status: comment.status === 'active' ? 'inactive' : 'active' } }))}>{comment.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => run(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(comment.locked) } }))}>{comment.locked ? 'Unlock' : 'Lock'}</button><button className="dangerText" onClick={() => { if (window.confirm('Delete this comment?')) run(() => api(`/comments/${comment.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button></div></article>)}</div>}
  </main>;
}

function NotFoundPage() { return <main className="narrow"><div className="card empty"><p className="eyebrow">404</p><h1>Page not found</h1><button className="primary" onClick={() => go('/')}>Back home</button></div></main>; }

export default function App() {
  const hash = useHash();
  const path = hash.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  let page;
  if (path === '/') page = <HomePage hash={hash} />;
  else if (path === '/login') page = <AuthPage mode="login" />;
  else if (path === '/register') page = <AuthPage mode="register" />;
  else if (path === '/categories') page = <CategoriesPage />;
  else if (path === '/profile') page = <ProfilePage />;
  else if (path === '/create') page = <PostEditor />;
  else if (path === '/admin') page = <AdminPage />;
  else if (parts[0] === 'post' && parts[1]) page = <PostPage id={parts[1]} />;
  else if (parts[0] === 'edit' && parts[1]) page = <PostEditor id={parts[1]} />;
  else if (parts[0] === 'verify') page = <VerifyPage token={parts[1] || ''} />;
  else if (parts[0] === 'reset') page = <ResetPage token={parts[1] || ''} />;
  else page = <NotFoundPage />;

  return <><Header />{page}<footer>Usof · programming Q&amp;A · React + Redux + Express + MySQL</footer></>;
}
