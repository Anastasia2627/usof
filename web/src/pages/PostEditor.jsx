import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';
import FormattedContent from '../FormattedContent.jsx';
import PostPhotoGallery from '../PostPhotoGallery.jsx';
import SuggestTopic from '../SuggestTopic.jsx';
import DatePicker from '../DatePicker.jsx';
import {assetUrl} from '../api.js';

function toLocalDateTime(value) {
  if (!value) return '';
  const date=new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,16);
}

export default function PostEditor({ id }) {
  const auth = useSelector((state) => state.auth);
  const {t} = usePreferences();
  const editing = Boolean(id);
  const draftKey=!editing && auth?.user?.id ? 'circle:post-draft:'+auth.user.id : null;
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(()=>{
    const blank={ title: '', content: '', categories: [], publishAt: '', hideLikes: false };
    if(!draftKey) return blank;
    try{
      const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');
      if(saved && typeof saved.title==='string' && typeof saved.content==='string' &&
          Array.isArray(saved.categories))return {...blank,...saved};
    }catch{/* Corrupt or unavailable storage should never prevent writing a post. */}
    return blank;
  });
  const [selectedImages,setSelectedImages] = useState([]);
  const [draftPostId,setDraftPostId] = useState(null);
  const [existingImages,setExistingImages] = useState([]);
  const photoPreviewItems=useMemo(()=>[...existingImages,...selectedImages.map(file=>({file}))],[existingImages,selectedImages]);
  const [preview,setPreview] = useState(false);
  const [expandedTopics,setExpandedTopics] = useState(false);
  const [topicQuery,setTopicQuery] = useState('');
  const editorRef=React.useRef(null);
  const topicListRef=React.useRef(null);
  useEffect(()=>{if(topicListRef.current)topicListRef.current.scrollTop=0;},[topicQuery,expandedTopics]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);

  useEffect(()=>{
    if(!draftKey) return;
    try{
      if(form.title||form.content||form.categories.length||form.publishAt||form.hideLikes){
        sessionStorage.setItem(draftKey,JSON.stringify(form));
      }else sessionStorage.removeItem(draftKey);
    }catch{/* Browsers may deny tab storage; posting remains available. */}
  },[draftKey,form]);

  useEffect(() => {
    const refreshTopics=()=>api('/categories').then(result=>setCategories(result.data)).catch(setError);
    refreshTopics();
    window.addEventListener('circle:categories-updated',refreshTopics);
    if (editing && auth) {
      api(`/posts/${id}`, { token: auth.token })
        .then((result) => { setExistingImages(result.data.images||[]); setForm({
          title: result.data.title,
          content: result.data.content,
          categories: result.data.categories.map((category) => Number(category.id)),
          publishAt: toLocalDateTime(result.data.publish_at),
          hideLikes: Boolean(result.data.hide_likes),
        }); })
        .catch(setError)
        .finally(() => setLoading(false));
    }
    return()=>window.removeEventListener('circle:categories-updated',refreshTopics);
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
      if(draftKey)sessionStorage.removeItem(draftKey);
      go(`/post/${result.data.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const hasDraft=Boolean(!editing&&!draftPostId&&(form.title||form.content||form.categories.length||form.publishAt));
  function clearDraft(){
    if(!window.confirm(t('Discard this draft?')))return;
    setForm({title:'',content:'',categories:[],publishAt:'',hideLikes:false});
    setSelectedImages([]);
    setPreview(false);
    try{if(draftKey)sessionStorage.removeItem(draftKey);}catch{}
  }

  const visibleTopics=categories.filter(category=>{
    const term=topicQuery.trim().toLocaleLowerCase();
    return !term || [category.title,t(category.title),category.description||'',t(category.description||'')]
      .some(value=>String(value).toLocaleLowerCase().includes(term));
  });
  return <main className="narrow editorPage editorRefined">
    <div className="editorTopbar">
      <button className="editorBack" type="button" onClick={() => go(editing ? `/post/${id}` : '/')}
        aria-label={t('Back')} title={t('Back')}><Icon name="arrowBack" size={21}/></button>
      <div className="editorHeading">
        <h1>{t(editing ? 'Edit post' : 'New post')}</h1>
      </div>
    </div>

    <form className="postComposerForm" onSubmit={submit}>
      <div className="editorIdentity">
        <Avatar user={auth.user} size="md"/>
        <span>@{auth.user.login}</span>
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
                onClick={()=>setSelectedImages(items=>items.filter((_,index)=>index!==i))}><Icon name="close" size={16}/></button>
            </div>)}
            {existingImages.map(image=><div className="editorPhotoPill editorUploadedPill" key={image.id}>
              <img src={assetUrl(image.url)} alt="Attached photo"/>
              <span>Photo {image.id}</span>
              <button type="button" title="Remove photo" aria-label={'Remove photo '+image.id}
                onClick={()=>removeExisting(image.id)}><Icon name="close" size={16}/></button>
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
        <div className="topicSearchField">
          <Icon name="search" size={18}/>
          <input type="search" aria-label={t('Search topics')}
            placeholder={t('Search topics')} value={topicQuery}
            onChange={event=>setTopicQuery(event.target.value)}/>
          {topicQuery&&<button type="button" aria-label={t('Clear search')} title={t('Clear search')}
            onClick={()=>setTopicQuery('')}><Icon name="close" size={16}/></button>}
        </div>
        <div className="topicSearchMeta">
          <span>{topicQuery ? `${visibleTopics.length} ${t('matching topics')}` : `${categories.length} ${t('topics')}`}</span>
          {form.categories.length>0&&<strong>{form.categories.length} {t('selected')}</strong>}
        </div>
        <div ref={topicListRef} className={'checkGrid editorTopicList'+(expandedTopics||topicQuery?' topicsExpanded':'')}>
          {visibleTopics.map(category =>
            <label className="check editorTopic" key={category.id}>
              <input type="checkbox" aria-label={t(category.title)}
                checked={form.categories.includes(Number(category.id))}
                onChange={() => toggle(Number(category.id))} />
              <span>{t(category.title)}</span>
            </label>
          )}
        </div>
        {topicQuery && visibleTopics.length===0 && <p className="topicSearchEmpty">{t('No matching topics')}</p>}
        {!topicQuery && categories.length>12 && <button className="editorShowTopics" type="button"
          onClick={()=>setExpandedTopics(value=>!value)}>
          {expandedTopics?t('Show fewer topics'):`${t('Show all topics')} (${categories.length})`}
          <Icon name="chevron" size={17}/>
        </button>}
        <SuggestTopic/>
      </fieldset>

      <details className="editorOptions">
        <summary><Icon name="settings" size={18}/> <span>{t('More options')}</span> <Icon name="chevron" size={17}/></summary>
        <div className="editorOptionRows">
          <div className="editorOptionRow">
            <label className="editorOptionCopy" htmlFor="editor-hide-likes">
              <strong>{t('Hide likes from other people')}</strong>
              <small>{t('You can still see your own statistics')}</small>
            </label>
            <input id="editor-hide-likes" type="checkbox" checked={form.hideLikes}
              onChange={e=>setForm({...form,hideLikes:e.target.checked})}/>
          </div>
          <div className="editorSchedule">
            <label className="editorOptionCopy" htmlFor="editor-publish-date">
              <strong>{t('Publish later')}</strong>
              <small>{t('Leave empty to publish now')}</small>
            </label>
            <DatePicker id="editor-publish-date" mode="datetime" label={t('Publish later')}
              value={form.publishAt} onChange={value=>setForm({...form,publishAt:value})}/>
          </div>
        </div>
      </details>
      {!editing && hasDraft && <div className="editorDraftNotice">
        <button type="button" onClick={clearDraft}>{t('Discard draft')}</button>
      </div>}
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
