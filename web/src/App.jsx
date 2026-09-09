import React, { useEffect, useState } from 'react';
import { Header, go } from './ui.jsx';
import { AuthPage, ResetPage, VerifyPage } from './pages/AuthPages.jsx';
import HomePage from './pages/HomePage.jsx';
import CategoriesPage, { CategoryDetailPage } from './pages/CategoriesPage.jsx';
import PostPage from './pages/PostPage.jsx';
import PostEditor from './pages/PostEditor.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LibraryPage from './pages/LibraryPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';

function currentHash() {
  return window.location.hash.slice(1) || '/';
}

function useHash() {
  const [hash, setHash] = useState(currentHash());
  useEffect(() => {
    const onHashChange = () => setHash(currentHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  return hash;
}

function NotFoundPage() {
  return <main className="narrow">
    <div className="card empty">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <button className="primary" onClick={() => go('/')}>Back home</button>
    </div>
  </main>;
}

export default function App() {
  const hash = useHash();
  const path = hash.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  let page;

  if (path === '/') page = <HomePage hash={hash} />;
  else if (path === '/login') page = <AuthPage mode="login" />;
  else if (path === '/register') page = <AuthPage mode="register" />;
  else if (path === '/categories') page = <CategoriesPage />;
  else if (path === '/profile') page = <ProfilePage />;
  else if (path === '/dashboard') page = <DashboardPage />;
  else if (path === '/saved') page = <LibraryPage mode="favorites" />;
  else if (path === '/following') page = <LibraryPage mode="following" />;
  else if (path === '/notifications') page = <NotificationsPage />;
  else if (path === '/create') page = <PostEditor />;
  else if (path === '/admin') page = <AdminPage />;
  else if (path === '/admin/dashboard') page = <AdminDashboardPage />;
  else if (parts[0] === 'category' && parts[1]) page = <CategoryDetailPage id={parts[1]} />;
  else if (parts[0] === 'post' && parts[1]) page = <PostPage id={parts[1]} />;
  else if (parts[0] === 'edit' && parts[1]) page = <PostEditor id={parts[1]} />;
  else if (parts[0] === 'verify') page = <VerifyPage token={parts[1] || ''} />;
  else if (parts[0] === 'reset') page = <ResetPage token={parts[1] || ''} />;
  else page = <NotFoundPage />;

  return <>
    <Header />
    {page}
    <footer>Usof · programming Q&amp;A · React + Redux + Express + MySQL</footer>
  </>;
}
