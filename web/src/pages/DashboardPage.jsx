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
    <header className="studioHeading">
      <div>
        <p className="eyebrow">YOUR PERSONAL SPACE</p>
        <h1>Your Circle Space<span className="heroGradientWord">.</span></h1>
        <p>A home for the things you share, save and care about.</p>
      </div>
      <div className="studioHeadingActions">
        <button className="secondary" onClick={() => go('/profile')}>Your profile</button>
        <button className="primary" onClick={() => go('/create')}>Start a conversation ↗</button>
      </div>
    </header>

    <section className="card dashboardHero">
      <div>
        <p className="eyebrow">YOUR COMMUNITY ENERGY</p>
        <h1>{trust.name}</h1>
        <p>{trust.rating} reputation points · {trust.nextLevelAt ? `${Math.max(0, trust.nextLevelAt - trust.rating)} until your next level` : 'Top trust level unlocked'}</p>
        <div className="dashboardHeroActions">
          <button className="secondary" onClick={() => go('/notifications')}>Updates {stats.unreadNotifications ? `· ${stats.unreadNotifications} new` : ''}</button>
          <button className="secondary" onClick={() => go('/following')}>Following</button>
        </div>
      </div>
      <div className="studioTrustVisual">
        <div className="studioRing" style={{ '--ring-progress': `${Math.max(0, Math.min(100, trust.progress))}%` }} role="img" aria-label={`Trust level progress ${trust.progress}%`}>
          <div className="studioRingContent"><strong>{trust.progress}%</strong><small>next level</small></div>
        </div>
        <div className="trustBlock">
          <div className="trustProgress"><span>Community rank</span><strong>#{stats.communityRank} of {stats.contributors}</strong></div>
          <div className="trustProgress"><span>Reputation</span><strong>{trust.rating} points</strong></div>
        </div>
      </div>
    </section>

    <section className="statsGrid" aria-label="Contribution statistics">
      <Stat label="Replies" value={stats.answers} hint={`${stats.answersThisWeek} this week`} />
      <Stat label="Posts" value={stats.posts} />
      <Stat label="Reactions received" value={stats.positiveReactionsReceived} />
      <Stat label="Active streak" value={`${stats.contributionStreak}d`} />
      <Stat label="Saved" value={stats.favorites} />
      <Stat label="Following" value={stats.following} />
    </section>

    <div className="dashboardGrid">
      <section className="card dashboardPanel goalPanel">
        <p className="eyebrow">Your weekly rhythm</p>
        <h2>{weeklyGoal.completed ? 'Goal completed' : 'Join five conversations this week'}</h2>
        <div className="goalNumber"><strong>{weeklyGoal.current}</strong><span>/ {weeklyGoal.target} replies</span></div>
        <div className="progressTrack"><span style={{ width: `${Math.min(100, goalProgress)}%` }} /></div>
        <p className="muted">Every reply helps keep your corner of Circle alive.</p>
      </section>

      <section className="card dashboardPanel">
        <p className="eyebrow">Your impact</p>
        <h2>Love coming your way</h2>
        <div className="reactionSummary">
          {Object.entries(reactionsReceived).length
            ? Object.entries(reactionsReceived).map(([type, count]) => <span key={type}><b>{count}</b> {type}</span>)
            : <p className="muted">No reactions yet. Share a thought and join the conversation.</p>}
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
        <div><p className="eyebrow">DISCOVER</p><h2>Conversations you might love</h2></div>
        <button className="secondary" onClick={() => go('/')}>Explore conversations</button>
      </div>
      {suggestions.length
        ? <div className="miniList">{suggestions.map((post) => <PostCard key={post.id} post={post} />)}</div>
        : <div className="card empty"><h3>You are caught up.</h3><p>You’re all caught up. Explore the latest conversations.</p></div>}
    </section>

    <div className="dashboardShortcuts">
      <button className="card shortcutCard" onClick={() => go('/saved')}><strong>Saved posts</strong><span>Pick up where you left off.</span></button>
      <button className="card shortcutCard" onClick={() => go('/following')}><strong>Following</strong><span>See discussions you are watching.</span></button>
      <button className="card shortcutCard" onClick={() => go('/notifications')}><strong>Notifications</strong><span>{stats.unreadNotifications} unread updates.</span></button>
    </div>
    <ErrorBox error={error} />
  </main>;
}
