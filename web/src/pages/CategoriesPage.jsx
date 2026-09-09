import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, PostCard, go } from '../ui.jsx';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/categories')
      .then((result) => setCategories(result.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return <main>
    <p className="eyebrow">Browse by technology</p>
    <h1>Categories</h1>
    <ErrorBox error={error} />
    {loading
      ? <div className="card loading">Loading categories…</div>
      : categories.length
        ? <section className="categoryGrid">{categories.map((category) => <button className="card categoryCard" key={category.id} onClick={() => go(`/category/${category.id}`)}><span className="categoryIndex">{String(category.id).padStart(2, '0')}</span><h2>{category.title}</h2><p>{category.description}</p></button>)}</section>
        : <div className="card empty">No categories yet.</div>}
  </main>;
}

export function CategoryDetailPage({ id }) {
  const auth = useSelector((state) => state.auth);
  const [category, setCategory] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      api(`/categories/${id}`, { signal: controller.signal }),
      api(`/categories/${id}/posts`, { token: auth?.token, signal: controller.signal }),
    ])
      .then(([categoryResult, postResult]) => {
        setCategory(categoryResult.data);
        setPosts(postResult.data);
      })
      .catch((err) => { if (err.name !== 'AbortError') setError(err); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [id, auth?.token]);

  if (loading) return <main><div className="card loading">Loading category…</div></main>;

  return <main>
    <button className="linkButton" onClick={() => go('/categories')}>← All categories</button>
    <section className="hero categoryHero">
      <p className="eyebrow">Category {String(id).padStart(2, '0')}</p>
      <h1>{category?.title || 'Category'}</h1>
      {category?.description && <p>{category.description}</p>}
    </section>
    <ErrorBox error={error} />
    {!error && (posts.length
      ? <section className="postList">{posts.map((post) => <PostCard key={post.id} post={post} />)}</section>
      : <div className="card empty"><h2>No questions here yet</h2><p>Choose another category or ask the first question.</p></div>)}
  </main>;
}
