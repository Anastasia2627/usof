import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';

const OVERVIEW_LABELS = {
  users: 'Users',
  verified_users: 'Verified users',
  new_users_7d: 'New users · 7d',
  posts: 'Questions',
  active_posts: 'Active questions',
  inactive_posts: 'Inactive questions',
  comments: 'Answers',
  reactions: 'Reactions',
  favorites: 'Saved posts',
  following: 'Follows',
  shares: 'Shares',
  unread_notifications: 'Unread notifications',
};

function shortDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short' });
}

export default function AdminDashboard({ auth }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api('/dashboard/admin', { token: auth.token })
      .then((result) => setData(result.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [auth.token]);

  const growthMax = useMemo(() => {
    if (!data?.growth?.length) return 1;
    return Math.max(1, ...data.growth.flatMap((day) => [day.users, day.posts, day.comments, day.reactions]));
  }, [data]);

  if (loading) return <div className="card loading">Loading platform dashboard…</div>;
  if (!data) return <ErrorBox error={error} />;

  const overviewEntries = Object.entries(OVERVIEW_LABELS);
  const queueSize = Number(data.overview.moderation_posts || 0) + Number(data.overview.moderation_comments || 0);

  return <div className="adminDashboard">
    <section className="statsGrid adminStats">
      {overviewEntries.map(([key, label]) => <div className="card statCard" key={key}><small>{label}</small><strong>{data.overview[key] ?? 0}</strong></div>)}
    </section>

    <div className="dashboardGrid adminDashboardGrid">
      <section className="card dashboardPanel growthPanel">
        <div className="sectionTitle"><div><p className="eyebrow">Last seven days</p><h2>Platform activity</h2></div></div>
        <div className="growthChart" aria-label="Seven day platform activity chart">
          {data.growth.map((day) => <div className="growthDay" key={day.date}>
            <div className="bars">
              <span title={`${day.users} users`} style={{ height: `${Math.max(3, (day.users / growthMax) * 100)}%` }} />
              <span title={`${day.posts} questions`} style={{ height: `${Math.max(3, (day.posts / growthMax) * 100)}%` }} />
              <span title={`${day.comments} answers`} style={{ height: `${Math.max(3, (day.comments / growthMax) * 100)}%` }} />
              <span title={`${day.reactions} reactions`} style={{ height: `${Math.max(3, (day.reactions / growthMax) * 100)}%` }} />
            </div>
            <small>{shortDate(day.date)}</small>
          </div>)}
        </div>
        <div className="chartLegend"><span>Users</span><span>Questions</span><span>Answers</span><span>Reactions</span></div>
      </section>

      <section className="card dashboardPanel moderationSummary">
        <p className="eyebrow">Moderation</p>
        <h2>{queueSize ? `${queueSize} items need context` : 'Queue is clear'}</h2>
        <p className="muted">Inactive and locked content is surfaced here so moderation stays visible without mixing it into normal user work.</p>
        <div className="moderationNumbers"><span><b>{data.overview.inactive_posts || 0}</b> inactive questions</span><span><b>{data.overview.locked_posts || 0}</b> locked questions</span><span><b>{data.overview.inactive_comments || 0}</b> inactive answers</span><span><b>{data.overview.locked_comments || 0}</b> locked answers</span></div>
      </section>
    </div>

    <div className="dashboardGrid adminDashboardGrid">
      <section className="card dashboardPanel">
        <p className="eyebrow">Community</p><h2>Top contributors</h2>
        <ol className="rankList">{data.topContributors.map((user) => <li key={user.id}><span className="rankNumber">{user.rating}</span><div><strong>{user.login}</strong><small>{user.answers} answers · {user.posts} questions</small></div></li>)}</ol>
      </section>
      <section className="card dashboardPanel">
        <p className="eyebrow">Knowledge map</p><h2>Top categories</h2>
        <ol className="rankList">{data.topCategories.map((category) => <li key={category.id}><span className="rankNumber">{category.posts}</span><div><strong>{category.title}</strong><small>{category.posts} questions · {category.comments} answers</small></div></li>)}</ol>
      </section>
    </div>

    <div className="dashboardGrid adminDashboardGrid">
      <section className="card dashboardPanel">
        <p className="eyebrow">Feedback</p><h2>Reaction mix</h2>
        <div className="reactionSummary">{data.reactionMix.map((reaction) => <span key={reaction.type}><b>{reaction.count}</b> {reaction.type}</span>)}</div>
      </section>
      <section className="card dashboardPanel">
        <p className="eyebrow">Recent moderation context</p><h2>Quick review</h2>
        <div className="moderationLinks">
          {data.moderation.posts.slice(0, 4).map((post) => <button className="moderationLink" key={`p-${post.id}`} onClick={() => go(`/post/${post.id}`)}><b>Question #{post.id}</b><span>{post.title}</span></button>)}
          {data.moderation.comments.slice(0, 4).map((comment) => <button className="moderationLink" key={`c-${comment.id}`} onClick={() => go(`/post/${comment.post_id}`)}><b>Answer #{comment.id}</b><span>{comment.post_title}</span></button>)}
          {!data.moderation.posts.length && !data.moderation.comments.length && <p className="muted">No inactive or locked content.</p>}
        </div>
      </section>
    </div>
    <ErrorBox error={error} />
  </div>;
}
