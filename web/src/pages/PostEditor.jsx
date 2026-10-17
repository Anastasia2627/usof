import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';

export default function PostEditor({ id }) {
  const auth = useSelector((state) => state.auth);
  const {t} = usePreferences();
  const editing = Boolean(id);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', categories: [], publishAt: '', hideLikes: false });
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
          publishAt: result.data.publish_at ? new Date(result.data.publish_at).toISOString().slice(0,16) : '',
          hideLikes: Boolean(result.data.hide_likes),
        }))
        .catch(setError)
        .finally(() => setLoading(false));
    }
  }, [id, editing, auth?.token]);

  if (!auth) return <main><div className="card">{t('Log in to create or edit posts.')}</div></main>;
  if (auth.user.role === 'admin' && editing) {
    return <main><div className="card alert">Admins moderate post status, lock state and categories without editing user content. Use the post page or Admin console.</div></main>;
  }
  if (loading) return <main><div className="card loading">{t('Loading editor…')}</div></main>;

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
      setError(new Error(t('Select at least one category.')));
      return;
    }
    setBusy(true);
    try {
      const result = await api(editing ? `/posts/${id}` : '/posts', {
        method: editing ? 'PATCH' : 'POST',
        token: auth.token,
        body: {...form,publishAt:form.publishAt?new Date(form.publishAt).toISOString():null},
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
      <h1>{t(editing ? 'Edit post' : 'New post')}</h1>
    </div>

    <form className="postComposerForm" onSubmit={submit}>
      <div className="editorIdentity">
        <Avatar user={auth.user} size="md"/>
        <span>@{auth.user.login}</span>
        <small>{t('Posting to Circle')}</small>
      </div>
      <div className="editorInputGroup">
        <label className="srOnly" htmlFor="post-title">{t("Post title")}</label>
        <input id="post-title" className="editorTitleInput" maxLength="180" required
          value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}
          placeholder={t("Give your post a title…")} />
        <label className="srOnly" htmlFor="post-content">{t("Post details")}</label>
        <textarea id="post-content" className="editorContentInput" maxLength="50000" required
          value={form.content} onChange={event => setForm({ ...form, content: event.target.value })}
          placeholder={t("What's on your mind?")} />
      </div>

      <fieldset className="editorCategories">
        <legend>{t('Topics')} <span>{t('Choose one or more')}</span></legend>
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

      <details className="editorOptions">
        <summary><Icon name="settings" size={19}/> More options <Icon name="chevron" size={17}/></summary>
        <label className="editorOptionRow"><Icon name="lock" size={18}/>
          <span>Hide likes from other people<small>You can still see your own statistics</small></span>
          <input type="checkbox" aria-label="Hide likes" checked={form.hideLikes}
            onChange={e=>setForm({...form,hideLikes:e.target.checked})}/>
        </label>
        <label className="editorSchedule"><Icon name="settings" size={18}/>
          <span>Publish later<small>Leave empty to publish now</small></span>
          <input aria-label="Schedule publication" type="datetime-local" value={form.publishAt}
            min={new Date(Date.now()+60000).toISOString().slice(0,16)}
            onChange={e=>setForm({...form,publishAt:e.target.value})}/>
        </label>
      </details>
      <div className="editorActions">
        <span className="editorSelectionHint">{form.categories.length
          ? `${form.categories.length} ${t(form.categories.length === 1 ? 'topic' : 'topics')} ${t('selected')}`
          : t('Select a topic to continue')}</span>
        <button className="primary editorPublish" disabled={busy}>
          {t(busy ? 'Saving…' : editing ? 'Save changes' : form.publishAt ? 'Schedule post' : 'Publish post')}
          {!busy && <Icon name="arrow" size={18}/>}
        </button>
      </div>
      <ErrorBox error={error} />
    </form>
  </main>;
}
