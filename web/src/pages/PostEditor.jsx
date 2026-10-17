import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';
import FormattedContent from '../FormattedContent.jsx';
import PostPhotoGallery from '../PostPhotoGallery.jsx';
import {assetUrl} from '../api.js';

export default function PostEditor({ id }) {
  const auth = useSelector((state) => state.auth);
  const {t} = usePreferences();
  const editing = Boolean(id);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', categories: [], publishAt: '', hideLikes: false });
  const [selectedImages,setSelectedImages] = useState([]);
  const [draftPostId,setDraftPostId] = useState(null);
  const [existingImages,setExistingImages] = useState([]);
  const photoPreviewItems=useMemo(()=>[...existingImages,...selectedImages.map(file=>({file}))],[existingImages,selectedImages]);
  const [preview,setPreview] = useState(false);
  const [expandedTopics,setExpandedTopics] = useState(false);
  const editorRef=React.useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/categories').then((result) => setCategories(result.data)).catch(setError);
    if (editing && auth) {
      api(`/posts/${id}`, { token: auth.token })
        .then((result) => { setExistingImages(result.data.images||[]); setForm({
          title: result.data.title,
          content: result.data.content,
          categories: result.data.categories.map((category) => Number(category.id)),
          publishAt: result.data.publish_at ? new Date(result.data.publish_at).toISOString().slice(0,16) : '',
          hideLikes: Boolean(result.data.hide_likes),
        }); })
        .catch(setError)
        .finally(() => setLoading(false));
    }
  }, [id, editing, auth?.token]);

  if (!auth) return <main><div className="card">{t('Log in to create or edit posts.')}</div></main>;
  if (auth.user.role === 'admin' && editing) {
    return <main><div className="card alert">Admins moderate post status, lock state and categories without editing user content. Use the post page or Admin console.</div></main>;
  }
  if (loading) return <main><div className="card loading">{t('Loading editor…')}</div></main>;

  function applyFormat(prefix,suffix='',newLine=false){
    const el=editorRef.current;if(!el)return;
    const a=el.selectionStart,b=el.selectionEnd;
    const before=newLine&&a>0&&form.content[a-1]!=='\n'?'\n':'';
    const selected=form.content.slice(a,b);
    setForm({...form,content:form.content.slice(0,a)+before+prefix+selected+suffix+form.content.slice(b)});
    requestAnimationFrame(()=>{el.focus();el.setSelectionRange(a+before.length+prefix.length,a+before.length+prefix.length+selected.length);});
  }
  async function removeExisting(imageId){
    try{
      await api('/posts/'+id+'/images/'+imageId,{method:'DELETE',token:auth.token});
      setExistingImages(items=>items.filter(item=>item.id!==imageId));
    }catch(err){setError(err);}
  }
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
    if(selectedImages.length+existingImages.length>4){setError(new Error('Maximum four images per post'));return;}
    setBusy(true);
    try {
      // Keep the created draft if a later image upload fails: retrying must not create duplicate posts.
      const targetId=editing?id:draftPostId;
      const result = await api(targetId ? `/posts/${targetId}` : '/posts', {
        method: targetId ? 'PATCH' : 'POST',
        token: auth.token,
        body: {...form,publishAt:form.publishAt?new Date(form.publishAt).toISOString():null},
      });
      if(!editing)setDraftPostId(result.data.id);
      for(const image of selectedImages){
        const data=new FormData();data.append('image',image);
        await api('/posts/'+result.data.id+'/images',{method:'POST',token:auth.token,formData:data});
        setSelectedImages(current=>current.filter(item=>item!==image));
      }
      go(`/post/${result.data.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return <main className="narrow editorPage editorRefined">
    <div className="editorTopbar">
      <button className="editorBack" type="button" onClick={() => go(editing ? `/post/${id}` : '/')}
        aria-label="Back" title="Back"><Icon name="arrowBack" size={21}/></button>
      <div className="editorHeading">
        <span className="editorOverline">CIRCLE / COMMUNITY</span>
        <h1>{t(editing ? 'Edit post' : 'New post')}</h1>
      </div>
    </div>

    <p className="editorLead">{t('Share an idea, ask a question, or start a conversation.')}</p>
    <form className="postComposerForm" onSubmit={submit}>
      <div className="editorIdentity">
        <Avatar user={auth.user} size="md"/>
        <span>@{auth.user.login}</span>
        <small>{t('Posting to Circle')}</small>
      </div>
      <div className="editorInputGroup">
        <label className="editorFieldLabel" htmlFor="post-title">{t("Post title")}</label>
        <input id="post-title" className="editorTitleInput" maxLength="180" required
          value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}
          placeholder={t("Give your post a title…")} />
        <label className="editorFieldLabel editorBodyLabel" htmlFor="post-content">{t("Post details")}</label>
        <textarea ref={editorRef} id="post-content" className="editorContentInput" maxLength="50000" required
          value={form.content} onChange={event => setForm({ ...form, content: event.target.value })}
          placeholder={t("What's on your mind?")} />
        <div className="markdownToolbar" role="toolbar" aria-label="Formatting">
          <div className="markdownToolsGroup">
            <button type="button" aria-label="Bold" title="Bold" onClick={()=>applyFormat('**','**')}><strong>B</strong></button>
            <button type="button" aria-label="Heading" title="Heading" onClick={()=>applyFormat('## ','',true)}>H₂</button>
            <button type="button" aria-label="Bullet list" title="Bullet list" onClick={()=>applyFormat('- ','',true)}>≡</button>
            <button type="button" aria-label="Numbered list" title="Numbered list" onClick={()=>applyFormat('1. ','',true)}>1.</button>
          </div>
          <button className="editorPreviewToggle" type="button" onClick={()=>setPreview(p=>!p)} aria-pressed={preview}>
            <Icon name="search" size={16}/>{t(preview?'Hide preview':'Preview')}
          </button>
        </div>
        {preview && <section className="markdownPreview" aria-label="Post preview">
          <div className="postPreviewIdentity"><Avatar user={auth.user} size="sm"/><strong>@{auth.user.login}</strong></div>
          <h2>{form.title||t('Untitled post')}</h2>
          <FormattedContent text={form.content}/>
          <div className="postPreviewCategories">{categories.filter(category=>form.categories.includes(Number(category.id)))
            .map(category=><span key={category.id}>{t(category.title)}</span>)}</div>
        </section>}
        <div className="postPhotoEditor">
          <div className="editorPhotoAttachRow">
            <label className="editorPhotoAttach" htmlFor="post-photo-input">
              <Icon name="plus" size={18}/> {t('Add photos')}
            </label>
            <span>{t('Up to 4 photos · JPEG, PNG, WebP · 5 MB each')}</span>
            <input id="post-photo-input" className="editorFileInput" type="file"
              accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{
                const chosen=Array.from(e.target.files||[]);
                if(chosen.some(file=>file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))){
                  setError(new Error('Choose JPEG, PNG or WebP images under 5 MB each.'));return;
                }
                setSelectedImages(chosen);
                setError(null);
              }}/>
          </div>
          {(selectedImages.length>0||existingImages.length>0) && <>
            <div className="editorPhotoList">
            {selectedImages.map((file,i)=><div className="editorPhotoPill" key={file.name+file.size+i}>
              <Icon name="check" size={15}/>
              <span title={file.name}>{file.name}</span>
              <button type="button" title="Remove photo" aria-label={'Remove '+file.name}
                onClick={()=>setSelectedImages(items=>items.filter((_,index)=>index!==i))}>×</button>
            </div>)}
            {existingImages.map(image=><div className="editorPhotoPill editorUploadedPill" key={image.id}>
              <img src={assetUrl(image.url)} alt="Attached photo"/>
              <span>Photo {image.id}</span>
              <button type="button" title="Remove photo" aria-label={'Remove photo '+image.id}
                onClick={()=>removeExisting(image.id)}>×</button>
            </div>)}
          </div>
          <div className="editorPhotoLivePreview">
            <div className="editorPhotoPreviewHeading"><strong>{t('Photo preview')}</strong>
              <small>{t('Exactly as in the published post · click to enlarge')}</small></div>
            <PostPhotoGallery images={photoPreviewItems} local/>
          </div>
          </>}
        </div>
      </div>

      <fieldset className="editorCategories">
        <legend>{t('Topics')} <span>{t('Choose one or more')}</span></legend>
        <div className={'checkGrid editorTopicList'+(expandedTopics?' topicsExpanded':'')}>
          {categories.map(category =>
            <label className="check editorTopic" key={category.id}>
              <input type="checkbox" aria-label={category.title}
                checked={form.categories.includes(Number(category.id))}
                onChange={() => toggle(Number(category.id))} />
              <span>{category.title}</span>
            </label>
          )}
        </div>
        {categories.length>12 && <button className="editorShowTopics" type="button"
          onClick={()=>setExpandedTopics(value=>!value)}>
          {expandedTopics?t('Show fewer topics'):`${t('Show all topics')} (${categories.length})`}
          <Icon name="chevron" size={17}/>
        </button>}
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
