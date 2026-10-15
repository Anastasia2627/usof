import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { ErrorBox, go } from '../ui.jsx';

function shortDate(value) {
  return new Date(value + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short' });
}

export default function AdminDashboard({ auth }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api('/dashboard/admin', { token: auth.token })
      .then((result) => { if (active) setData(result.data); })
      .catch((err) => { if (active) setError(err); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [auth.token]);

  const chartMax = useMemo(() => Math.max(1, ...(data?.growth || [])
    .flatMap((day) => [Number(day.posts), Number(day.comments)])), [data]);

  if (loading) return <div className="card loading">Loading community activity…</div>;
  if (!data) return <ErrorBox error={error} />;

  const { overview, growth, topCategories, moderation } = data;
  const reviewCount = Number(overview.moderation_posts || 0) + Number(overview.moderation_comments || 0);
  const metrics = [
    { label: 'Members', value: overview.users },
    { label: 'New this week', value: overview.new_users_7d },
    { label: 'Posts', value: overview.posts },
    { label: 'Replies', value: overview.comments },
  ];

  return <div className="uxAdminContent">
    <section className="uxMetrics" aria-label="Community overview">
      {metrics.map((item) => <article className="uxMetric" key={item.label}>
        <span>{item.label}</span><strong>{item.value ?? 0}</strong>
      </article>)}
    </section>

    <div className="uxDashboardSplit">
      <section className="card uxSimplePanel">
        <div className="uxPanelHead"><h2>Activity</h2><small>Last 7 days</small></div>
        <div className="uxActivityChart" aria-label="Posts and replies created each day in the last week">
          {growth.map((day) => <div className="uxActivityDay" key={day.date}>
            <div className="uxActivityBars">
              <span title={day.posts + ' posts'} style={{ height: Math.max(2, Number(day.posts) / chartMax * 100) + '%' }} />
              <span title={day.comments + ' replies'} style={{ height: Math.max(2, Number(day.comments) / chartMax * 100) + '%' }} />
            </div>
            <small>{shortDate(day.date)}</small>
          </div>)}
        </div>
        <p className="uxLegend"><span>Posts</span><span>Replies</span></p>
      </section>

      <section className="card uxSimplePanel">
        <div className="uxPanelHead"><h2>Moderation</h2><small>{reviewCount} items</small></div>
        {reviewCount ? <div className="uxShortcutList">
          {moderation.posts.slice(0, 3).map((post) => <button key={'p' + post.id}
            onClick={() => go('/post/' + post.id)}>{post.title}<span>↗</span></button>)}
          {moderation.comments.slice(0, 3).map((comment) => <button key={'c' + comment.id}
            onClick={() => go('/post/' + comment.post_id)}>{comment.post_title}<span>↗</span></button>)}
        </div> : <p>No hidden or locked content.</p>}
        <button className="secondary uxManageButton" onClick={() => go('/admin')}>Manage content</button>
      </section>
    </div>

    <section className="card uxSimplePanel uxTopics">
      <h2>Popular topics</h2>
      <div className="uxTopicRows">
        {topCategories.map((category) => <div key={category.id}>
          <span>{category.title}</span><strong>{category.posts} posts</strong>
        </div>)}
        {!topCategories.length && <p>No topics yet.</p>}
      </div>
    </section>
    <ErrorBox error={error} />
  </div>;
}
