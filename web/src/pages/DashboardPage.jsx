import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { api } from '../api.js';
import { ErrorBox, Icon, go } from '../ui.jsx';
import { usePreferences } from '../preferences.jsx';

function Metric({ label, value }) {
  return <div className="dashStat"><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></div>;
}
function Growth({ data = [] }) {
  const max = Math.max(1,...data.map(d=>Number(d.posts || 0)));
  return <div className="dashGraph">
    <div className="dashSpark" role="img" aria-label="Community posts over seven days">
      {data.map(d=><div key={d.date} title={d.date + ': ' + d.posts} className="dashSparkItem">
        <span style={{height:Math.max(5, Math.round(Number(d.posts || 0)/max*100))+'%'}}/>
      </div>)}
    </div>
    <div className="dashLegend">{data.map(d=><span key={d.date}>{new Date(d.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'})}</span>)}</div>
  </div>;
}
export default function DashboardPage() {
  const auth=useSelector(state=>state.auth);
  const {t}=usePreferences();
  const admin=auth?.user?.role==='admin';
  const [data,setData]=useState(null), [error,setError]=useState(null), [loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!auth?.token){setLoading(false);return;}
    const controller=new AbortController();
    setLoading(true);setError(null);
    api(admin?'/dashboard/admin':'/dashboard/me',{token:auth.token,signal:controller.signal})
      .then(result=>{if(!controller.signal.aborted)setData(result.data);})
      .catch(err=>{if(err.name!=='AbortError')setError(err);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[auth?.token,admin,retry]);

  if(!auth)return <main className="simpleFeaturePage"><h1>{t('Statistics')}</h1><button className="primary" onClick={()=>go('/login')}>{t('Log in')}</button></main>;
  return <main className="simpleFeaturePage dashboardPage">
    <div className="featureHeading"><Icon name="analytics" size={27}/><h1>{t(admin?'Admin overview':'Your activity')}</h1></div>
    <p className="featureSubheading">{admin?t('Community'):'@'+auth.user.login}</p>
    <ErrorBox error={error} onRetry={()=>setRetry(v=>v+1)}/>
    {loading?<p>{t('Loading…')}</p>:data&&(admin?<>
      <div className="dashStats">
        <Metric label={t('Members')} value={data.overview?.users}/>
        <Metric label={t('Posts')} value={data.overview?.posts}/>
        <Metric label={t('Comments')} value={data.overview?.comments}/>
        <Metric label={t('Reactions')} value={data.overview?.reactions}/>
      </div>
      <section className="dashSection"><h2>{t('Activity')} <small>7 days</small></h2><Growth data={data.growth}/></section>
      <section className="dashSection"><h2>{t('Moderation')}</h2>
        <div className="dashInline"><span>{t('Inactive')} {t('Posts')}</span><strong>{data.overview?.inactive_posts||0}</strong></div>
        <div className="dashInline"><span>{t('Comments')}</span><strong>{data.overview?.comments||0}</strong></div>
        <div className="dashInline"><span>{t('New members')}</span><strong>{data.overview?.new_users_7d||0}</strong></div>
        <button className="featureTextLink" onClick={()=>go('/admin')}>{t('Admin')} <Icon name="arrow" size={18}/></button>
      </section>
      <section className="dashSection"><h2>{t('Topics')}</h2>
        {(data.topCategories||[]).map(item=><div key={item.id} className="dashInline"><span>{item.title}</span><strong>{item.posts}</strong></div>)}
      </section>
    </>:<>
      <div className="dashStats">
        <Metric label={t('Posts')} value={data.stats?.posts}/>
        <Metric label={t('Replies')} value={data.stats?.answers}/>
        <Metric label={t('Received likes')} value={data.stats?.positiveReactionsReceived}/>
        <Metric label={t('Reputation')} value={data.trust?.rating}/>
      </div>
      <section className="dashSection">
        <h2>{t('Weekly goal')} <small>{data.weeklyGoal?.current||0} / {data.weeklyGoal?.target||5}</small></h2>
        <div className="dashProgress" role="progressbar" aria-valuenow={data.weeklyGoal?.current||0}
          aria-valuemin={0} aria-valuemax={data.weeklyGoal?.target||5}>
          <span style={{width:Math.min(100,Number(data.weeklyGoal?.current||0)/Math.max(1,Number(data.weeklyGoal?.target||5))*100)+'%'}}/>
        </div><p className="dashHint">{data.trust?.name} · {data.trust?.rating||0} {t('Reputation')}</p>
      </section>
      <section className="dashSection"><h2>{t('Achievements')}</h2>
        {(data.achievements||[]).map(item=><div className="dashAchievement" key={item.id}>
          <Icon name={item.unlocked?'check':'lock'} size={20}/><div><strong>{item.title}</strong><p>{item.description}</p></div><small>{item.progress}/{item.target}</small>
        </div>)}
      </section>
      <section className="dashSection"><h2>{t('Community')}</h2>
        <div className="dashInline"><span>{t('Saved')}</span><strong>{data.stats?.favorites||0}</strong></div>
        <div className="dashInline"><span>{t('Following')}</span><strong>{data.stats?.following||0}</strong></div>
      </section>
    </>)}
  </main>;
}
