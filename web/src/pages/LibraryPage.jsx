import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, PostCard, go } from '../ui.jsx';

export default function LibraryPage({ mode = 'favorites' }) {
  const auth = useSelector((state) => state.auth);
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isFollowing = mode === 'following';

  useEffect(() => {
    setPage(1);
  }, [mode]);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const query = new URLSearchParams({ page: String(page), limit: '8', sort, order: 'desc' });
    setLoading(true);
    setError(null);
    api(`/library/${isFollowing ? 'following' : 'favorites'}?${query}`, { token: auth.token })
      .then((result) => {
        setPosts(result.data);
        setPagination(result.pagination);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [auth?.token, isFollowing, page, sort]);

  if (!auth) return <main className="narrow"><div className="card empty"><h1>{isFollowing ? 'Following' : 'Saved questions'}</h1><p>Log in to keep a personal question library.</p><button className="primary" onClick={() => go('/login')}>Log in</button></div></main>;

  return <main>
    <section className="hero compactHero">
      <p className="eyebrow">Your library</p>
      <h1>{isFollowing ? 'Following' : 'Saved questions'}</h1>
      <p>{isFollowing ? 'Discussions you follow and receive updates about.' : 'Questions you saved for later.'}</p>
    </section>
    <div className="libraryToolbar card">
      <div className="tabs">
        <button className={!isFollowing ? 'active' : ''} onClick={() => go('/saved')}>Saved</button>
        <button className={isFollowing ? 'active' : ''} onClick={() => go('/following')}>Following</button>
      </div>
      <label>Sort<select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="date">Newest</option><option value="likes">Most liked</option><option value="trending">Trending</option></select></label>
    </div>
    <ErrorBox error={error} />
    {loading
      ? <div className="card loading">Loading your library…</div>
      : posts.length
        ? <section className="postList">{posts.map((post) => <PostCard key={post.id} post={post} />)}</section>
        : <div className="card empty"><h2>Nothing here yet.</h2><p>{isFollowing ? 'Follow a question to keep up with its discussion.' : 'Save a useful question and it will appear here.'}</p><button className="secondary" onClick={() => go('/')}>Browse questions</button></div>}
    {pagination && pagination.totalPages > 1 && <div className="pager">
      <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Previous</button>
      <span>Page {pagination.page} / {pagination.totalPages}</span>
      <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next →</button>
    </div>}
  </main>;
}
