import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';

function Metric({ label, value }) {
  return <article className="uxMetric">
    <span>{label}</span>
    <strong>{value}</strong>
  </article>;
}

export default function DashboardPage() {
  const auth = useSelector((state) => state.auth);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.token) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    api('/dashboard/me', { token: auth.token })
      .then((result) => { if (active) setData(result.data); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth?.token]);

  if (!auth) return <main className="narrow"><div className="card empty">
    <h1>Your activity</h1><p>Log in to see your activity.</p>
    <button className="primary" onClick={() => go('/login')}>Log in</button>
  </div></main>;
  if (loading) return <main className="uxDashboard"><p>Loading activity…</p></main>;
  if (!data) return <main className="uxDashboard"><ErrorBox error={error} /></main>;

  const { stats, trust, weeklyGoal } = data;
  const progress = weeklyGoal.target ? Math.min(100, Math.round(weeklyGoal.current / weeklyGoal.target * 100)) : 0;

  return <main className="uxDashboard">
    <header className="uxPageHead">
      <p className="uxOverline">CIRCLE / ACCOUNT</p>
      <h1>Your activity</h1>
      <p>Posts, replies and conversations you've saved.</p>
    </header>

    <section className="uxMetrics" aria-label="Your account numbers">
      <Metric label="Posts" value={stats.posts} />
      <Metric label="Replies" value={stats.answers} />
      <Metric label="Reactions received" value={stats.positiveReactionsReceived} />
      <Metric label="Saved posts" value={stats.favorites} />
    </section>

    <div className="uxDashboardSplit">
      <section className="card uxSimplePanel">
        <div className="uxPanelHead">
          <h2>This week</h2>
          <small>{weeklyGoal.current} of {weeklyGoal.target} replies</small>
        </div>
        <div className="uxWeeklyTrack" role="progressbar" aria-label="Weekly replies"
          aria-valuemin="0" aria-valuemax={weeklyGoal.target} aria-valuenow={weeklyGoal.current}>
          <span style={{ width: progress + '%' }} />
        </div>
        <p>{weeklyGoal.completed ? 'Weekly target reached.' : 'Join conversations when you have something to say.'}</p>
        <div className="uxReputation">
          <span>Reputation</span><strong>{trust.rating} · {trust.name}</strong>
        </div>
      </section>

      <section className="card uxSimplePanel">
        <h2>Your shortcuts</h2>
        <div className="uxShortcutList">
          <button onClick={() => go('/profile')}>My profile <span>↗</span></button>
          <button onClick={() => go('/saved')}>Saved posts <span>↗</span></button>
          <button onClick={() => go('/following')}>Followed conversations <span>↗</span></button>
          <button onClick={() => go('/notifications')}>Notifications <span>{stats.unreadNotifications || 0}</span></button>
        </div>
      </section>
    </div>
  </main>;
}
