import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Header, go } from './ui.jsx';
import {usePreferences} from './preferences.jsx';
import { AuthPage, ResetPage, VerifyPage } from './pages/AuthPages.jsx';
import HomePage from './pages/HomePage.jsx';
import CategoriesPage, { CategoryDetailPage } from './pages/CategoriesPage.jsx';
import PostPage from './pages/PostPage.jsx';
import PostEditor from './pages/PostEditor.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import SearchPage from './pages/SearchPage.jsx';
import WelcomePage from './pages/WelcomePage.jsx';
import SavedPage from './pages/SavedPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import InterestsPage from './pages/InterestsPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';

function currentHash() {
  return window.location.hash.slice(1) || '/';
}

export default function App() {
  const [hash, setHash] = useState(currentHash);
  const auth = useSelector(state => state.auth);
  const {t}=usePreferences();
  const [sessionExpired,setSessionExpired]=useState(false);
  useEffect(() => {
    const changed = () => setHash(currentHash());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);

  useEffect(()=>{
    const expired=()=>setSessionExpired(true);
    window.addEventListener('circle:session-expired',expired);
    return()=>window.removeEventListener('circle:session-expired',expired);
  },[]);
  useEffect(()=>{if(auth?.token)setSessionExpired(false);},[auth?.token]);

  const path = hash.split('?')[0];
  const parts = path.split('/').filter(Boolean);
  let page;
  if (path === '/') page = <HomePage hash={hash} />;
  else if (path === '/welcome') page = <WelcomePage />;
  else if (path === '/explore') page = <HomePage hash={hash} basePath="/explore" />;
  else if (path === '/saved') page = <SavedPage />;
  else if (path === '/notifications') page = <NotificationsPage />;
  else if (path === '/dashboard') page = auth?.user?.role==='admin'?<AdminPage initialTab="dashboard"/>:<DashboardPage />;
  else if (path === '/settings') page = <SettingsPage />;
  else if (path === '/interests') page = <InterestsPage />;
  else if (path === '/login') page = <AuthPage mode="login" />;
  else if (path === '/register') page = <AuthPage mode="register" />;
  else if (path === '/categories') page = <CategoriesPage />;
  else if (path === '/search') page = <SearchPage hash={hash} />;
  else if (path === '/profile') page = <ProfilePage />;
  else if (parts[0] === 'profile' && /^\d+$/.test(parts[1] || '')) page = <ProfilePage userId={parts[1]} />;
  else if (path === '/create') page = <PostEditor />;
  else if (path === '/admin') page = <AdminPage initialTab={new URLSearchParams(hash.split('?')[1]||'').get('tab')||'users'}/>;
  else if (parts[0] === 'category' && parts[1]) page = <CategoryDetailPage id={parts[1]} />;
  else if (parts[0] === 'post' && parts[1]) page = <PostPage id={parts[1]} />;
  else if (parts[0] === 'edit' && parts[1]) page = <PostEditor id={parts[1]} />;
  else if (parts[0] === 'verify') page = <VerifyPage token={parts[1] || ''} />;
  else if (parts[0] === 'reset') page = <ResetPage token={parts[1] || ''} />;
  else page = <main className="narrow"><h1>Page not found</h1><button onClick={() => go('/')}>Home</button></main>;

  return <><Header />
    {sessionExpired && <div className="sessionExpiredBanner" role="status">
      <span>{t('Your session has expired. Please log in again.')}</span>
      <button type="button" onClick={()=>go('/login')}>{t('Log in')}</button>
      <button type="button" aria-label={t('Dismiss')} onClick={()=>setSessionExpired(false)}>×</button>
    </div>}
    {page}<footer>Circle · Conversations start here.</footer></>;
}
