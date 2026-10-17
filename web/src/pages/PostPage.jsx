import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, StatusBadges, fmt, go } from '../ui.jsx';
import { usePreferences } from '../preferences.jsx';
import FormattedContent from '../FormattedContent.jsx';
import ReportButton from '../ReportButton.jsx';
import PostPhotoGallery from '../PostPhotoGallery.jsx';
import ModeratorControl from '../ModeratorControl.jsx';

function Reactions({ kind, id, auth, visible, writable, authorId, onChange, hideCounts = false }) {
  const {t}=usePreferences();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const path = kind === 'post' ? `/posts/${id}/like` : `/comments/${id}/like`;
  const own = items.find(item => Number(item.author_id) === Number(auth?.user?.id));
  const canVote = Boolean(auth && writable && Number(auth.user.id) !== Number(authorId));

  async function load() {
    if (!visible) return;
    try {
      const result = await api(path, { token: auth?.token });
      setItems(result.data);
    } catch (err) { setError(err); }
  }

  useEffect(() => { load(); }, [path, auth?.token, visible]);

  async function change(method, type) {
    setError(null);
    try {
      await api(path, { method, token: auth.token, ...(type ? { body: { type } } : {}) });
      await load();
      await onChange();
    } catch (err) { setError(err); }
  }

  if (!visible) return null;
  return <div className="reactionPanel">
    <div className="reactionButtons">
      {!hideCounts && <span>{items.filter(x => x.type === 'like').length} likes · {items.filter(x => x.type === 'dislike').length} dislikes</span>}
      {canVote && <>
        <button type="button" className="reactionIconButton" aria-label="Like" title="Like" onClick={() => change('POST', 'like')}><Icon name="heart" size={19}/></button>
        <button type="button" className="reactionIconButton" aria-label="Dislike" title="Dislike" onClick={() => change('POST', 'dislike')}><Icon name="dislike" size={19}/></button>
        {own && <button type="button" aria-label="Remove my vote" title="Remove my vote" className="reactionIconButton" onClick={() => change('DELETE')}><Icon name="close" size={19}/></button>}
      </>}
      {!hideCounts && <button type="button" aria-label="View votes" title="View votes" onClick={() => setOpen(x => !x)}><Icon name="group" size={18}/></button>}
      {auth?.user?.role === 'admin' && items.length > 0 && <button type="button" onClick={() => {
        if (window.confirm('Remove all reactions?')) {
          api(path + '?all=1', { method: 'DELETE', token: auth.token })
            .then(async () => { await load(); await onChange(); }).catch(setError);
        }
      }}>Clear votes</button>}
    </div>
    {open && <ul>{items.map(x => <li key={x.id}>{x.author_login}: {x.type}</li>)}</ul>}
    <ErrorBox error={error} />
  </div>;
}

function Comment({ item, comments, postId, auth, refresh, acceptedId, postAuthorId, depth = 0 }) {
  const {t}=usePreferences();
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState(null);
  const children = comments.filter(x => Number(x.parent_comment_id) === Number(item.id));
  const isAdmin = ['admin','moderator'].includes(auth?.user?.role);
  const canModerate = auth?.user?.role==='admin' ||
    (auth?.user?.role==='moderator' && item.author_role!=='admin' && item.post_author_role!=='admin');
  const isOwner = Number(auth?.user?.id) === Number(item.author_id);
  const active = item.status === 'active';
  const canReply = Boolean(auth && !item.post_closed && (isAdmin || (active && !item.locked && !item.post_locked)));
  const canChangeStatus = Boolean(auth && (canModerate || (isOwner && !item.locked) ||
    (auth.user.role==='user' && !item.locked &&
      item.author_role!=='admin' && item.post_author_role!=='admin')));

  async function run(path, method, body) {
    setError(null);
    try {
      await api(path, { method, token: auth.token, ...(body ? { body } : {}) });
      await refresh();
      return true;
    } catch (err) { setError(err); return false; }
  }

  async function sendReply(event) {
    event.preventDefault();
    if (await run(`/posts/${postId}/comments`, 'POST', { content: reply, parentCommentId: item.id })) {
      setReply('');
      setReplying(false);
    }
  }

  return <div className="commentBranch" style={{ '--depth': Math.min(depth, 5) }}>
    <article className="card commentCard">
      <div className="commentTop">
        <div className="authorLine">
          <Avatar user={{ login: item.author_login, avatar: item.author_avatar }} size="sm" />
          <button className="authorLink" onClick={() => go(`/profile/${item.author_id}`)}>{item.author_login}</button>
          <ModeratorControl userId={item.author_id} login={item.author_login}/>
          <small>{fmt(item.created_at)}</small>
        </div>
        <StatusBadges item={item} />
        {item.reviewed_by && <span className="modReviewed"><Icon name="check" size={17}/> {t('Reviewed by moderator')}</span>}
      </div>
      <p className="commentContent">{item.content}</p>
      {Number(acceptedId)===Number(item.id) && <span className="solutionTag">✓ {t('Best answer')}</span>}
      <Reactions kind="comment" id={item.id} auth={auth} authorId={item.author_id} visible={isAdmin || (active && item.post_status === 'active')}
        writable={isAdmin || (active && !item.locked && item.post_status === 'active' && !item.post_locked)}
        onChange={refresh} />
      <div className="commentActions">
        {Number(auth?.user?.id)===Number(postAuthorId)&&item.status==='active'&&
          <button type="button" className="solutionButton" onClick={()=>
            run('/posts/'+postId+'/solution','PATCH',{
              commentId:Number(acceptedId)===Number(item.id)?null:item.id
            })}>{t(Number(acceptedId)===Number(item.id)?'Remove best answer':'Mark best answer')}</button>}
        <ReportButton kind="comment" id={item.id} auth={auth} authorId={item.author_id}/>
        {canReply && <button onClick={() => setReplying(x => !x)}><Icon name="comment" size={17}/> {t('Reply')}</button>}
        {canChangeStatus && <button onClick={() => run(`/comments/${item.id}`, 'PATCH', { status: active ? 'inactive' : 'active' })}>
          {t(active ? 'Deactivate' : 'Activate')}</button>}
        {canModerate && <button title={item.locked?'Unlock':'Lock'} aria-label={item.locked?'Unlock':'Lock'}
          onClick={() => run('/comments/' + item.id, 'PATCH', { locked: !item.locked })}>
          <Icon name={item.locked?'unlock':'lock'} size={17}/></button>}
        {canModerate && active && <button title={item.reviewed_by?'Remove moderator review':'Mark reviewed by moderator'}
          aria-label={item.reviewed_by?'Remove moderator review':'Mark reviewed by moderator'}
          onClick={()=>run('/comments/' + item.id + '/review','PATCH',{reviewed:!item.reviewed_by})}>
          <Icon name="check" size={17}/></button>}
        {(isOwner || canModerate) && <button className="dangerText" onClick={() => {
          if (window.confirm('Delete this comment and replies?')) run(`/comments/${item.id}`, 'DELETE');
        }}>{t('Delete')}</button>}
      </div>
      {replying && <form className="replyForm" onSubmit={sendReply}>
        <label>{t('Reply')}<textarea required maxLength="20000" value={reply} onChange={e => setReply(e.target.value)} /></label>
        <div className="toolbar"><button className="primary">{t('Post reply')}</button><button type="button" onClick={() => setReplying(false)}>{t('Cancel')}</button></div>
      </form>}
      <ErrorBox error={error} />
    </article>
    {children.map(child => <Comment key={child.id} item={child} comments={comments} postId={postId} auth={auth} refresh={refresh} acceptedId={acceptedId} postAuthorId={postAuthorId} depth={depth + 1} />)}
  </div>;
}

export default function PostPage({ id }) {
  const auth = useSelector(state => state.auth);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied,setCopied] = useState(false);
  const {t} = usePreferences();

  async function load() {
    try {
      const [postResult, commentResult] = await Promise.all([
        api(`/posts/${id}`, { token: auth?.token }),
        api(`/posts/${id}/comments`, { token: auth?.token }),
      ]);
      setPost(postResult.data);
      setComments(commentResult.data);
      setError(null);
    } catch (err) { setError(err); }
    finally { setLoading(false); }
  }
  useEffect(() => { setLoading(true); setPost(null); setCopied(false); load(); }, [id, auth?.token]);
  useEffect(() => {
    if (!auth?.token) { setSaved(false); return; }
    let live = true;
    api('/posts/' + id + '/engagement',{token:auth.token})
      .then(result=>{if(live)setSaved(Boolean(result.data.favorite));})
      .catch(()=>{if(live)setSaved(false);});
    return ()=>{live=false;};
  },[id,auth?.token]);

  // Refresh replies while the post is open, including comments from other browsers.
  // No page refresh is required to see new activity.
  useEffect(()=>{
    const poll=()=>{if(document.visibilityState==='visible')refreshReplies();};
    const timer=window.setInterval(poll,6000);
    window.addEventListener('focus',poll);
    return ()=>{window.clearInterval(timer);window.removeEventListener('focus',poll);};
  },[id,auth?.token]);

  async function toggleSave() {
    if (!auth || !post) return;
    setSaving(true);setError(null);
    try {
      await api('/posts/' + id + '/favorite',{method:saved?'DELETE':'POST',token:auth.token});
      setSaved(value=>!value);
      window.dispatchEvent(new Event('circle:saved-updated'));
    } catch(e){setError(e);} finally{setSaving(false);}
  }


  if (loading) return <main><p>{t('Loading post…')}</p></main>;
  if (!post) return <main><ErrorBox error={error} /></main>;

  const isAdmin = ['admin','moderator'].includes(auth?.user?.role);
  const canModeratePost = auth?.user?.role==='admin' ||
    (auth?.user?.role==='moderator' && post.author_role!=='admin');
  const isOwner = Number(auth?.user?.id) === Number(post.author_id);
  const canComment = Boolean(auth && !post.closed && !Boolean(post.publish_at && new Date(post.publish_at)>new Date()) && (isAdmin || (post.status === 'active' && !post.locked)));
  const hideCounts = Boolean(post.hide_likes) && !isAdmin && !isOwner;
  const commentIds = new Set(comments.map(x => Number(x.id)));
  const roots = comments.filter(x => !x.parent_comment_id || !commentIds.has(Number(x.parent_comment_id)));

  async function run(method, body) {
    try {
      await api(`/posts/${id}`, { method, token: auth.token, ...(body ? { body } : {}) });
      await load();
    } catch (err) { setError(err); }
  }

  async function refreshReplies(){
    try{
      const result=await api(`/posts/${id}/comments`,{token:auth?.token});
      setComments(result.data);
      setPost(current=>current?{...current,comment_count:result.data.length}:current);
    }catch(err){setError(err);}
  }
  async function sendComment(event) {
    event.preventDefault();
    try {
      const result=await api(`/posts/${id}/comments`,{method:'POST',token:auth.token,body:{content:text}});
      // The new reply is visible immediately, even if the subsequent network refresh is slow.
      setComments(current=>current.some(item=>Number(item.id)===Number(result.data.id))
        ?current:[...current,result.data]);
      setText('');
      await refreshReplies();
    } catch (err) { setError(err); }
  }

  async function copyLink() {
    try {
      const url=window.location.origin+window.location.pathname+'#/post/'+id;
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError(new Error(t('Unable to copy the link. Please copy the address from your browser.')));
    }
  }

  async function deletePost() {
    if (!window.confirm('Delete post and all its comments?')) return;
    try {
      await api(`/posts/${id}`, { method: 'DELETE', token: auth.token });
      go('/');
    } catch (err) { setError(err); }
  }

  return <main className="postPage naturalPostPage">
    <div className="postBackRow"><button className="editorBack" type="button" onClick={()=>go('/')}
      aria-label="Back to feed" title="Back to feed"><Icon name="arrowBack" size={21}/></button>
      <strong>{t('Discussion')}</strong>
    </div>
    <article className="naturalPost">
      <div className="naturalPostAuthor">
        <button type="button" className="avatarButton" onClick={()=>go('/profile/'+post.author_id)}>
          <Avatar user={{login:post.author_login,avatar:post.author_avatar}} size="md"/>
        </button>
        <div><button className="authorLink" onClick={()=>go('/profile/'+post.author_id)}>@{post.author_login}</button>
          <ModeratorControl userId={post.author_id} login={post.author_login}/>
          <time dateTime={post.published_at||post.created_at}
            title={new Date(post.published_at||post.created_at).toLocaleString()}>{fmt(post.published_at||post.created_at)}</time>
        </div>
        <StatusBadges item={post}/>
      </div>
      <h1>{post.title}</h1>
      {post.accepted_comment_id && <span className="solutionTag">✓ {t('Solved')}</span>}
      <div className="naturalPostContent"><FormattedContent text={post.content}/></div>
      <PostPhotoGallery images={post.images||[]}/>
      <div className="tags">{(post.categories||[]).map(x=><span key={x.id}>{t(x.title)}</span>)}</div>
      <ReportButton kind="post" id={post.id} auth={auth} authorId={post.author_id}/>
      <div className="naturalPostReactions">
        <Reactions kind="post" id={post.id} auth={auth} authorId={post.author_id}
          visible={isAdmin||post.status==='active'} hideCounts={hideCounts}
          writable={isAdmin||(post.status==='active'&&!post.locked)} onChange={load}/>
        <span className="naturalPostCommentCount"><Icon name="comment" size={19}/>{comments.length}</span>
        <button className="naturalPostIconButton postCopyAction" type="button"
          aria-label={t(copied?'Link copied':'Copy link')}
          title={t(copied?'Link copied':'Copy link')} onClick={copyLink}>
          <Icon name={copied?'check':'share'} size={19}/></button>
        {auth && <button className="naturalPostIconButton" type="button" disabled={saving}
          aria-pressed={saved} aria-label={saved?t('Unsave post'):t('Save post')}
          title={saved?t('Unsave post'):t('Save post')} onClick={toggleSave}>
          <Icon name={saved?'bookmark':'bookmarkBorder'} size={20}/></button>}
      </div>
      {(isOwner||canModeratePost) && <div className="naturalPostManagement">
        {isOwner && auth?.user?.role!=='admin' && <button type="button" title="Edit post" aria-label="Edit post"
          onClick={()=>go('/edit/'+post.id)}><Icon name="edit" size={19}/></button>}
        {isOwner && <button type="button" title={post.closed?'Reopen discussion':'Close discussion'}
          aria-label={post.closed?'Reopen discussion':'Close discussion'}
          onClick={()=>run('PATCH',{closed:!Boolean(post.closed)})}>
          <Icon name={post.closed?'unlock':'lock'} size={18}/><span>{t(post.closed?'Reopen discussion':'Close discussion')}</span></button>}
        {isOwner && <button type="button" title={post.hide_likes?'Show likes':'Hide likes'}
          aria-label={post.hide_likes?'Show likes':'Hide likes'}
          onClick={()=>run('PATCH',{hideLikes:!Boolean(post.hide_likes)})}>
          <Icon name="heart" size={18}/><span>{t(post.hide_likes?'Show likes':'Hide likes')}</span></button>}
        {canModeratePost && <><button type="button" onClick={()=>run('PATCH',{status:post.status==='active'?'inactive':'active'})}>
          <Icon name="check" size={18}/><span>{post.status==='active'?'Deactivate':'Activate'}</span></button>
          <button type="button" onClick={()=>run('PATCH',{locked:!post.locked})}>
          <Icon name={post.locked?'unlock':'lock'} size={18}/><span>{post.locked?'Unlock':'Lock'}</span></button></>}
        <button type="button" className="dangerText" aria-label="Delete post" title="Delete post" onClick={deletePost}>
          <Icon name="trash" size={18}/><span>{t('Delete post')}</span></button>
      </div>}
      {post.closed && <p className="naturalClosedNotice"><Icon name="lock" size={18}/>{t('The author has closed this discussion, replies are now read-only')}</p>}
      {post.publish_at && new Date(post.publish_at)>new Date() && <p className="naturalClosedNotice">
        <Icon name="settings" size={18}/>{t('Scheduled for')} {new Date(post.publish_at).toLocaleString()}</p>}
      <ErrorBox error={error}/>
    </article>
    <section className="naturalComments">
      <h2>{t('Replies')} <span>{comments.length}</span></h2>
      {roots.length ? <div className="naturalCommentTree">
        {roots.map(item=><Comment key={item.id} item={item} comments={comments} postId={post.id} auth={auth} refresh={load} acceptedId={post.accepted_comment_id} postAuthorId={post.author_id}/>)}
      </div> : <div className="naturalEmptyReplies"><Icon name="comment" size={25}/>
        <p>{t('No replies yet')}</p><small>{t('Be the first to join the conversation')}</small></div>}
      {canComment ? <form className="naturalReplyComposer" onSubmit={sendComment}>
        <Avatar user={auth.user} size="md"/>
        <label className="srOnly" htmlFor="main-reply-input">{t('New comment')}</label>
        <textarea id="main-reply-input" required maxLength="20000" rows="2"
          placeholder={t('Add to the conversation…')} value={text} onChange={e=>setText(e.target.value)}/>
        <button className="primary" type="submit" aria-label="Comment" title="Send reply"><Icon name="arrow" size={20}/></button>
      </form> : <p className="naturalReplyLocked">{t(!auth?'Log in to reply':post.closed?'Discussion closed':'New replies are disabled')}</p>}
    </section>
  </main>;
}
