import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, StatusBadges, TrustBadge, fmt, go } from '../ui.jsx';

const REACTIONS = [
  ['like', '▲ Like'],
  ['useful', '💡 Useful'],
  ['thanks', '🙏 Thanks'],
  ['fire', '🔥 Fire'],
  ['dislike', '▼ Dislike'],
];

function ReactionButtons({ onReact, disabled = false }) {
  return <div className="reactionButtons">
    {REACTIONS.map(([type, label]) => <button key={type} disabled={disabled} onClick={() => onReact(type)}>{label}</button>)}
  </div>;
}

function ReactionPanel({ kind, id, auth, onChanged }) {
  const [open, setOpen] = useState(false);
  const [reactions, setReactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const path = kind === 'post' ? `/posts/${id}/like` : `/comments/${id}/like`;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await api(path, { token: auth?.token });
      setReactions(result.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (open) load(); }, [open, id, auth?.token]);

  async function removeOwn() {
    setError(null);
    try {
      await api(path, { method: 'DELETE', token: auth.token });
      await onChanged();
      await load();
    } catch (err) {
      setError(err);
    }
  }

  async function clearAll() {
    if (!window.confirm('Delete all reactions on this item?')) return;
    setError(null);
    try {
      await api(`${path}?all=1`, { method: 'DELETE', token: auth.token });
      await onChanged();
      await load();
    } catch (err) {
      setError(err);
    }
  }

  const own = auth && reactions.find((reaction) => Number(reaction.author_id) === Number(auth.user.id));
  return <div className="reactionPanel">
    <button className="quietButton" onClick={() => setOpen((value) => !value)}>{open ? 'Hide reactions' : 'View reactions'}</button>
    {open && <div className="reactionDetails">
      {loading
        ? <small>Loading reactions…</small>
        : reactions.length
          ? <ul>{reactions.map((reaction) => <li key={reaction.id}><b>{reaction.author_login}</b> · {reaction.type}</li>)}</ul>
          : <small>No reactions yet.</small>}
      <div className="toolbar">
        {own && <button onClick={removeOwn}>Remove my reaction</button>}
        {auth?.user?.role === 'admin' && reactions.length > 0 && <button className="dangerText" onClick={clearAll}>Clear all reactions</button>}
      </div>
      <ErrorBox error={error} />
    </div>}
  </div>;
}

function CommentNode({ comment, allComments, postId, auth, reload, depth = 0 }) {
  const children = allComments.filter((item) => Number(item.parent_comment_id) === Number(comment.id));
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState(null);
  const isAdmin = auth?.user?.role === 'admin';
  const isOwner = Number(auth?.user?.id) === Number(comment.author_id);
  const canInteract = isAdmin || (comment.status === 'active' && !comment.locked && !comment.post_locked);
  const canChangeStatus = Boolean(auth) && (isAdmin || !comment.locked);

  async function action(work) {
    setError(null);
    try {
      await work();
      await reload();
      window.dispatchEvent(new Event('usof:notifications'));
    } catch (err) {
      setError(err);
    }
  }

  async function submitReply(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    await action(() => api(`/posts/${postId}/comments`, {
      method: 'POST',
      token: auth.token,
      body: { content: reply, parentCommentId: comment.id },
    }));
    setReply('');
    setReplying(false);
  }

  return <div className="commentBranch" style={{ '--depth': Math.min(depth, 5) }}>
    <article className="card commentCard">
      <div className="commentTop">
        <div className="authorLine">
          <Avatar user={{ login: comment.author_login, avatar: comment.author_avatar }} size="sm" />
          <b>{comment.author_login}</b>
          {comment.author_rating !== undefined && <TrustBadge rating={comment.author_rating} />}
          <span className="muted">{fmt(comment.created_at)}</span>
        </div>
        <StatusBadges item={comment} />
      </div>
      <p className="commentContent">{comment.content}</p>
      <div className="commentActions">
        <span className="scoreText">{comment.like_count || 0} likes · score {comment.score || 0}</span>
        {auth && canInteract && !isOwner && <ReactionButtons onReact={(type) => action(() => api(`/comments/${comment.id}/like`, { method: 'POST', token: auth.token, body: { type } }))} />}
        {auth && canInteract && <button onClick={() => setReplying((value) => !value)}>Reply</button>}
        {canChangeStatus && <button onClick={() => action(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { status: comment.status === 'active' ? 'inactive' : 'active' } }))}>{comment.status === 'active' ? 'Hide' : 'Activate'}</button>}
        {isAdmin && <button onClick={() => action(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(comment.locked) } }))}>{comment.locked ? 'Unlock' : 'Lock'}</button>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={() => { if (window.confirm('Delete this comment and its replies?')) action(() => api(`/comments/${comment.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button>}
      </div>
      {(comment.status === 'active' || isAdmin) && <ReactionPanel kind="comment" id={comment.id} auth={auth} onChanged={reload} />}
      {replying && <form className="replyForm" onSubmit={submitReply}>
        <label className="srOnly" htmlFor={`reply-${comment.id}`}>Reply</label>
        <textarea id={`reply-${comment.id}`} required maxLength="20000" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={`Reply to ${comment.author_login}…`} />
        <div><button className="primary compact">Post reply</button><button type="button" className="quietButton" onClick={() => setReplying(false)}>Cancel</button></div>
      </form>}
      <ErrorBox error={error} />
    </article>
    {children.map((child) => <CommentNode key={child.id} comment={child} allComments={allComments} postId={postId} auth={auth} reload={load} depth={depth + 1} />)}
  </div>;
}

export default function PostPage({ id }) {
  const auth = useSelector((state) => state.auth);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [engagement, setEngagement] = useState({ favorite: false, following: false });
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setError(null);
    try {
      const [postResult, commentResult] = await Promise.all([
        api(`/posts/${id}`, { token: auth?.token }),
        api(`/posts/${id}/comments`, { token: auth?.token }),
      ]);
      setPost(postResult.data);
      setComments(commentResult.data);
      if (auth?.token) {
        const engagementResult = await api(`/posts/${id}/engagement`, { token: auth.token });
        setEngagement(engagementResult.data);
      } else {
        setEngagement({ favorite: false, following: false });
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setMessage('');
    load();
  }, [id, auth?.token]);

  if (loading) return <main><div className="card loading">Loading question…</div></main>;
  if (!post) return <main><ErrorBox error={error} /></main>;

  const isAdmin = auth?.user?.role === 'admin';
  const isOwner = Number(auth?.user?.id) === Number(post.author_id);
  const canInteract = isAdmin || (post.status === 'active' && !post.locked);
  const canSaveOrFollow = isAdmin || post.status === 'active';
  const visibleIds = new Set(comments.map((comment) => Number(comment.id)));
  const roots = comments.filter((comment) => !comment.parent_comment_id || !visibleIds.has(Number(comment.parent_comment_id)));

  async function react(type) {
    setMessage('');
    try {
      await api(`/posts/${id}/like`, { method: 'POST', token: auth.token, body: { type } });
      await load();
      window.dispatchEvent(new Event('usof:notifications'));
    } catch (err) {
      setError(err);
    }
  }

  async function comment(event) {
    event.preventDefault();
    if (!text.trim()) return;
    setMessage('');
    try {
      await api(`/posts/${id}/comments`, { method: 'POST', token: auth.token, body: { content: text } });
      setText('');
      await load();
      window.dispatchEvent(new Event('usof:notifications'));
    } catch (err) {
      setError(err);
    }
  }

  async function moderate(body) {
    setMessage('');
    try {
      await api(`/posts/${id}`, { method: 'PATCH', token: auth.token, body });
      await load();
    } catch (err) {
      setError(err);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this question? This also removes its comments and reactions.')) return;
    try {
      await api(`/posts/${id}`, { method: 'DELETE', token: auth.token });
      go('/');
    } catch (err) {
      setError(err);
    }
  }

  async function toggleEngagement(kind) {
    setError(null);
    setMessage('');
    const current = kind === 'favorite' ? engagement.favorite : engagement.following;
    try {
      await api(`/posts/${id}/${kind === 'favorite' ? 'favorite' : 'follow'}`, {
        method: current ? 'DELETE' : 'POST',
        token: auth.token,
      });
      setEngagement((value) => ({ ...value, [kind === 'favorite' ? 'favorite' : 'following']: !current }));
      await load();
    } catch (err) {
      setError(err);
    }
  }

  async function trackShare(channel) {
    try {
      await api(`/posts/${id}/share`, { method: 'POST', token: auth?.token, body: { channel } });
      await load();
    } catch (err) {
      setError(err);
    }
  }

  async function shareNative() {
    const url = window.location.href;
    const data = { title: post.title, text: post.title, url };
    setMessage('');
    try {
      if (navigator.share) {
        await navigator.share(data);
        await trackShare('native');
      } else {
        await navigator.clipboard.writeText(url);
        setMessage('Question link copied.');
        await trackShare('copy');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('Question link copied.');
      await trackShare('copy');
    } catch (err) {
      setError(err);
    }
  }

  function shareTo(channel) {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(post.title);
    const targets = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      x: `https://x.com/intent/post?url=${url}&text=${title}`,
      telegram: `https://t.me/share/url?url=${url}&text=${title}`,
    };
    window.open(targets[channel], '_blank', 'noopener,noreferrer,width=720,height=640');
    trackShare(channel);
  }

  return <main className="postPage">
    <article className="card questionCard">
      <div className="questionHeading"><div><p className="eyebrow">Question #{post.id}</p><h1>{post.title}</h1></div><div className="scoreHero">{Number(post.score) > 0 ? '+' : ''}{post.score || 0}</div></div>
      <div className="postMeta"><span>by <b>{post.author_login}</b></span>{post.author_rating !== undefined && <TrustBadge rating={post.author_rating} />}<span>{fmt(post.created_at)}</span><StatusBadges item={post} /></div>
      <p className="content">{post.content}</p>
      <div className="tags">{post.categories?.map((category) => <span key={category.id}>{category.title}</span>)}</div>
      <div className="questionStats">
        <span><b>{post.like_count || 0}</b> likes</span><span><b>{post.comment_count || 0}</b> answers</span><span><b>{post.favorite_count || 0}</b> saved</span><span><b>{post.follower_count || 0}</b> following</span><span><b>{post.share_count || 0}</b> shares</span>
      </div>
      <div className="questionTools">
        {auth && canInteract && !isOwner && <ReactionButtons onReact={react} />}
        {auth && canSaveOrFollow && <div className="toolbar"><button onClick={() => toggleEngagement('favorite')}>{engagement.favorite ? '★ Saved' : '☆ Save'}</button><button onClick={() => toggleEngagement('following')}>{engagement.following ? 'Following ✓' : 'Follow'}</button></div>}
        <div className="toolbar shareTools"><button onClick={shareNative}>Share</button><button onClick={copyLink}>Copy link</button><button onClick={() => shareTo('facebook')}>Facebook</button><button onClick={() => shareTo('x')}>X</button><button onClick={() => shareTo('telegram')}>Telegram</button></div>
      </div>
      <div className="toolbar">
        {isOwner && !isAdmin && <button onClick={() => go(`/edit/${post.id}`)}>Edit question</button>}
        {isAdmin && <><button onClick={() => moderate({ status: post.status === 'active' ? 'inactive' : 'active' })}>{post.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => moderate({ locked: !Boolean(post.locked) })}>{post.locked ? 'Unlock' : 'Lock'}</button></>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={remove}>Delete</button>}
      </div>
      {(post.status === 'active' || isAdmin) && <ReactionPanel kind="post" id={post.id} auth={auth} onChanged={load} />}
      {message && <div className="alert success">{message}</div>}
      <ErrorBox error={error} />
    </article>

    <section className="commentsSection">
      <div className="sectionTitle"><div><p className="eyebrow">Discussion</p><h2>{comments.length} comment{comments.length === 1 ? '' : 's'}</h2></div></div>
      {roots.length
        ? roots.map((commentItem) => <CommentNode key={commentItem.id} comment={commentItem} allComments={comments} postId={post.id} auth={auth} reload={load} />)
        : <div className="card empty">No comments yet.</div>}
      {auth
        ? !canInteract
          ? <div className="card alert">This question is not open for new answers right now.</div>
          : <form className="card form commentComposer" onSubmit={comment}><label>Add an answer<textarea required maxLength="20000" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a useful answer or clarification…" /></label><button className="primary">Post answer</button></form>
        : <div className="card signInPrompt">Log in to answer or react. <button className="linkButton" onClick={() => go('/login')}>Log in</button></div>}
    </section>
  </main>;
}
