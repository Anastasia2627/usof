import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, StatusBadges, fmt, go } from '../ui.jsx';

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
      {loading ? <small>Loading reactions…</small> : reactions.length ? <ul>{reactions.map((reaction) => <li key={reaction.id}><b>{reaction.author_login}</b> · {reaction.type}</li>)}</ul> : <small>No reactions yet.</small>}
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

  async function action(work) {
    setError(null);
    try {
      await work();
      await reload();
    } catch (err) {
      setError(err);
    }
  }

  async function submitReply(event) {
    event.preventDefault();
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
        <div className="authorLine"><Avatar user={{ login: comment.author_login, avatar: comment.author_avatar }} size="sm" /><b>{comment.author_login}</b><span className="muted">{fmt(comment.created_at)}</span></div>
        <StatusBadges item={comment} />
      </div>
      <p className="commentContent">{comment.content}</p>
      <div className="commentActions">
        <span className="scoreText">Score {comment.score || 0}</span>
        {auth && <>
          <button onClick={() => action(() => api(`/comments/${comment.id}/like`, { method: 'POST', token: auth.token, body: { type: 'like' } }))}>▲ Like</button>
          <button onClick={() => action(() => api(`/comments/${comment.id}/like`, { method: 'POST', token: auth.token, body: { type: 'dislike' } }))}>▼ Dislike</button>
          {!comment.locked && comment.status === 'active' && <button onClick={() => setReplying((value) => !value)}>Reply</button>}
        </>}
        {(isOwner || isAdmin) && <button onClick={() => action(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { status: comment.status === 'active' ? 'inactive' : 'active' } }))}>{comment.status === 'active' ? 'Hide' : 'Activate'}</button>}
        {isAdmin && <button onClick={() => action(() => api(`/comments/${comment.id}`, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(comment.locked) } }))}>{comment.locked ? 'Unlock' : 'Lock'}</button>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={() => { if (window.confirm('Delete this comment and its replies?')) action(() => api(`/comments/${comment.id}`, { method: 'DELETE', token: auth.token })); }}>Delete</button>}
      </div>
      <ReactionPanel kind="comment" id={comment.id} auth={auth} onChanged={reload} />
      {replying && <form className="replyForm" onSubmit={submitReply}>
        <label className="srOnly" htmlFor={`reply-${comment.id}`}>Reply</label>
        <textarea id={`reply-${comment.id}`} required maxLength="20000" value={reply} onChange={(event) => setReply(event.target.value)} placeholder={`Reply to ${comment.author_login}…`} />
        <div><button className="primary compact">Post reply</button><button type="button" className="quietButton" onClick={() => setReplying(false)}>Cancel</button></div>
      </form>}
      <ErrorBox error={error} />
    </article>
    {children.map((child) => <CommentNode key={child.id} comment={child} allComments={allComments} postId={postId} auth={auth} reload={reload} depth={depth + 1} />)}
  </div>;
}

export default function PostPage({ id }) {
  const auth = useSelector((state) => state.auth);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
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
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
  }, [id, auth?.token]);

  if (loading) return <main><div className="card loading">Loading question…</div></main>;
  if (!post) return <main><ErrorBox error={error} /></main>;

  const isAdmin = auth?.user?.role === 'admin';
  const isOwner = Number(auth?.user?.id) === Number(post.author_id);
  const visibleIds = new Set(comments.map((comment) => Number(comment.id)));
  const roots = comments.filter((comment) => !comment.parent_comment_id || !visibleIds.has(Number(comment.parent_comment_id)));

  async function react(type) {
    try {
      await api(`/posts/${id}/like`, { method: 'POST', token: auth.token, body: { type } });
      await load();
    } catch (err) {
      setError(err);
    }
  }

  async function comment(event) {
    event.preventDefault();
    try {
      await api(`/posts/${id}/comments`, { method: 'POST', token: auth.token, body: { content: text } });
      setText('');
      await load();
    } catch (err) {
      setError(err);
    }
  }

  async function moderate(body) {
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

  return <main className="postPage">
    <article className="card questionCard">
      <div className="questionHeading"><div><p className="eyebrow">Question #{post.id}</p><h1>{post.title}</h1></div><div className="scoreHero">{Number(post.score) > 0 ? '+' : ''}{post.score || 0}</div></div>
      <div className="postMeta"><span>by <b>{post.author_login}</b></span><span>{fmt(post.created_at)}</span><StatusBadges item={post} /></div>
      <p className="content">{post.content}</p>
      <div className="tags">{post.categories?.map((category) => <span key={category.id}>{category.title}</span>)}</div>
      <div className="toolbar">
        {auth && <><button onClick={() => react('like')}>▲ Like</button><button onClick={() => react('dislike')}>▼ Dislike</button></>}
        {isOwner && !isAdmin && <button onClick={() => go(`/edit/${post.id}`)}>Edit question</button>}
        {isAdmin && <><button onClick={() => moderate({ status: post.status === 'active' ? 'inactive' : 'active' })}>{post.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => moderate({ locked: !Boolean(post.locked) })}>{post.locked ? 'Unlock' : 'Lock'}</button></>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={remove}>Delete</button>}
      </div>
      <ReactionPanel kind="post" id={post.id} auth={auth} onChanged={load} />
      <ErrorBox error={error} />
    </article>

    <section className="commentsSection">
      <div className="sectionTitle"><div><p className="eyebrow">Discussion</p><h2>{comments.length} comment{comments.length === 1 ? '' : 's'}</h2></div></div>
      {roots.length
        ? roots.map((commentItem) => <CommentNode key={commentItem.id} comment={commentItem} allComments={comments} postId={post.id} auth={auth} reload={load} />)
        : <div className="card empty">No comments yet.</div>}
      {auth
        ? post.locked && !isAdmin
          ? <div className="card alert">This question is locked. New comments are disabled.</div>
          : <form className="card form commentComposer" onSubmit={comment}><label>Add a comment<textarea required maxLength="20000" value={text} onChange={(event) => setText(event.target.value)} placeholder="Write a useful answer or clarification…" /></label><button className="primary">Post comment</button></form>
        : <div className="card signInPrompt">Log in to comment or react. <button className="linkButton" onClick={() => go('/login')}>Log in</button></div>}
    </section>
  </main>;
}
