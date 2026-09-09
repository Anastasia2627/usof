import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, PostCard, go } from '../ui.jsx';

function Stat({ label, value, hint }) {
  return <div className="card statCard">
    <small>{label}</small>
    <strong>{value}</strong>
    {hint && <span>{hint}</span>}
  </div>;
}

function Achievement({ item }) {
  const progress = item.target ? Math.round((Number(item.progress) / Number(item.target)) * 100) : 0;
  return <article className={`achievement ${item.unlocked ? 'unlocked' : ''}`}>
    <div className="achievementMark">{item.unlocked ? '✓' : '○'}</div>
    <div>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
      {!item.unlocked && <small>{item.progress} / {item.target} · {Math.min(100, progress)}%</small>}
    </div>
  </article>;
}

export default function DashboardPage() {
  const auth = useSelector((state) => state.auth);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api('/dashboard/me', { token: auth.token })
      .then((result) => setDashboard(result.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [auth?.token]);

  if (!auth) return <main className="narrow"><div className="card empty"><h1>Your dashboard</h1><p>Log in to see your progress and questions worth answering.</p><button className="primary" onClick={() => go('/login')}>Log in</button></div></main>;
  if (loading) return <main><div className="card loading">Loading your dashboard…</div></main>;
  if (!dashboard) return <main><ErrorBox error={error} /></main>;

  const { trust, stats, weeklyGoal, achievements, reactionsReceived, suggestions } = dashboard;
  const goalProgress = weeklyGoal.target ? Math.round((weeklyGoal.current / weeklyGoal.target) * 100) : 0;

  return <main className="dashboardPage">
    <section className="card dashboardHero">
      <div>
        <p className="eyebrow">Your contribution dashboard</p>
        <h1>{trust.name}</h1>
        <p>Reputation {trust.rating}{trust.nextLevelAt ? ` · ${trust.nextLevelAt - trust.rating} to the next trust level` : ' · highest trust level'}</p>
      </div>
      <div className="trustBlock">
        <div className="trustProgress"><span>Community rank</span><strong>#{stats.communityRank} / {stats.contributors}</strong></div>
        <div className="trustProgress"><span>Trust progress</span><strong>{trust.progress}%</strong></div>
        <div className="progressTrack"><span style={{ width: `${trust.progress}%` }} /></div>
      </div>
    </section>

    <section className="statsGrid" aria-label="Contribution statistics">
      <Stat label="Answers" value={stats.answers} hint={`${stats.answersThisWeek} this week`} />
      <Stat label="Questions" value={stats.posts} />
      <Stat label="Positive reactions" value={stats.positiveReactionsReceived} />
      <Stat label="Contribution streak" value={`${stats.contributionStreak}d`} />
      <Stat label="Saved" value={stats.favorites} />
      <Stat label="Following" value={stats.following} />
    </section>

    <div className="dashboardGrid">
      <section className="card dashboardPanel goalPanel">
        <p className="eyebrow">Weekly goal</p>
        <h2>{weeklyGoal.completed ? 'Goal completed' : 'Help five people this week'}</h2>
        <div className="goalNumber"><strong>{weeklyGoal.current}</strong><span>/ {weeklyGoal.target} answers</span></div>
        <div className="progressTrack"><span style={{ width: `${Math.min(100, goalProgress)}%` }} /></div>
        <p className="muted">Useful answers build reputation and unlock higher trust levels.</p>
      </section>

      <section className="card dashboardPanel">
        <p className="eyebrow">Reputation signals</p>
        <h2>Reactions received</h2>
        <div className="reactionSummary">
          {Object.entries(reactionsReceived).length
            ? Object.entries(reactionsReceived).map(([type, count]) => <span key={type}><b>{count}</b> {type}</span>)
            : <p className="muted">No reactions yet. A helpful answer is a good place to start.</p>}
        </div>
      </section>
    </div>

    <section>
      <div className="sectionTitle">
        <div><p className="eyebrow">Milestones</p><h2>Achievements</h2></div>
      </div>
      <div className="achievementGrid">{achievements.map((item) => <Achievement key={item.id} item={item} />)}</div>
    </section>

    <section>
      <div className="sectionTitle">
        <div><p className="eyebrow">Give something back</p><h2>Questions that could use your answer</h2></div>
        <button className="secondary" onClick={() => go('/')}>Browse all questions</button>
      </div>
      {suggestions.length
        ? <div className="miniList">{suggestions.map((post) => <PostCard key={post.id} post={post} />)}</div>
        : <div className="card empty"><h3>You are caught up.</h3><p>There are no unanswered questions for you right now.</p></div>}
    </section>

    <div className="dashboardShortcuts">
      <button className="card shortcutCard" onClick={() => go('/saved')}><strong>Saved questions</strong><span>Return to questions you want to keep.</span></button>
      <button className="card shortcutCard" onClick={() => go('/following')}><strong>Following</strong><span>See discussions you are watching.</span></button>
      <button className="card shortcutCard" onClick={() => go('/notifications')}><strong>Notifications</strong><span>{stats.unreadNotifications} unread updates.</span></button>
    </div>
    <ErrorBox error={error} />
  </main>;
}
