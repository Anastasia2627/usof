import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, PostCard, go } from '../ui.jsx';

export default function SearchPage({ hash }) {
  const auth = useSelector(state => state.auth);
  const query = new URLSearchParams(hash.split('?')[1] || '').get('q')?.trim() || '';
  const [data, setData] = useState({ posts: [], users: [], categories: [] });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) { setLoading(false); setData({ posts: [], users: [], categories: [] }); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api('/search?q=' + encodeURIComponent(query), { token: auth?.token, signal: controller.signal })
      .then(result => setData(result.data))
      .catch(err => { if (err.name !== 'AbortError') setError(err); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, auth?.token]);

  return <main className="searchPage">
    <h1>Search</h1>
    {!query ? <p>Enter a name, post title, text or category in the search bar.</p> : <p>Results for <strong>{query}</strong></p>}
    <ErrorBox error={error} />
    {loading ? <p>Searching…</p> : <>
      <section className="searchSection">
        <h2>Posts ({data.posts.length})</h2>
        {data.posts.length ? <div className="postList">{data.posts.map(post => <PostCard key={post.id} post={post} />)}</div>
          : <p>No matching posts.</p>}
      </section>
      <section className="searchSection">
        <h2>People ({data.users.length})</h2>
        <div className="searchCards">
          {data.users.map(user => <button className="card searchPerson" key={user.id} onClick={() => go('/profile/' + user.id)}>
            <Avatar user={user} size="sm" />
            <span><strong>@{user.login}</strong> <small>{user.full_name || 'Circle member'}</small></span>
          </button>)}
        </div>
        {!data.users.length && <p>No matching users.</p>}
      </section>
      <section className="searchSection">
        <h2>Categories ({data.categories.length})</h2>
        <div className="searchCards">
          {data.categories.map(category => <button className="card searchPerson" key={category.id} onClick={() => go('/category/' + category.id)}>
            <strong>{category.title}</strong><small>{category.description}</small>
          </button>)}
        </div>
        {!data.categories.length && <p>No matching categories.</p>}
      </section>
    </>}
  </main>;
}
