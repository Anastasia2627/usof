import React from 'react';
import { useSelector } from 'react-redux';
import AdminDashboard from './AdminDashboard.jsx';
import { go } from '../ui.jsx';

export default function AdminDashboardPage() {
  const auth = useSelector((state) => state.auth);
  if (auth?.user?.role !== 'admin') {
    return <main className="narrow"><div className="card error"><h1>Admin dashboard</h1><p>Admin access required.</p></div></main>;
  }

  return <main className="adminPage">
    <div className="sectionTitle">
      <div><p className="eyebrow">Platform overview</p><h1>Admin dashboard</h1></div>
      <button className="secondary" onClick={() => go('/admin')}>Manage content</button>
    </div>
    <AdminDashboard auth={auth} />
  </main>;
}
