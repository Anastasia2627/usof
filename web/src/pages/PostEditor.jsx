import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, go } from '../ui.jsx';

export default function PostEditor({ id }) {
  const auth = useSelector((state) => state.auth);
  const editing = Boolean(id);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', categories: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/categories').then((result) => setCategories(result.data)).catch(setError);
    if (editing && auth) {
      api(`/posts/${id}`, { token: auth.token })
        .then((result) => setForm({
          title: result.data.title,
          content: result.data.content,
          categories: result.data.categories.map((category) => Number(category.id)),
        }))
        .catch(setError)
        .finally(() => setLoading(false));
    }
  }, [id, editing, auth?.token]);

  if (!auth) return <main><div className="card">Log in to create or edit posts.</div></main>;
  if (auth.user.role === 'admin' && editing) {
    return <main><div className="card alert">Admins moderate post status, lock state and categories without editing user content. Use the post page or Admin console.</div></main>;
  }
  if (loading) return <main><div className="card loading">Loading editor…</div></main>;

  function toggle(categoryId) {
    setForm({
      ...form,
      categories: form.categories.includes(categoryId)
        ? form.categories.filter((value) => value !== categoryId)
        : [...form.categories, categoryId],
    });
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (!form.categories.length) {
      setError(new Error('Select at least one category.'));
      return;
    }
    setBusy(true);
    try {
      const result = await api(editing ? `/posts/${id}` : '/posts', {
        method: editing ? 'PATCH' : 'POST',
        token: auth.token,
        body: form,
      });
      go(`/post/${result.data.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return <main className="narrow editorPage">
    <div className="editorTopbar">
      <button className="editorBack" type="button" onClick={() => go(editing ? `/post/${id}` : '/')}
        aria-label="Back" title="Back"><Icon name="arrowBack" size={21}/></button>
      <h1>{editing ? 'Edit post' : 'New post'}</h1>
    </div>

    <form className="postComposerForm" onSubmit={submit}>
      <div className="editorIdentity">
        <Avatar user={auth.user} size="md"/>
        <span>@{auth.user.login}</span>
        <small>Posting to Circle</small>
      </div>
      <div className="editorInputGroup">
        <label className="srOnly" htmlFor="post-title">Post title</label>
        <input id="post-title" className="editorTitleInput" maxLength="180" required
          value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}
          placeholder="Give your post a title…" />
        <label className="srOnly" htmlFor="post-content">Post details</label>
        <textarea id="post-content" className="editorContentInput" maxLength="50000" required
          value={form.content} onChange={event => setForm({ ...form, content: event.target.value })}
          placeholder="What's on your mind?" />
      </div>

      <fieldset className="editorCategories">
        <legend>Topics <span>Choose one or more</span></legend>
        <div className="checkGrid editorTopicList">
          {categories.map(category =>
            <label className="check editorTopic" key={category.id}>
              <input type="checkbox" aria-label={category.title}
                checked={form.categories.includes(Number(category.id))}
                onChange={() => toggle(Number(category.id))} />
              <span>{category.title}</span>
            </label>
          )}
        </div>
      </fieldset>

      <div className="editorActions">
        <span className="editorSelectionHint">{form.categories.length
          ? `${form.categories.length} ${form.categories.length === 1 ? 'topic' : 'topics'} selected`
          : 'Select a topic to continue'}</span>
        <button className="primary editorPublish" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish post'}
          {!busy && <Icon name="arrow" size={18}/>}
        </button>
      </div>
      <ErrorBox error={error} />
    </form>
  </main>;
}
