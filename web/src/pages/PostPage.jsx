import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, StatusBadges, fmt, go } from '../ui.jsx';

function Reactions({ kind, id, auth, visible, writable, authorId, onChange }) {
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
      <span>{items.filter(x => x.type === 'like').length} likes · {items.filter(x => x.type === 'dislike').length} dislikes</span>
      {canVote && <>
        <button type="button" className="reactionIconButton" aria-label="Like" title="Like" onClick={() => change('POST', 'like')}><Icon name="heart" size={19}/></button>
        <button type="button" className="reactionIconButton" aria-label="Dislike" title="Dislike" onClick={() => change('POST', 'dislike')}><Icon name="dislike" size={19}/></button>
        {own && <button type="button" aria-label="Remove my vote" title="Remove my vote" className="reactionIconButton" onClick={() => change('DELETE')}><Icon name="close" size={19}/></button>}
      </>}
      <button type="button" onClick={() => setOpen(x => !x)}>{open ? 'Hide votes' : 'View votes'}</button>
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

function Comment({ item, comments, postId, auth, refresh, depth = 0 }) {
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState(null);
  const children = comments.filter(x => Number(x.parent_comment_id) === Number(item.id));
  const isAdmin = auth?.user?.role === 'admin';
  const isOwner = Number(auth?.user?.id) === Number(item.author_id);
  const active = item.status === 'active';
  const canReply = Boolean(auth && (isAdmin || (active && !item.locked && !item.post_locked)));
  const canChangeStatus = Boolean(auth && (isAdmin || !item.locked));

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
          <small>{fmt(item.created_at)}</small>
        </div>
        <StatusBadges item={item} />
      </div>
      <p className="commentContent">{item.content}</p>
      <Reactions kind="comment" id={item.id} auth={auth} authorId={item.author_id} visible={isAdmin || (active && item.post_status === 'active')}
        writable={isAdmin || (active && !item.locked && item.post_status === 'active' && !item.post_locked)}
        onChange={refresh} />
      <div className="commentActions">
        {canReply && <button onClick={() => setReplying(x => !x)}><Icon name="comment" size={17}/> Reply</button>}
        {canChangeStatus && <button onClick={() => run(`/comments/${item.id}`, 'PATCH', { status: active ? 'inactive' : 'active' })}>
          {active ? 'Deactivate' : 'Activate'}</button>}
        {isAdmin && <button onClick={() => run(`/comments/${item.id}`, 'PATCH', { locked: !item.locked })}>{item.locked ? 'Unlock' : 'Lock'}</button>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={() => {
          if (window.confirm('Delete this comment and replies?')) run(`/comments/${item.id}`, 'DELETE');
        }}>Delete</button>}
      </div>
      {replying && <form className="replyForm" onSubmit={sendReply}>
        <label>Reply<textarea required maxLength="20000" value={reply} onChange={e => setReply(e.target.value)} /></label>
        <div className="toolbar"><button className="primary">Post reply</button><button type="button" onClick={() => setReplying(false)}>Cancel</button></div>
      </form>}
      <ErrorBox error={error} />
    </article>
    {children.map(child => <Comment key={child.id} item={child} comments={comments} postId={postId} auth={auth} refresh={refresh} depth={depth + 1} />)}
  </div>;
}

export default function PostPage({ id }) {
  const auth = useSelector(state => state.auth);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

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
  useEffect(() => { setLoading(true); setPost(null); load(); }, [id, auth?.token]);

  if (loading) return <main><p>Loading post…</p></main>;
  if (!post) return <main><ErrorBox error={error} /></main>;

  const isAdmin = auth?.user?.role === 'admin';
  const isOwner = Number(auth?.user?.id) === Number(post.author_id);
  const canComment = Boolean(auth && (isAdmin || (post.status === 'active' && !post.locked)));
  const commentIds = new Set(comments.map(x => Number(x.id)));
  const roots = comments.filter(x => !x.parent_comment_id || !commentIds.has(Number(x.parent_comment_id)));

  async function run(method, body) {
    try {
      await api(`/posts/${id}`, { method, token: auth.token, ...(body ? { body } : {}) });
      await load();
    } catch (err) { setError(err); }
  }

  async function sendComment(event) {
    event.preventDefault();
    try {
      await api(`/posts/${id}/comments`, { method: 'POST', token: auth.token, body: { content: text } });
      setText('');
      await load();
    } catch (err) { setError(err); }
  }

  async function deletePost() {
    if (!window.confirm('Delete post and all its comments?')) return;
    try {
      await api(`/posts/${id}`, { method: 'DELETE', token: auth.token });
      go('/');
    } catch (err) { setError(err); }
  }

  return <main className="postPage">
    <article className="card questionCard">
      <div className="questionHeading"><h1>{post.title}</h1><span className="scoreHero">Rating: {post.score || 0}</span></div>
      <div className="postMeta">
        By <button className="authorLink" onClick={() => go(`/profile/${post.author_id}`)}>{post.author_login}</button>
        <span>{fmt(post.created_at)}</span><StatusBadges item={post} />
      </div>
      <p className="content">{post.content}</p>
      <div className="tags">{(post.categories || []).map(x => <span key={x.id}>{x.title}</span>)}</div>
      <Reactions kind="post" id={post.id} auth={auth} authorId={post.author_id} visible={isAdmin || post.status === 'active'}
        writable={isAdmin || (post.status === 'active' && !post.locked)} onChange={load} />
      <div className="toolbar">
        {isOwner && !isAdmin && <button onClick={() => go(`/edit/${post.id}`)}><Icon name="edit" size={18}/> Edit</button>}
        {isAdmin && <>
          <button onClick={() => run('PATCH', { status: post.status === 'active' ? 'inactive' : 'active' })}>
            {post.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button onClick={() => run('PATCH', { locked: !post.locked })}>{post.locked ? 'Unlock' : 'Lock'}</button>
        </>}
        {(isOwner || isAdmin) && <button className="dangerText" onClick={deletePost}>Delete post</button>}
      </div>
      <ErrorBox error={error} />
    </article>

    <section className="commentsSection">
      <h2>Comments ({comments.length})</h2>
      <p className="muted">Sorted by likes (ascending).</p>
      {roots.length ? roots.map(item => <Comment key={item.id} item={item} comments={comments} postId={post.id} auth={auth} refresh={load} />)
        : <div className="card">No comments yet.</div>}
      {canComment ? <form className="card form commentComposer" onSubmit={sendComment}>
        <label>New comment<textarea required maxLength="20000" value={text} onChange={e => setText(e.target.value)} /></label>
        <button className="primary">Comment</button>
      </form> : <p>{!auth ? 'Log in to comment or vote.' : 'Comments are disabled for this post.'}</p>}
    </section>
  </main>;
}
