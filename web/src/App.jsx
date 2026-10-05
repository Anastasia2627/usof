import React, { useEffect, useState } from 'react';
import { Header, Icon, go } from './ui.jsx';
import { useI18n } from './i18n.jsx';
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

function PlaceholderPage({ icon, eyebrow, title, copy }) {
  return <main className="narrow compactHero">
    <section className="card placeholderPanel">
      <span className="placeholderIcon"><Icon name={icon} filled /></span>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
      <button className="primary" onClick={() => go('/')}>Back to the conversation</button>
    </section>
  </main>;
}

function NotFoundPage() {
  return <PlaceholderPage
    icon="wrong_location"
    eyebrow="404 · wandered off"
    title="This corner is empty."
    copy="The page may have moved, or the conversation never started."
  />;
}

export default function App() {
  const hash = useHash();
  const { language, setLanguage } = useI18n();
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
  else if (path === '/messages') page = <PlaceholderPage icon="forum" eyebrow="Messages" title="Private conversations are next." copy="The route is reserved now so direct messages can be added without reshaping the rest of Circle." />;
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
    <footer className="siteFooter">
      <button className="footerBrand" onClick={() => go('/')}>circle</button>
      <span>A place for conversations.</span>
      <div className="footerActions">
        <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button>
        <button className={language === 'uk' ? 'active' : ''} onClick={() => setLanguage('uk')}>UA</button>
      </div>
    </footer>
  </>;
}
