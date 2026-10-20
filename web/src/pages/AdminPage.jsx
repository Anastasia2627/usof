import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../api.js';
import { Avatar, ErrorBox, Icon, StatusBadges, go } from '../ui.jsx';
import {usePreferences} from '../preferences.jsx';
import DashboardPage from './DashboardPage.jsx';
import {useInfiniteRecords,InfiniteScrollEnd} from '../InfiniteScroll.jsx';

function UserRow({ user, auth, onSave, onDelete, onBan, onUnban }) {
  const {t}=usePreferences();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);
  const [showBan, setShowBan] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [banBusy, setBanBusy] = useState(false);
  const toolsRef = useRef(null);
  const closeTools = () => { if (toolsRef.current) toolsRef.current.open = false; };
  useEffect(()=>{
    const outside=event=>{if(toolsRef.current?.open&&!toolsRef.current.contains(event.target))closeTools();};
    const escape=event=>{if(event.key==='Escape')closeTools();};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape);
    };
  },[]);
  const [form, setForm] = useState({
    login: user.login,
    email: user.email,
    fullName: user.full_name || '',
    role: user.role,
  });

  useEffect(() => {
    setForm({
      login: user.login,
      email: user.email,
      fullName: user.full_name || '',
      role: user.role,
    });
  }, [user.login, user.email, user.full_name, user.role]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await onSave(user, form);
      if (result) setEditing(false);
    } finally { setSaving(false); }
  }

  async function submitBan(event) {
    event.preventDefault();
    setBanBusy(true);
    try {
      const result = await onBan(user,{reason:banReason,internalNote:adminNote});
      if(result){setShowBan(false);setBanReason('');setAdminNote('');}
    } finally { setBanBusy(false); }
  }

  async function unblock() {
    if(!window.confirm('Restore access for @'+user.login+'?'))return;
    setBanBusy(true);
    try{await onUnban(user);}finally{setBanBusy(false);}
  }

  async function quickRole() {
    const nextRole=user.role==='moderator'?'user':'moderator';
    const question=nextRole==='moderator'
      ? 'Make @'+user.login+' a moderator? They will be able to review reports and moderate posts and replies, but not manage users or roles.'
      : 'Remove moderator permissions from @'+user.login+'?';
    if(!window.confirm(question))return;
    setRoleBusy(true);
    try { await onSave(user,{role:nextRole}); }
    finally { setRoleBusy(false); }
  }

  return <div className="adminListItem adminUserRow">
    <div className="adminItemLine">
      <Avatar user={user} size="md"/>
      <div className="adminItemText">
        <button type="button" className="adminName" onClick={() => go('/profile/' + user.id)}>{user.login}</button>
        <p>{user.full_name || user.email}</p>
      </div>
      <span className="adminRoleChip">{t(user.banned_at ? 'Banned' : user.role)}</span>
      <span className="adminScore" title={t('User rating')}>{Number(user.rating || 0)} {t('points')}</span>
      <div className="adminRowTools adminUserRowTools">
        <details className="adminUserActionMenu" ref={toolsRef}>
          <summary title={t('More')} aria-label={t('More')+' · @'+user.login}>
            <Icon name="more" size={20}/>
          </summary>
          <div className="adminUserMenuItems">
            <button type="button" onClick={() => { closeTools(); setEditing(value => !value); }}>
              <Icon name="edit" size={17}/>{t('Edit')}
            </button>
            {user.role!=='admin' && <button type="button" disabled={roleBusy||saving}
              onClick={()=>{closeTools();quickRole();}}>
              <Icon name={user.role==='moderator'?'close':'shield'} size={17}/>
              {t(user.role==='moderator'?'Remove moderator':'Make moderator')}
            </button>}
            {user.role!=='admin' && (user.banned_at ?
              <button type="button" disabled={banBusy} onClick={()=>{closeTools();unblock();}}>
                <Icon name="unlock" size={17}/>{t('Unblock')}
              </button> :
              <button type="button" onClick={()=>{closeTools();setShowBan(value=>!value);}}>
                <Icon name="lock" size={17}/>{t('Block')}
              </button>)}
            <div className="adminUserMenuDivider" role="separator"/>
            <button type="button" className="adminUserMenuDanger"
              disabled={Number(user.id)===Number(auth.user.id)}
              onClick={()=>{closeTools();onDelete(user);}}>
              <Icon name="trash" size={17}/>{t('Delete')}
            </button>
          </div>
        </details>
      </div>
    </div>
    {showBan && !user.banned_at && <form className="adminInlineForm banEditor" onSubmit={submitBan}>
      <h3>{t('Block')} @{user.login}</h3>
      <p>{t('They will lose site access, but can still appeal this restriction.')}</p>
      <label>{t('Official reason (shown to the user)')}
        <textarea minLength={5} maxLength={500} required value={banReason} onChange={e=>setBanReason(e.target.value)} />
      </label>
      <label>{t('Private admin note (never shown to the user)')}
        <textarea maxLength={2000} value={adminNote} onChange={e=>setAdminNote(e.target.value)} />
      </label>
      <div className="adminFormActions">
        <button type="button" onClick={()=>setShowBan(false)}>{t('Cancel')}</button>
        <button className="primary" disabled={banBusy}>{t('Confirm block')}</button>
      </div>
    </form>}
    {user.banned_at && <div className="adminBanSummary">
      <strong>{t('Blocked on')} {new Date(user.banned_at).toLocaleString()}</strong>
      <p>{t('Official reason')}: {user.ban_reason}</p>
      {user.ban_internal_note && <p>{t('Private admin note')}: {user.ban_internal_note}</p>}
    </div>}
    {editing && <form className="adminInlineForm" onSubmit={save}>
      <div className="adminFields">
        <label>{t('Username')}<input aria-label={'Login for ' + user.login} required minLength="3" maxLength="50" value={form.login} onChange={event => setForm({ ...form, login: event.target.value })}/></label>
        <label>{t('Email')}<input aria-label={'Email for ' + user.login} type="email" required value={form.email} onChange={event => setForm({ ...form, email: event.target.value })}/></label>
        <label>{t('Full name')}<input aria-label={'Full name for ' + user.login} maxLength="100" value={form.fullName} onChange={event => setForm({ ...form, fullName: event.target.value })}/></label>
        <label>{t('Role')}<select aria-label={'Role for ' + user.login} value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}><option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option></select></label>
      </div>
      <div className="adminFormActions">
        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        <button className="primary" type="submit" disabled={saving}>{t(saving ? 'Saving…' : 'Save user')}</button>
      </div>
    </form>}
  </div>;
}

function PostCategoryEditor({ post, categories, auth, run }) {
  const {t}=usePreferences();
  const [selected, setSelected] = useState(post.categories?.map(item => Number(item.id)) || []);
  const [query,setQuery] = useState('');
  useEffect(() => setSelected(post.categories?.map(item => Number(item.id)) || []), [post.id, post.categories]);
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  return <details className="adminInnerDetails">
    <summary>{t('Topics')} <Icon name="chevron" size={17}/></summary>
    <div className="topicSearchField adminPostTopicSearch">
      <Icon name="search" size={16}/>
      <input type="search" aria-label={t('Search topics')} placeholder={t('Search topics')}
        value={query} onChange={event=>setQuery(event.target.value)}/>
      {query&&<button type="button" title={t('Clear search')} aria-label={t('Clear search')}
        onClick={()=>setQuery('')}><Icon name="close" size={15}/></button>}
    </div>
    <div className="adminTopicChoices">
      {categories.filter(category=>[category.title,t(category.title),category.description||'']
        .some(value=>String(value).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))
        .map(category => <label className="adminTopicChoice" key={category.id}>
        <input type="checkbox" checked={selected.includes(Number(category.id))} onChange={() => toggle(Number(category.id))}/>
        <span>{t(category.title)}</span>
      </label>)}
    </div>
    <button className="primary adminSaveTopics" type="button" disabled={!selected.length}
      onClick={() => run(() => api('/posts/' + post.id, { method: 'PATCH', token: auth.token, body: { categories: selected } }))}>{t('Save topics')}</button>
  </details>;
}

function CategoryRow({ category, auth, run }) {
  const {t}=usePreferences();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(category.title);
  const [description, setDescription] = useState(category.description || '');

  useEffect(() => { setTitle(category.title); setDescription(category.description || ''); }, [category.title, category.description]);

  async function save(event) {
    event.preventDefault();
    const result = await run(() => api('/categories/' + category.id, {
      method: 'PATCH', token: auth.token, body: { title, description },
    }));
    if (result) setEditing(false);
  }
  function remove() {
    if (window.confirm('Delete category ' + category.title + '?')) {
      run(() => api('/categories/' + category.id, { method: 'DELETE', token: auth.token }));
    }
  }

  return <div className="adminListItem">
    <div className="adminItemLine">
      <div className="adminItemText">
        <h3>{t(category.title)}</h3>
        {category.description&&<p>{t(category.description)}</p>}
      </div>
      <div className="adminRowTools">
        <button type="button" className="adminIconAction" title={t('Edit')} aria-label={'Edit category ' + category.title} onClick={() => setEditing(value => !value)}><Icon name="edit" size={18}/></button>
        <button type="button" className="adminIconAction dangerText" title={t('Delete')} aria-label={t('Delete')+' '+category.title} onClick={remove}><Icon name="trash" size={18}/></button>
      </div>
    </div>
    {editing && <form className="adminInlineForm" onSubmit={save}>
      <div className="adminFields">
        <label>{t('Title')}<input value={title} maxLength="100" required onChange={event => setTitle(event.target.value)} /></label>
        <label>{t('Description')}<input value={description} onChange={event => setDescription(event.target.value)} /></label>
      </div>
      <div className="adminFormActions">
        <button type="button" onClick={() => setEditing(false)}>Cancel</button>
        <button type="submit" className="primary">{t('Save category')}</button>
      </div>
    </form>}
  </div>;
}

export default function AdminPage({initialTab='users'}) {
  const {t,language}=usePreferences();
  const auth = useSelector(state => state.auth);
  const dispatch = useDispatch();
  const [tab, setTab] = useState(initialTab);
  const [categoryQuery,setCategoryQuery] = useState('');
  const [suggestionStatus,setSuggestionStatus]=useState('pending');
  const [reviewBusy,setReviewBusy]=useState(null);
  const [reportStatus,setReportStatus] = useState('open');
  const [reportPage,setReportPage] = useState(1);
  const [selectedReportId,setSelectedReportId] = useState(null);
  const [reportPagination,setReportPagination] = useState(null);
  const [postsRefresh,setPostsRefresh]=useState(0);
  const postsFeed=useInfiniteRecords({
    identity:(auth?.token||'')+'|'+postsRefresh,
    enabled:Boolean(auth?.token && ['admin','moderator'].includes(auth?.user?.role)),
    request:(page,signal)=>api('/posts?'+new URLSearchParams({
      page:String(page),limit:'20',sort:'date',order:'desc',
    }),{token:auth?.token,signal}),
  });
  const [data, setData] = useState({ users: [], categories: [], comments: [], reactions: [], reports: [], suggestions: [], appeals: [] });
  const [appealNotes,setAppealNotes]=useState({});
  const [selectedAppealId,setSelectedAppealId]=useState(null);
  const [appealNoteOpen,setAppealNoteOpen]=useState(false);
  const [commentMenu,setCommentMenu]=useState(null);
  const commentMenuRef=useRef(null);
  const moreTabsRef=useRef(null);
  useEffect(()=>{
    const outside=event=>{
      if(moreTabsRef.current?.open&&!moreTabsRef.current.contains(event.target))
        moreTabsRef.current.open=false;
    };
    const escape=event=>{
      if(event.key==='Escape'&&moreTabsRef.current?.open){
        moreTabsRef.current.open=false;
        moreTabsRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('keydown',escape);
    };
  },[]);
  const [banFromReport,setBanFromReport]=useState(null);
  const [reportBanReason,setReportBanReason]=useState('');
  const [reportBanNote,setReportBanNote]=useState('');
  const [appealsWarning,setAppealsWarning]=useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ login: '', email: '', fullName: '', role: 'user', password: '', passwordConfirmation: '' });
  const [newCategory, setNewCategory] = useState({ title: '', description: '' });

  async function load() {
    if (!['admin','moderator'].includes(auth?.user?.role)) return;
    setError(null);
    setLoading(true);
    try {
      // A newer frontend can be loaded against a still-running older backend.
      // One unavailable endpoint must not hide every admin section and show 0 members.
      const endpoints = [
        moderator ? Promise.resolve({data:[]}) : api('/users', { token: auth.token }),
        api('/categories'),
        api('/comments', { token: auth.token }),
        api('/reactions?limit=100', { token: auth.token }),
        api('/reports?status='+reportStatus+'&page='+reportPage,{token:auth.token}),
        moderator ? Promise.resolve({data:[]}) : api('/categories/suggestions?status='+suggestionStatus,{token:auth.token}),
        moderator ? Promise.resolve({data:[]}) : api('/users/ban-appeals',{token:auth.token}),
      ];
      const results = await Promise.allSettled(endpoints);
      const values = results.map(item=>item.status==='fulfilled'?item.value:null);
      const [users, categories, comments, reactions, reports, suggestions, appeals] = values;
      setData(previous=>({
        users:users?.data??previous.users,
        categories:categories?.data??previous.categories,
        comments:comments?.data??previous.comments,
        reactions:reactions?.data??previous.reactions,
        reports:reports?.data??previous.reports,
        suggestions:suggestions?.data??previous.suggestions,
        appeals:appeals?.data??previous.appeals,
      }));
      setAppealsWarning(results[6].status==='rejected'
        ? 'Ban appeals are unavailable in the running API. Stop the old server, run npm run db:init and restart npm start.'
        : '');
      if (reports) setReportPagination(reports.pagination);
      const baseError=results.slice(0,6).find(item=>item.status==='rejected');
      if (baseError) setError(baseError.reason);
    } catch (err) { setError(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [auth?.token, auth?.user?.role,reportStatus,reportPage,suggestionStatus]);
  useEffect(()=>{setTab(initialTab);},[initialTab]);
  useEffect(()=>{if(tab==='reports'||tab==='appeals')load();},[tab]);
  useEffect(()=>{if(auth?.user?.role==='moderator')setTab('reports');},[auth?.user?.role]);
  useEffect(()=>{
    if(!commentMenu)return;
    const closeOnPointer=event=>{
      if(!commentMenuRef.current?.contains(event.target))setCommentMenu(null);
    };
    const closeOnEscape=event=>{
      if(event.key==='Escape')setCommentMenu(null);
    };
    const closeOnScroll=()=>setCommentMenu(null);
    document.addEventListener('pointerdown',closeOnPointer);
    document.addEventListener('keydown',closeOnEscape);
    window.addEventListener('scroll',closeOnScroll,true);
    return()=>{
      document.removeEventListener('pointerdown',closeOnPointer);
      document.removeEventListener('keydown',closeOnEscape);
      window.removeEventListener('scroll',closeOnScroll,true);
    };
  },[commentMenu]);
  function openCommentMenu(event,comment){
    event.preventDefault();
    const rect=event.currentTarget.getBoundingClientRect();
    const x=event.clientX>0?event.clientX:rect.right-24;
    const y=event.clientY>0?event.clientY:rect.top+24;
    setCommentMenu({
      id:comment.id,
      x:Math.max(10,Math.min(x,window.innerWidth-242)),
      y:Math.max(10,Math.min(y,window.innerHeight-238)),
    });
  }
  async function commentAction(comment,action){
    setCommentMenu(null);
    if(action==='open'){go('/post/'+comment.post_id);return;}
    if(action==='delete'){
      if(!window.confirm(t('Delete this comment?')))return;
      await run(()=>api('/comments/'+comment.id,{method:'DELETE',token:auth.token}));
      return;
    }
    const body=action==='status'
      ?{status:comment.status==='active'?'inactive':'active'}
      :{locked:!Boolean(comment.locked)};
    await run(()=>api('/comments/'+comment.id,{
      method:'PATCH',token:auth.token,body,
    }));
  }

  if (!['admin','moderator'].includes(auth?.user?.role)) return <main><div className="error">Admin access required.</div></main>;

  async function run(work) {
    setError(null);
    try {
      const result = await work();
      await load();
      setPostsRefresh(v=>v+1);
      return result;
    } catch (err) {
      setError(err);
      return null;
    }
  }

  async function saveUser(user, form) {
    const roleOnly = form.role !== undefined && user.role!=='admin' &&
      ['user','moderator'].includes(form.role) &&
      Object.keys(form).every(key=>key==='role' ||
        (key==='login' && form.login===user.login) ||
        (key==='email' && form.email===user.email) ||
        (key==='fullName' && form.fullName===(user.full_name||'')));
    const path = '/users/' + user.id + (roleOnly ? '/role' : '');
    const result = await run(() => api(path, { method: 'PATCH', token: auth.token,
      body: roleOnly ? {role:form.role} : form }));
    if(result?.data && Number(user.id) === Number(auth.user.id)) {
      dispatch({type:'AUTH_USER_SET',payload:{...auth.user,...result.data}});
    }
    return result;
  }

  async function hideReportedContent(report){
    if(!window.confirm(t('Hide the reported content from public view?')))return;
    const kind=report.post_id?'posts':'comments';
    const id=report.post_id||report.comment_id;
    await run(()=>api('/'+kind+'/'+id,{
      method:'PATCH',token:auth.token,body:{status:'inactive'},
    }));
  }
  async function confirmReportBan(report){
    const target=Number(report.post_author_id||report.comment_author_id);
    if(!target)return;
    const result=await run(()=>api('/users/'+target+'/ban',{
      method:'POST',token:auth.token,
      body:{reason:reportBanReason,internalNote:reportBanNote},
    }));
    if(result){setBanFromReport(null);setReportBanReason('');setReportBanNote('');}
  }

  async function banMember(user,reason) {
    return run(()=>api('/users/'+user.id+'/ban',{method:'POST',token:auth.token,body:reason}));
  }
  async function unbanMember(user) {
    return run(()=>api('/users/'+user.id+'/ban',{method:'DELETE',token:auth.token}));
  }
  async function decideAppeal(item,status) {
    const action=t(status==='approved'?'Approve & unban':'Reject appeal');
    if(!window.confirm(action+' @'+item.login+'?'))return;
    return run(()=>api('/users/ban-appeals/'+item.id,{
      method:'PATCH',token:auth.token,body:{status,reviewNote:appealNotes[item.id]||''},
    }));
  }

  function deleteUser(user) {
    if (!window.confirm('Delete ' + user.login + '? Their posts and comments will also be removed.')) return;
    run(() => api('/users/' + user.id, { method: 'DELETE', token: auth.token }));
  }

  async function createUser(event) {
    event.preventDefault();
    const result = await run(() => api('/users', { method: 'POST', token: auth.token, body: newUser }));
    if (result) setNewUser({ login: '', email: '', fullName: '', role: 'user', password: '', passwordConfirmation: '' });
  }
  async function createCategory(event) {
    event.preventDefault();
    const result = await run(() => api('/categories', { method: 'POST', token: auth.token, body: newCategory }));
    if (result) setNewCategory({ title: '', description: '' });
  }

  async function decideSuggestion(item,status){
    if(reviewBusy)return;
    if(!window.confirm(t(status==='approved'?'Approve':'Reject')+' «'+item.title+'»?'))return;
    setReviewBusy(item.id);setError(null);
    try{
      await api('/categories/suggestions/'+item.id,{method:'PATCH',token:auth.token,body:{status}});
      await load();
    }catch(err){setError(err);}finally{setReviewBusy(null);}
  }

  const moderator = auth?.user?.role === 'moderator';
  const orderedAppeals=[...data.appeals].sort((a,b)=>{
    if((a.status==='pending')!==(b.status==='pending'))return a.status==='pending'?-1:1;
    return new Date(b.created_at)-new Date(a.created_at);
  });
  const activeAppeal=orderedAppeals.find(item=>String(item.id)===String(selectedAppealId))
    ||orderedAppeals[0]||null;
  const activeReport=data.reports.find(item=>String(item.id)===String(selectedReportId))
    ||data.reports[0]||null;
  const counts = {
    users: data.users.length,
    posts: postsFeed.total,
    categories: data.categories.length,
    suggestions: data.suggestions.length,
    comments: data.comments.length,
    reports: reportPagination?.total||0,
    appeals: data.appeals.filter(item=>item.status==='pending').length,
  };
  const primarySections = moderator ? ['reports','posts'] : ['dashboard','users','appeals','reports','posts'];
  const extraSections = moderator ? ['comments','reactions'] : ['suggestions','categories','comments','reactions'];
  const changeSection=name=>{
    setTab(name);
    if(moreTabsRef.current) moreTabsRef.current.open=false;
  };

  return <main className="adminPage">
    <header className="adminTop">
      <div>
        <h1>{t('Admin')}</h1>
      </div>
      <button className="adminRefresh adminIconAction" type="button" onClick={load}
        aria-label={t('Refresh')} disabled={loading} title={t('Refresh')}>
        <Icon name="refresh" size={19}/>
      </button>
    </header>
    <div className="adminCompactNav">
      <nav className="tabs adminTabs" aria-label="Admin sections">
        {primarySections.map(name=><button type="button" key={name}
          className={tab===name?'active':''} aria-pressed={tab===name}
          onClick={()=>changeSection(name)}>
          {t(name.charAt(0).toUpperCase()+name.slice(1))}
          {name==='appeals'&&counts.appeals>0&&<span className="adminTabCount">{counts.appeals}</span>}
        </button>)}
      </nav>
      <details className={'adminMoreTabs'+(extraSections.includes(tab)?' adminMoreActive':'')} ref={moreTabsRef}>
        <summary aria-label={t('More')} title={t('More')}>
          {t('More')} <Icon name="chevron" size={16}/>
        </summary>
        <div className="adminMoreMenu">
          {extraSections.map(name=><button type="button" key={name}
            className={tab===name?'active':''} aria-current={tab===name?'page':undefined}
            onClick={()=>changeSection(name)}>
            {t(name.charAt(0).toUpperCase()+name.slice(1))}
          </button>)}
        </div>
      </details>
    </div>
    <ErrorBox error={error}/>
    {tab === 'dashboard' && !moderator && <DashboardPage embedded/>}
    {loading && tab !== 'dashboard' ? <p className="adminLoading">{t('Loading community data…')}</p> : <>
      {tab==='reports'&&<section className="adminStack reportWorkbench" aria-label={t('Content reports')}>
        <div className="adminSectionHeader reportWorkbenchHeading">
          <h2>{t('Reported content')}</h2>
          <label className="reportsFilter">
            <span className="srOnly">{t('Show')}</span>
            <select value={reportStatus} onChange={e=>{
              setReportStatus(e.target.value);setReportPage(1);setSelectedReportId(null);
            }}>
              <option value="open">{t('Open')}</option>
              <option value="reviewed">{t('Reviewed')}</option>
              <option value="dismissed">{t('Dismissed')}</option>
              <option value="all">{t('All')}</option>
            </select>
          </label>
        </div>
        {data.reports.length?<div className="reportWorkspace">
          <div className="reportWorkspaceList" role="group" aria-label={t('Content reports')}>
            {data.reports.map(report=><button type="button" key={report.id}
              className={'reportInboxItem'+(activeReport?.id===report.id?' selected':'')}
              aria-pressed={activeReport?.id===report.id}
              onClick={()=>{setSelectedReportId(report.id);setBanFromReport(null);}}>
              <span className="reportInboxHeading">
                <strong>@{report.reporter_login}</strong>
                {report.status==='open'&&<span className="appealInboxUnread" aria-hidden="true"/>}
              </span>
              <span className="reportInboxContent">{report.post_title||report.comment_content||t('Deleted item')}</span>
              <span className="reportInboxFoot">
                <span>{t(report.reason.replace('_',' '))}</span>
                <span>{t(report.status)}</span>
              </span>
            </button>)}
          </div>
          {activeReport&&<article className="reportWorkspaceDetail">
            <div className="reportWorkspaceTop">
              <div>
                <h3>{activeReport.post_id?t('Post report'):t('Comment report')}</h3>
                <span>{t('Reported by')} @{activeReport.reporter_login}</span>
              </div>
              <span className="reportStatus">{t(activeReport.status)}</span>
            </div>
            <div className="reportReviewSection">
              <span>{t('Reason')}</span>
              <strong>{t(activeReport.reason.replace('_',' '))}</strong>
            </div>
            <div className="reportReviewSection">
              <span>{t('Reported content')}</span>
              <p>{activeReport.post_title||activeReport.comment_content||t('Deleted item')}</p>
            </div>
            {activeReport.details&&<div className="reportReviewSection">
              <span>{t('Details')}</span><p>{activeReport.details}</p>
            </div>}
            {Boolean(activeReport.recommend_ban)&&<p className="reportRecommendation">
              <Icon name="shield" size={17}/>
              {t('Moderator recommends banning the author of this content')}
            </p>}
            <div className="reportReviewActions">
              <button type="button" onClick={()=>go('/post/'+(activeReport.post_id||activeReport.comment_post_id))}>
                <Icon name="arrow" size={17}/>{t('Open discussion')}
              </button>
              <button type="button" onClick={()=>hideReportedContent(activeReport)}>
                <Icon name="eye" size={17}/>{t('Hide reported content')}
              </button>
              {activeReport.status!=='reviewed'&&<button type="button"
                onClick={()=>run(()=>api('/reports/'+activeReport.id,{
                  method:'PATCH',token:auth.token,body:{status:'reviewed'}}))}>
                <Icon name="check" size={17}/>{t('Mark reviewed')}
              </button>}
              {activeReport.status!=='dismissed'&&<button type="button"
                onClick={()=>run(()=>api('/reports/'+activeReport.id,{
                  method:'PATCH',token:auth.token,body:{status:'dismissed'}}))}>
                {t('Dismiss')}
              </button>}
            </div>
            {!moderator&&Boolean(activeReport.post_author_id||activeReport.comment_author_id)&&
              <div className="reportBanSection">
                <button type="button" className="reportBanTrigger"
                  onClick={()=>{setBanFromReport(v=>v===activeReport.id?null:activeReport.id);
                    setReportBanReason('');setReportBanNote('');}}>
                  <Icon name="shield" size={17}/>{t('Review account restriction')}
                </button>
                {banFromReport===activeReport.id&&
                  <form className="reportBanInline" onSubmit={event=>{
                    event.preventDefault();confirmReportBan(activeReport);
                  }}>
                    <label>{t('Official reason (shown to the user)')}
                      <textarea required minLength={5} maxLength={500}
                        value={reportBanReason} onChange={e=>setReportBanReason(e.target.value)}/>
                    </label>
                    <label>{t('Private admin note (never shown to the user)')}
                      <textarea maxLength={2000}
                        value={reportBanNote} onChange={e=>setReportBanNote(e.target.value)}/>
                    </label>
                    <div className="reportBanActions">
                      <button type="button" onClick={()=>setBanFromReport(null)}>{t('Cancel')}</button>
                      <button type="submit" className="primary">{t('Confirm block')}</button>
                    </div>
                  </form>}
              </div>}
          </article>}
        </div>:<p className="adminEmpty">{t('No reports in this category.')}</p>}
        {reportPagination?.totalPages>1&&<nav className="pager" aria-label={t('Report pages')}>
          <button type="button" disabled={reportPage<=1} onClick={()=>{setReportPage(p=>p-1);setSelectedReportId(null);}}>{t('Previous')}</button>
          <span>{t('Page')} {reportPage} {t('of')} {reportPagination.totalPages}</span>
          <button type="button" disabled={reportPage>=reportPagination.totalPages} onClick={()=>{setReportPage(p=>p+1);setSelectedReportId(null);}}>{t('Next')}</button>
        </nav>}
      </section>}
      {tab === 'appeals' && !moderator && <section className="adminStack banAppeals appealWorkbench">
        <div className="adminSectionHeader appealWorkbenchHeading">
          <h2>{t('Ban appeals')}</h2>
          <span>{counts.appeals} {t('pending')}</span>
        </div>
        {appealsWarning&&<p className="adminAppealsWarning" role="alert">{t(appealsWarning)}</p>}
        {orderedAppeals.length?<div className="appealWorkspace">
          <div className="appealWorkspaceList" role="group" aria-label={t('Ban appeals')}>
            {orderedAppeals.map(item=><button key={item.id} type="button"
              className={'appealInboxItem'+(activeAppeal?.id===item.id?' selected':'')}
              aria-pressed={activeAppeal?.id===item.id}
              onClick={()=>{setSelectedAppealId(item.id);setAppealNoteOpen(false);}}>
              <span className="appealInboxHeading">
                <strong>@{item.login}</strong>
                {item.status==='pending'&&<span className="appealInboxUnread" aria-hidden="true"/>}
              </span>
              <span className="appealInboxPreview">{item.explanation}</span>
              <span className="appealInboxFoot">
                <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(language==='uk'?'uk-UA':'en-US')}</time>
                <span className={'appealInboxStatus appealStatus-'+item.status}>{t(item.status)}</span>
              </span>
            </button>)}
          </div>
          {activeAppeal&&<article className="appealWorkspaceDetail">
            <div className="appealWorkspaceTop">
              <div>
                <h3>@{activeAppeal.login}</h3>
                <time dateTime={activeAppeal.created_at}>
                  {new Date(activeAppeal.created_at).toLocaleString(language==='uk'?'uk-UA':'en-US')}
                </time>
              </div>
              <span className={'appealInboxStatus appealStatus-'+activeAppeal.status}>
                {t(activeAppeal.status)}
              </span>
            </div>
            <div className="appealReviewFact">
              <span>{t('Official reason')}</span>
              <p>{activeAppeal.ban_reason}</p>
              <small>{t('Blocked on')} · {new Date(activeAppeal.ban_started_at).toLocaleString(language==='uk'?'uk-UA':'en-US')}</small>
            </div>
            <div className="appealReviewMessage">
              <h4>{t('Your appeal')}</h4>
              <p>{activeAppeal.explanation}</p>
            </div>
            {activeAppeal.ban_internal_note&&<details className="appealPrivateDetails">
              <summary><Icon name="lock" size={15}/>{t('Private admin note')}
                <Icon name="chevron" size={15}/>
              </summary>
              <p>{activeAppeal.ban_internal_note}</p>
            </details>}
            {activeAppeal.status==='pending'
              ? <div className="appealReviewDecision">
                {appealNoteOpen?<label className="appealResponseField">
                  {t('Review note (optional)')}
                  <textarea rows="3" maxLength={1000}
                    value={appealNotes[activeAppeal.id]||''}
                    onChange={event=>setAppealNotes(value=>({
                      ...value,[activeAppeal.id]:event.target.value
                    }))}/>
                </label>:<button type="button" className="appealAddNote"
                  onClick={()=>setAppealNoteOpen(true)}>
                    <Icon name="edit" size={17}/>{t('Add response (optional)')}
                  </button>}
                <div className="appealReviewButtons">
                  <button type="button" className="appealApprove"
                    onClick={()=>decideAppeal(activeAppeal,'approved')}>
                    <Icon name="check" size={18}/>{t('Approve & unban')}
                  </button>
                  <button type="button" className="appealReject"
                    onClick={()=>decideAppeal(activeAppeal,'rejected')}>
                    {t('Reject appeal')}
                  </button>
                </div>
              </div>:<div className="appealReviewOutcome">
                <strong>{t('Decision')} · {t(activeAppeal.status)}</strong>
                {activeAppeal.review_note&&<p>{activeAppeal.review_note}</p>}
              </div>}
          </article>}
        </div>:<p className="adminEmpty">{t('No appeals yet.')}</p>}
      </section>}
      {tab === 'users' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Members')}</h2>
          <span>{data.users.length} total</span>
        </div>

        <details className="adminCreate">
          <summary><Icon name="plus" size={20}/> {t('Add member')} <Icon name="chevron" size={17}/></summary>
          <form className="adminCreateForm" onSubmit={createUser}>
            <h3>Create user</h3>
            <div className="adminFields">
              <label>Login<input required minLength="3" maxLength="50" value={newUser.login} onChange={event => setNewUser({ ...newUser, login: event.target.value })}/></label>
              <label>{t('Email')}<input type="email" required value={newUser.email} onChange={event => setNewUser({ ...newUser, email: event.target.value })}/></label>
              <label>{t('Full name')}<input maxLength="100" value={newUser.fullName} onChange={event => setNewUser({ ...newUser, fullName: event.target.value })}/></label>
              <label>{t('Role')}<select value={newUser.role} onChange={event => setNewUser({ ...newUser, role: event.target.value })}><option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option></select></label>
              <label>Password<input type="password" minLength="8" maxLength="128" required value={newUser.password} onChange={event => setNewUser({ ...newUser, password: event.target.value })}/></label>
              <label>Confirm<input type="password" minLength="8" maxLength="128" required value={newUser.passwordConfirmation} onChange={event => setNewUser({ ...newUser, passwordConfirmation: event.target.value })}/></label>
            </div>
            <div className="adminFormActions"><button type="submit" className="primary">Create user</button></div>
          </form>
        </details>
        <div className="adminSimpleList">
          {data.users.map(user => <UserRow key={user.id + '-' + user.login + '-' + user.role + '-' + user.banned_at} user={user} auth={auth} onSave={saveUser} onDelete={deleteUser} onBan={banMember} onUnban={unbanMember}/>)}
        </div>
      </section>}

      {tab === 'posts' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Posts')}</h2><span>{postsFeed.total} total</span></div>
        <div className="adminSimpleList">
          {postsFeed.records.length ? postsFeed.records.map(post => <article className="adminListItem adminRow" key={post.id}>
            <div className="adminItemLine">
              <div className="adminItemText">
                <div className="adminPostMeta"><button className="adminName" onClick={() => go('/profile/' + post.author_id)}>@{post.author_login}</button> · #{post.id} <StatusBadges item={post}/></div>
                <h3>{post.title}</h3>
                <div className="adminPostTopics">{post.categories?.map(item => <span key={item.id}>{t(item.title)}</span>)}</div>
                {!moderator&&<PostCategoryEditor post={post} categories={data.categories} auth={auth} run={run}/>}
              </div>
              <div className="adminRowTools adminPostTools">
                <button type="button" className="adminIconAction" aria-label={t('Open')} title={t('Open')} onClick={() => go('/post/' + post.id)}><Icon name="arrow" size={17}/></button>
                {(!moderator||post.author_role!=='admin')&&<>
                <button type="button" className="adminIconAction" aria-label={t(post.status === 'active' ? 'Deactivate' : 'Activate')} title={t(post.status === 'active' ? 'Deactivate' : 'Activate')} onClick={() => run(() => api('/posts/' + post.id, { method: 'PATCH', token: auth.token, body: { status: post.status === 'active' ? 'inactive' : 'active' } }))}><Icon name={post.status === 'active' ? 'lock' : 'unlock'} size={17}/></button>
                <button type="button" className="adminIconAction" aria-label={t(post.locked ? 'Unlock' : 'Lock')} title={t(post.locked ? 'Unlock' : 'Lock')} onClick={() => run(() => api('/posts/' + post.id, { method: 'PATCH', token: auth.token, body: { locked: !Boolean(post.locked) } }))}><Icon name={post.locked ? 'unlock' : 'shield'} size={17}/></button>
                <button type="button" className="adminIconAction dangerText" aria-label={t('Delete post')} title={t('Delete post')} onClick={() => { if (window.confirm('Delete this post?')) run(() => api('/posts/' + post.id, { method: 'DELETE', token: auth.token })); }}><Icon name="trash" size={17}/></button></>}
              </div>
            </div>
          </article>) : <p className="adminEmpty">{postsFeed.loading?'Loading posts…':'No posts yet.'}</p>}
        </div>
        {!postsFeed.records.length&&<ErrorBox error={postsFeed.error} onRetry={postsFeed.retry}/>}
        <InfiniteScrollEnd records={postsFeed.records} loading={postsFeed.loading}
          hasMore={postsFeed.hasMore} loadMore={postsFeed.loadMore}
          error={postsFeed.error} retry={postsFeed.retry} language={language}/>
      </section>}

      {tab === 'suggestions' && !moderator && <section className="adminStack topicSuggestionAdmin">
        <div className="adminSectionHeader"><h2>{t('Suggested topics')}</h2><span>{data.suggestions.length}</span></div>
        <div className="suggestReviewTabs" role="group" aria-label={t('Suggested topics')}>
          {['pending','approved','rejected','all'].map(status=><button type="button" key={status}
            aria-pressed={suggestionStatus===status} onClick={()=>setSuggestionStatus(status)}>
            {t(status==='pending'?'Pending':status==='approved'?'Approved':status==='rejected'?'Rejected':'All')}</button>)}
        </div>
        {data.suggestions.length?
        <div className="suggestReviewList">{data.suggestions.map(item=><article className="suggestReviewCard" key={item.id}>
          <div className="suggestReviewHead"><strong>{item.title}</strong>
            <small>{t(item.status==='pending'?'Pending':item.status==='approved'?'Approved':'Rejected')}</small></div>
          {item.description&&<p>{item.description}</p>}
          <small>@{item.suggested_by} · {new Date(item.created_at).toLocaleDateString()}</small>
          {item.status==='pending'&&<div className="suggestReviewActions">
            <button type="button" disabled={reviewBusy===item.id} className="primary"
              onClick={()=>decideSuggestion(item,'approved')}><Icon name="check" size={17}/>{t('Approve')}</button>
            <button type="button" disabled={reviewBusy===item.id}
              onClick={()=>decideSuggestion(item,'rejected')}><Icon name="close" size={17}/>{t('Reject')}</button>
          </div>}
        </article>)}</div>:<p className="adminEmpty">{t('No matching topics')}</p>}
      </section>}

      {tab === 'categories' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Topics')}</h2><span>{data.categories.length} total</span></div>
        <section className="adminCreate adminCategoryCreate">
          <div className="adminCategoryCreateHeading"><Icon name="plus" size={19}/><h3>{t('Create a new topic')}</h3></div>
          <form className="adminCreateForm" onSubmit={createCategory}>
            <div className="adminFields">
              <label>{t('Topic name')}<input required minLength="3" maxLength="100"
                value={newCategory.title} onChange={event => setNewCategory({ ...newCategory, title: event.target.value })}/></label>
              <label>{t('Topic description (optional)')}<input maxLength="500"
                value={newCategory.description} onChange={event => setNewCategory({ ...newCategory, description: event.target.value })}/></label>
            </div>
            <div className="adminFormActions"><button className="primary" type="submit">
              <Icon name="plus" size={18}/>{t('Create topic')}</button></div>
          </form>
        </section>
        <div className="topicSearchField adminTopicSearch">
          <Icon name="search" size={17}/>
          <input type="search" aria-label={t('Search topics')}
            placeholder={t('Search topics')} value={categoryQuery}
            onChange={event=>setCategoryQuery(event.target.value)}/>
          {categoryQuery&&<button type="button" onClick={()=>setCategoryQuery('')}
            aria-label={t('Clear search')} title={t('Clear search')}><Icon name="close" size={16}/></button>}
        </div>
        <div className="adminSimpleList">
          {data.categories.filter(category=>[category.title,t(category.title),category.description||'']
            .some(value=>String(value).toLocaleLowerCase().includes(categoryQuery.trim().toLocaleLowerCase())))
            .map(category => <CategoryRow key={category.id} category={category} auth={auth} run={run}/>)}
        </div>
      </section>}

      {tab === 'comments' && <section className="adminStack adminCommentsSection">
        <div className="adminSectionHeader">
          <h2>{t('Comments')}</h2><span>{data.comments.length}</span>
        </div>
        <div className="adminSimpleList">
          {data.comments.length ? data.comments.map(comment =>
            <article className="adminListItem adminRow adminCommentItem" key={comment.id}
              onContextMenu={event=>openCommentMenu(event,comment)}
              tabIndex={0}
              aria-label={t('Comment options')+' · @'+comment.author_login}
              onKeyDown={event=>{
                if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10'))
                  openCommentMenu(event,comment);
              }}>
              <div className="adminItemLine">
                <div className="adminItemText">
                  <div className="adminPostMeta">
                    <strong>@{comment.author_login}</strong> · {comment.post_title}
                    <StatusBadges item={comment}/>
                  </div>
                  <p className="adminCommentText">{comment.content}</p>
                </div>
                <button type="button" className="adminCommentMore"
                  aria-label={t('Comment options')}
                  title={t('Comment options')}
                  aria-haspopup="menu"
                  aria-expanded={commentMenu?.id===comment.id}
                  onClick={event=>openCommentMenu(event,comment)}>
                  <Icon name="more" size={20}/>
                </button>
              </div>
            </article>
          ) : <p className="adminEmpty">{t('No comments.')}</p>}
        </div>
        {commentMenu&&(()=>{
          const comment=data.comments.find(item=>item.id===commentMenu.id);
          if(!comment)return null;
          const canAct=!moderator||
            (comment.author_role!=='admin'&&comment.post_author_role!=='admin');
          return <div className="adminCommentMenu"
            role="menu" aria-label={t('Comment options')}
            ref={commentMenuRef}
            style={{left:commentMenu.x,top:commentMenu.y}}>
            <button role="menuitem" onClick={()=>commentAction(comment,'open')}>
              <Icon name="arrow" size={18}/>{t('Open discussion')}
            </button>
            {canAct&&<>
              <button role="menuitem" onClick={()=>commentAction(comment,'status')}>
                <Icon name={comment.status==='active'?'eye':'unlock'} size={18}/>
                {t(comment.status==='active'?'Hide comment':'Show comment')}
              </button>
              {!moderator&&<button role="menuitem" onClick={()=>commentAction(comment,'locked')}>
                <Icon name={comment.locked?'unlock':'lock'} size={18}/>
                {t(comment.locked?'Unlock comment':'Lock comment')}
              </button>}
              <div className="adminCommentMenuDivider" role="separator"/>
              <button role="menuitem" className="adminCommentMenuDanger"
                onClick={()=>commentAction(comment,'delete')}>
                <Icon name="trash" size={18}/>{t('Delete comment')}
              </button>
            </>}
          </div>;
        })()}
      </section>}

      {tab === 'reactions' && <section className="adminStack">
        <div className="adminSectionHeader"><h2>{t('Reactions')}</h2><span>100 latest maximum</span></div>
        <div className="adminSimpleList">
          {data.reactions.length ? data.reactions.map(item => <div className="adminListItem" key={item.id}>
            <div className="adminItemLine">
              <div className="adminItemText"><h3>@{item.author_login} <span className="adminRoleChip">{item.type}</span></h3><p>{item.post_title || 'Deleted post'}</p></div>
              <div className="adminRowTools"><button type="button" className="dangerText"
                onClick={() => { if (window.confirm('Remove this reaction?')) run(() => api('/reactions/' + item.id, { method: 'DELETE', token: auth.token })); }}>Delete</button></div>
            </div>
          </div>) : <p className="adminEmpty">No reactions.</p>}
        </div>
      </section>}
    </>}
  </main>;
}
