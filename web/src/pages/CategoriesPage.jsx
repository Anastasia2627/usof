import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';

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
        ? <section className="categoryGrid">{categories.map((category) => <button className="card categoryCard" key={category.id} onClick={() => go(`/?category=${category.id}`)}><span className="categoryIndex">{String(category.id).padStart(2, '0')}</span><h2>{category.title}</h2><p>{category.description}</p></button>)}</section>
        : <div className="card empty">No categories yet.</div>}
  </main>;
}
