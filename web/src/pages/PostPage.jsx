import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, StatusBadges, fmt, go } from '../ui.jsx';
import { usePreferences } from '../preferences.jsx';
import FormattedContent from '../FormattedContent.jsx';
import ReportButton from '../ReportButton.jsx';
import PostPhotoGallery from '../PostPhotoGallery.jsx';
import {useContextActions,ContextActions} from '../ContextActions.jsx';

function Reactions({ kind, id, auth, visible, writable, authorId, onChange, hideCounts = false }) {
  const {t}=usePreferences();
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const votePanelRef=useRef(null);
  const path = kind === 'post' ? `/posts/${id}/like` : `/comments/${id}/like`;
  const own = items.find(item => Number(item.author_id) === Number(auth?.user?.id));
  // Owners may like/dislike their own posts, but not their own comments
  const canVote = Boolean(auth?.token && writable &&
    (kind==='post' || Number(auth.user.id) !== Number(authorId)));

  async function load() {
    if (!visible) return;
    try {
      const result = await api(path, { token: auth?.token });
      setItems(result.data);
    } catch (err) { setError(err); }
  }

  useEffect(() => { load(); }, [path, auth?.token, visible]);
  useEffect(()=>{
    const refresh=event=>{
      if(event.detail?.kind===kind&&String(event.detail.id)===String(id))load();
    };
    window.addEventListener('circle:reactions-updated',refresh);
    return()=>window.removeEventListener('circle:reactions-updated',refresh);
  },[kind,id,path,auth?.token,visible]);

  useEffect(()=>{
    if(!open)return;
    const dismiss=event=>{
      if(!votePanelRef.current?.contains(event.target))setOpen(false);
    };
    const onEscape=event=>{if(event.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',onEscape);
    return()=>{
      document.removeEventListener('pointerdown',dismiss);
      document.removeEventListener('keydown',onEscape);
    };
  },[open]);
  useEffect(()=>setOpen(false),[kind,id]);

  async function change(method, type) {
    setError(null);
    try {
      await api(path, { method, token: auth.token, ...(type ? { body: { type } } : {}) });
      await load();
      await onChange();
    } catch (err) { setError(err); }
  }

  if (!visible) return null;
  return <div ref={votePanelRef} className="reactionPanel">
    <div className="reactionButtons">
      {!hideCounts && !canVote && <span className="reactionTotals">
        <span title={t('Likes')} aria-label={t('Likes')+': '+items.filter(x=>x.type==='like').length}>
          <Icon name="heart" size={15}/>{items.filter(x=>x.type==='like').length}</span>
        <span title={t('Dislikes')} aria-label={t('Dislikes')+': '+items.filter(x=>x.type==='dislike').length}>
          <Icon name="dislike" size={15}/>{items.filter(x=>x.type==='dislike').length}</span>
      </span>}
      {canVote && <>
        <button type="button" className="reactionIconButton voteReaction"
          aria-label={t('Like')} title={t('Like')} aria-pressed={own?.type==='like'}
          onClick={() => change(own?.type==='like'?'DELETE':'POST','like')}>
          <Icon name={own?.type==='like'?'heartFilled':'heart'} size={19}/>
          {!hideCounts && <span className="reactionCount">{items.filter(x=>x.type==='like').length}</span>}
        </button>
        <button type="button" className="reactionIconButton voteReaction"
          aria-label={t('Dislike')} title={t('Dislike')} aria-pressed={own?.type==='dislike'}
          onClick={() => change(own?.type==='dislike'?'DELETE':'POST','dislike')}>
          <Icon name={own?.type==='dislike'?'dislikeFilled':'dislike'} size={19}/>
          {!hideCounts && <span className="reactionCount">{items.filter(x=>x.type==='dislike').length}</span>}
        </button>
      </>}
      {!hideCounts && items.length>0 && <button type="button" className="reactionVoteDetails"
        aria-label={t('View votes')} title={t('View votes')}
        aria-expanded={open} aria-controls={'reaction-voters-'+kind+'-'+id}
        onClick={()=>setOpen(x=>!x)}>
        <Icon name="group" size={18}/><span className="reactionCount">{items.length}</span>
      </button>}
    </div>
    {open && items.length>0 && !hideCounts && <div className="reactionVotePopover"
      id={'reaction-voters-'+kind+'-'+id}
      role="region" aria-label={t('View votes')}>
      <div className="reactionVotePopoverTitle">{t('View votes')} <span>{items.length}</span></div>
      <ul className="reactionVoteList">
        {items.map(x=><li key={x.id}>
          <span className="reactionVoterName">@{x.author_login}</span>
          <span className="reactionVoterType">{t(x.type==='like'?'Like':x.type==='dislike'?'Dislike':x.type)}</span>
        </li>)}
      </ul>
    </div>}
    <ErrorBox error={error} />
  </div>;
}

function Comment({ item, comments, postId, auth, refresh, acceptedId, postAuthorId, depth = 0 }) {
  const {t}=usePreferences();
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const replyFlight=useRef(false);
  const [replyBusy,setReplyBusy]=useState(false);
  const [error, setError] = useState(null);
  const [reportOpen,setReportOpen]=useState(false);
  const actionsMenu=useContextActions();
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
    if (replyFlight.current || !reply.trim()) return;
    replyFlight.current=true;
    setReplyBusy(true);
    try {
      if (await run(`/posts/${postId}/comments`, 'POST', { content: reply, parentCommentId: item.id })) {
        setReply('');
        setReplying(false);
      }
    } finally {
      replyFlight.current=false;
      setReplyBusy(false);
    }
  }

  const canReport=Boolean(auth&&Number(auth.user.id)!==Number(item.author_id));
  const commentMenuItems=[
    ...(canReply?[{label:t('Reply'),icon:'comment',action:()=>setReplying(true)}]:[]),
    ...(canReport?[{label:t('Report'),icon:'shield',action:()=>setReportOpen(true)}]:[]),
    ...(Number(auth?.user?.id)===Number(postAuthorId)&&active?[{
      label:t(Number(acceptedId)===Number(item.id)?'Remove best answer':'Mark best answer'),
      icon:'check',action:()=>run('/posts/'+postId+'/solution','PATCH',{
        commentId:Number(acceptedId)===Number(item.id)?null:item.id,
      }),
    }]:[]),
    ...(canChangeStatus?[{
      label:t(active?'Hide comment':'Show comment'),icon:active?'eye':'check',
      action:()=>run('/comments/'+item.id,'PATCH',{status:active?'inactive':'active'}),
    }]:[]),
    ...(canModerate?[{
      label:t(item.locked?'Unlock':'Lock'),icon:item.locked?'unlock':'lock',
      action:()=>run('/comments/'+item.id,'PATCH',{locked:!item.locked}),
    },...(active?[{
      label:t(item.reviewed_by?'Remove moderator review':'Mark reviewed by moderator'),
      icon:'shield',action:()=>run('/comments/'+item.id+'/review','PATCH',{reviewed:!item.reviewed_by}),
    }]:[])]:[]),
    ...(auth?.user?.role==='admin'?[{
      label:t('Clear votes'),icon:'trash',action:async()=>{
        if(!window.confirm(t('Remove all reactions?')))return;
        if(await run('/comments/'+item.id+'/like?all=1','DELETE')){
          window.dispatchEvent(new CustomEvent('circle:reactions-updated',{detail:{kind:'comment',id:item.id}}));
        }
      },
    }]:[]),
    ...((isOwner||canModerate)?[{
      label:t('Delete comment'),icon:'trash',danger:true,
      action:()=>{if(window.confirm(t('Delete this comment and replies?')))
        run('/comments/'+item.id,'DELETE');},
    }]:[]),
  ];
  return <div className="commentBranch" style={{ '--depth': Math.min(depth, 5) }}>
    <article className="card commentCard" onContextMenu={commentMenuItems.length?actionsMenu.open:undefined}
      onKeyDown={event=>{
        if((event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))&&commentMenuItems.length){
          actionsMenu.open(event);
        }
      }} tabIndex={commentMenuItems.length?0:undefined}>
      <div className="commentTop">
        <div className="authorLine">
          <Avatar user={{ login: item.author_login, avatar: item.author_avatar }} size="sm" />
          <button className="authorLink" onClick={() => go(`/profile/${item.author_id}`)}>{item.author_login}</button>
          <small>{fmt(item.created_at)}</small>
        </div>
        <StatusBadges item={item} />
        {Boolean(item.reviewed_by) && <span className="modReviewed"><Icon name="check" size={17}/> {t('Reviewed by moderator')}</span>}
        {commentMenuItems.length>0 && <button type="button" className="discussionMore"
          aria-label={t('Comment actions')} title={t('Comment actions')}
          aria-haspopup="menu" aria-expanded={Boolean(actionsMenu.position)} onClick={actionsMenu.open}>
          <Icon name="more" size={20}/>
        </button>}
      </div>
      <p className="commentContent">{item.content}</p>
      {Number(acceptedId)===Number(item.id) && <span className="solutionTag"><Icon name="check" size={16}/>{t('Best answer')}</span>}
      <Reactions kind="comment" id={item.id} auth={auth} authorId={item.author_id} visible={isAdmin || (active && item.post_status === 'active')}
        writable={isAdmin || (active && !item.locked && item.post_status === 'active' && !item.post_locked)}
        onChange={refresh} />
      {reportOpen&&<ReportButton panel kind="comment" id={item.id} auth={auth}
        authorId={item.author_id} onClose={()=>setReportOpen(false)}/>}
      <ContextActions menu={actionsMenu} items={commentMenuItems} label={t('Comment actions')}/>
      {replying && <form className="replyForm" onSubmit={sendReply}>
        <label>{t('Reply')}<textarea required maxLength="20000" value={reply} onChange={e => setReply(e.target.value)} /></label>
        <div className="toolbar"><button className="primary" disabled={replyBusy}>{t('Post reply')}</button><button type="button" onClick={() => setReplying(false)}>{t('Cancel')}</button></div>
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
  const commentFlight=useRef(false);
  const [commentBusy,setCommentBusy]=useState(false);
  const routeKey=useRef('');
  const requestGeneration=useRef(0);
  routeKey.current=String(id)+'|'+String(auth?.token||'');
  const [reportOpen,setReportOpen]=useState(false);
  const postMenu=useContextActions();
  const {t} = usePreferences();

  async function load() {
    const requested=routeKey.current;
    const sequence=++requestGeneration.current;
    try {
      const [postResult, commentResult] = await Promise.all([
        api(`/posts/${id}`, { token: auth?.token }),
        api(`/posts/${id}/comments`, { token: auth?.token }),
      ]);
      if(routeKey.current!==requested||sequence!==requestGeneration.current)return;
      setPost(postResult.data);
      setComments(commentResult.data);
      setError(null);
    } catch (err) {
      if(routeKey.current===requested&&sequence===requestGeneration.current)setError(err);
    }
    finally {
      if(routeKey.current===requested&&sequence===requestGeneration.current)setLoading(false);
    }
  }
  useEffect(() => {
    setLoading(true);setPost(null);setComments([]);setCopied(false);
    load();
    return()=>{requestGeneration.current+=1;};
  }, [id, auth?.token]);
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
    const currentRoute=routeKey.current;
    try{
      const result=await api(`/posts/${id}/comments`,{token:auth?.token});
      if(routeKey.current!==currentRoute)return;
      setComments(result.data);
      setPost(current=>current?{...current,
        comment_count:result.data.filter(item=>item.status==='active').length}:current);
    }catch(err){if(routeKey.current===currentRoute)setError(err);}
  }
  async function sendComment(event) {
    event.preventDefault();
    if(commentFlight.current||!text.trim())return;
    commentFlight.current=true;setCommentBusy(true);
    const currentRoute=routeKey.current;
    try {
      const result=await api(`/posts/${id}/comments`,{method:'POST',token:auth.token,body:{content:text}});
      if(routeKey.current!==currentRoute)return;
      setComments(current=>current.some(item=>Number(item.id)===Number(result.data.id))
        ?current:[...current,result.data]);
      setText('');
      await refreshReplies();
    } catch (err) {
      if(routeKey.current===currentRoute)setError(err);
    } finally {
      commentFlight.current=false;setCommentBusy(false);
    }
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

  const postMenuItems=[
    {label:t('Copy link'),icon:'share',action:copyLink},
    ...(auth&&Number(auth.user.id)!==Number(post.author_id)?[
      {label:t('Report'),icon:'shield',action:()=>setReportOpen(true)},
    ]:[]),
    ...(isOwner?[
      {separator:true},
      ...(auth?.user?.role!=='admin'?[{label:t('Edit post'),icon:'edit',action:()=>go('/edit/'+id)}]:[]),
      {label:t(post.closed?'Reopen discussion':'Close discussion'),
        icon:post.closed?'unlock':'lock',action:()=>run('PATCH',{closed:!Boolean(post.closed)})},
      {label:t(post.hide_likes?'Show likes':'Hide likes'),icon:'heart',
        action:()=>run('PATCH',{hideLikes:!Boolean(post.hide_likes)})},
    ]:[]),
    ...(canModeratePost?[
      {separator:true},
      {label:t(post.status==='active'?'Hide post':'Show post'),
        icon:post.status==='active'?'eye':'check',
        action:()=>run('PATCH',{status:post.status==='active'?'inactive':'active'})},
      {label:t(post.locked?'Unlock':'Lock'),icon:post.locked?'unlock':'lock',
        action:()=>run('PATCH',{locked:!post.locked})},
    ]:[]),
    ...(auth?.user?.role==='admin'?[
      {label:t('Clear votes'),icon:'trash',action:async()=>{
        if(!window.confirm(t('Remove all reactions?')))return;
        try{
          await api('/posts/'+id+'/like?all=1',{method:'DELETE',token:auth.token});
          window.dispatchEvent(new CustomEvent('circle:reactions-updated',
            {detail:{kind:'post',id}}));
          await load();
        }catch(err){setError(err);}
      }},
    ]:[]),
    ...(isOwner||canModeratePost?[
      {separator:true},
      {label:t('Delete post'),icon:'trash',danger:true,action:deletePost},
    ]:[]),
  ];
  return <main className="postPage naturalPostPage">
    <div className="postBackRow"><button className="editorBack" type="button" onClick={()=>go('/')}
      aria-label="Back to feed" title="Back to feed"><Icon name="arrowBack" size={21}/></button>
      <strong>{t('Discussion')}</strong>
    </div>
    <article className="naturalPost"
      onContextMenu={postMenu.open}
      onKeyDown={event=>{
        if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))postMenu.open(event);
      }} tabIndex={0}>
      <div className="naturalPostAuthor">
        <button type="button" className="avatarButton" onClick={()=>go('/profile/'+post.author_id)}>
          <Avatar user={{login:post.author_login,avatar:post.author_avatar}} size="md"/>
        </button>
        <div><button className="authorLink" onClick={()=>go('/profile/'+post.author_id)}>@{post.author_login}</button>
          <time dateTime={post.published_at||post.created_at}
            title={new Date(post.published_at||post.created_at).toLocaleString()}>{fmt(post.published_at||post.created_at)}</time>
        </div>
        <div className="naturalPostTopStatus">
          <StatusBadges item={post}/>
          {Boolean(post.accepted_comment_id) && <span className="solutionTag"><Icon name="check" size={15}/>{t('Solved')}</span>}
        </div>
        <button type="button" className="discussionMore discussionPostMore"
          aria-label={t('Post actions')} title={t('Post actions')}
          aria-haspopup="menu" aria-expanded={Boolean(postMenu.position)}
          onClick={postMenu.open}><Icon name="more" size={21}/></button>
      </div>
      <h1>{post.title}</h1>
      <div className="naturalPostContent"><FormattedContent text={post.content}/></div>
      <PostPhotoGallery images={post.images||[]}/>
      <div className="tags">{(post.categories||[]).map(x=><span key={x.id}>{t(x.title)}</span>)}</div>
      <div className="naturalPostReactions">
        <Reactions kind="post" id={post.id} auth={auth} authorId={post.author_id}
          visible={isAdmin||post.status==='active'} hideCounts={hideCounts}
          writable={isAdmin||(post.status==='active'&&!post.locked)} onChange={load}/>
        <span className="naturalPostCommentCount"><Icon name="comment" size={19}/>{comments.filter(item=>item.status==='active').length}</span>
        <button className="naturalPostIconButton postCopyAction" type="button"
          aria-label={t(copied?'Link copied':'Copy link')}
          title={t(copied?'Link copied':'Copy link')} onClick={copyLink}>
          <Icon name={copied?'check':'share'} size={19}/></button>
        {auth && <button className="naturalPostIconButton" type="button" disabled={saving}
          aria-pressed={saved} aria-label={saved?t('Unsave post'):t('Save post')}
          title={saved?t('Unsave post'):t('Save post')} onClick={toggleSave}>
          <Icon name={saved?'bookmark':'bookmarkBorder'} size={20}/></button>}
      </div>
      {reportOpen&&<ReportButton panel kind="post" id={post.id} auth={auth}
        authorId={post.author_id} onClose={()=>setReportOpen(false)}/>}
      <ContextActions menu={postMenu} items={postMenuItems} label={t('Post actions')}/>
      {Boolean(post.closed) && <p className="naturalClosedNotice"><Icon name="lock" size={18}/>{t('The author has closed this discussion, replies are now read-only')}</p>}
      {post.publish_at && new Date(post.publish_at)>new Date() && <p className="naturalClosedNotice">
        <Icon name="settings" size={18}/>{t('Scheduled for')} {new Date(post.publish_at).toLocaleString()}</p>}
      <ErrorBox error={error}/>
    </article>
    <section className="naturalComments">
      <h2>{t('Replies')} <span>{comments.filter(item=>item.status==='active').length}</span></h2>
      {roots.length ? <div className="naturalCommentTree">
        {roots.map(item=><Comment key={item.id} item={item} comments={comments} postId={post.id} auth={auth} refresh={load} acceptedId={post.accepted_comment_id} postAuthorId={post.author_id}/>)}
      </div> : <div className="naturalEmptyReplies"><Icon name="comment" size={25}/>
        <p>{t('No replies yet')}</p><small>{t('Be the first to join the conversation')}</small></div>}
      {canComment ? <form className="naturalReplyComposer" onSubmit={sendComment}>
        <Avatar user={auth.user} size="md"/>
        <label className="srOnly" htmlFor="main-reply-input">{t('New comment')}</label>
        <textarea id="main-reply-input" required maxLength="20000" rows="2"
          placeholder={t('Add to the conversation…')} value={text} onChange={e=>setText(e.target.value)}/>
        <button className="primary" type="submit" disabled={commentBusy} aria-label="Comment" title="Send reply"><Icon name="arrow" size={20}/></button>
      </form> : <p className="naturalReplyLocked">{t(!auth?'Log in to reply':post.closed?'Discussion closed':'New replies are disabled')}</p>}
    </section>
  </main>;
}
