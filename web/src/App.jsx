import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Header, go } from './ui.jsx';
import { AuthPage, ResetPage, VerifyPage } from './pages/AuthPages.jsx';
import HomePage from './pages/HomePage.jsx';
import CategoriesPage, { CategoryDetailPage } from './pages/CategoriesPage.jsx';
import PostPage from './pages/PostPage.jsx';
import PostEditor from './pages/PostEditor.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import WelcomePage from './pages/WelcomePage.jsx';

function currentHash() {
  return window.location.hash.slice(1) || '/';
}

export default function App() {
  const [hash, setHash] = useState(currentHash);
  const auth = useSelector(state => state.auth);
  useEffect(() => {
    const changed = () => setHash(currentHash());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);

  const path = hash.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  let page;
  if (path === '/') page = auth ? <HomePage hash={hash} /> : <WelcomePage />;
  else if (path === '/explore') page = <HomePage hash={hash} basePath="/explore" />;
  else if (path === '/login') page = <AuthPage mode="login" />;
  else if (path === '/register') page = <AuthPage mode="register" />;
  else if (path === '/categories') page = <CategoriesPage />;
  else if (path === '/search') page = <SearchPage hash={hash} />;
  else if (path === '/profile') page = <ProfilePage />;
  else if (parts[0] === 'profile' && /^\d+$/.test(parts[1] || '')) page = <ProfilePage userId={parts[1]} />;
  else if (path === '/create') page = <PostEditor />;
  else if (path === '/admin') page = <AdminPage />;
  else if (parts[0] === 'category' && parts[1]) page = <CategoryDetailPage id={parts[1]} />;
  else if (parts[0] === 'post' && parts[1]) page = <PostPage id={parts[1]} />;
  else if (parts[0] === 'edit' && parts[1]) page = <PostEditor id={parts[1]} />;
  else if (parts[0] === 'verify') page = <VerifyPage token={parts[1] || ''} />;
  else if (parts[0] === 'reset') page = <ResetPage token={parts[1] || ''} />;
  else page = <main className="narrow"><h1>Page not found</h1><button onClick={() => go('/')}>Home</button></main>;

  return <><Header />{page}<footer>Circle · USOF project</footer></>;
}
