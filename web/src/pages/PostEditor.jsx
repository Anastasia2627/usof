import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';

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

  if (!auth) return <main><div className="card">Log in to create or edit questions.</div></main>;
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
    <p className="eyebrow">{editing ? 'Improve your question' : 'Share a problem'}</p>
    <h1>{editing ? 'Edit question' : 'Ask a question'}</h1>
    <form className="card form" onSubmit={submit}>
      <label>Title<input maxLength="180" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What exactly are you trying to solve?" /></label>
      <label>Details<textarea maxLength="50000" required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Explain what you tried, expected and observed." /></label>
      <fieldset><legend>Categories</legend><div className="checkGrid">{categories.map((category) => <label className="check" key={category.id}><input type="checkbox" checked={form.categories.includes(Number(category.id))} onChange={() => toggle(Number(category.id))} />{category.title}</label>)}</div></fieldset>
      <button className="primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish question'}</button>
      <ErrorBox error={error} />
    </form>
  </main>;
}
