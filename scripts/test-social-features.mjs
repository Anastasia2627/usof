import assert from 'node:assert/strict';

if (process.env.NODE_ENV !== 'test' || !/(_ci|_test)$/.test(process.env.DB_NAME || ''))
  throw new Error('Only run social integration tests with a disposable MySQL database');

const root=process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';
async function request(path,{method='GET',token,body,status=200}={}){
  const response=await fetch(root+path,{method,headers:{
    ...(token?{Authorization:'Bearer '+token}:{}),
    ...(body!==undefined?{'Content-Type':'application/json'}:{})
  },...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=response.status===204?null:await response.json();
  assert.equal(response.status,status,method+' '+path+' expected '+status+' got '+response.status+' '+JSON.stringify(data));
  return data;
}
const admin=(await request('/auth/login',{method:'POST',body:{login:'admin',password:'Password123!'}})).token;
const member=(await request('/auth/login',{method:'POST',body:{login:'asya',password:'Password123!'}})).token;
const suffix=Date.now().toString(36);
const managed=(await request('/users',{method:'POST',token:admin,status:201,body:{
  login:'social'+suffix,email:'social'+suffix+'@example.test',fullName:'Social Test User',
  role:'user',password:'Password123!',passwordConfirmation:'Password123!'
}})).data;
await request('/users/'+managed.id,{method:'PATCH',token:member,body:{role:'moderator'},status:403});
await request('/users/'+managed.id,{method:'PATCH',token:admin,body:{role:'moderator'}});
const moderatorLogin=await request('/auth/login',{method:'POST',body:{login:managed.login,password:'Password123!'}});
assert.equal(moderatorLogin.user.role,'moderator');
const mod=moderatorLogin.token;
await request('/users',{token:mod,status:403});
await request('/comments',{token:mod});
await request('/reactions',{token:mod});
const topics=(await request('/categories')).data;
assert.ok(topics.length>=30,'Diverse community topics should exist after safe migration');
const ids=topics.slice(0,3).map(x=>Number(x.id));
await request('/social/interests',{method:'PUT',token:member,body:{categories:ids}});
assert.deepEqual((await request('/social/interests',{token:member})).data,ids.slice().sort((a,b)=>a-b));
await request('/social/follows/'+managed.id,{method:'POST',token:member});
assert.equal((await request('/social/follows/'+managed.id,{token:member})).data.following,true);
assert.ok((await request('/social/following',{token:member})).data.some(u=>Number(u.id)===Number(managed.id)));
await request('/social/follows/'+managed.id,{method:'DELETE',token:member,status:204});
assert.equal((await request('/social/follows/'+managed.id,{token:member})).data.following,false);
const message=(await request('/social/messages/'+managed.id,{method:'POST',token:member,status:201,body:{content:'Private test '+suffix}})).data;
const thread=(await request('/social/messages/'+managed.id,{token:member})).data;
assert.ok(thread.messages.some(m=>Number(m.id)===Number(message.id)));
assert.ok((await request('/social/conversations',{token:mod})).data.some(c=>c.login==='asya'));
await request('/social/messages/'+managed.id,{method:'POST',token:member,body:{content:''},status:422});
const when=new Date(Date.now()+3600*1000).toISOString();
const scheduled=(await request('/posts',{method:'POST',token:member,status:201,body:{
  title:'Scheduled '+suffix,content:'Scheduled social post',categories:[ids[0]],publishAt:when
}})).data;
await request('/posts/'+scheduled.id,{status:404});
await request('/posts/'+scheduled.id,{token:mod});
await request('/posts/'+scheduled.id+'/comments',{method:'POST',token:member,status:423,body:{content:'Not yet'}});
const publicFeed=(await request('/posts?sort=date&limit=50')).data;
assert.ok(!publicFeed.some(p=>p.id===scheduled.id),'Scheduled posts must never leak into guest feed');
const posted=(await request('/posts',{method:'POST',token:member,status:201,body:{
  title:'Community '+suffix,content:'Social moderation test',categories:[ids[0]],hideLikes:true
}})).data;
await request('/posts/'+posted.id+'/like',{method:'POST',token:mod,body:{type:'like'}});
const concealed=(await request('/posts/'+posted.id)).data;
assert.equal(concealed.like_count,null);
assert.equal(concealed.score,null);
assert.equal((await request('/posts/'+posted.id+'/like')).data.length,0,'Hidden votes cannot be listed by strangers');
assert.equal((await request('/posts/'+posted.id,{token:member})).data.like_count,1);
const baseComment=(await request('/posts/'+posted.id+'/comments',{method:'POST',token:mod,status:201,body:{content:'Reviewed candidate'}})).data;
await request('/comments/'+baseComment.id+'/review',{method:'PATCH',token:member,status:403,body:{reviewed:true}});
const reviewed=(await request('/comments/'+baseComment.id+'/review',{method:'PATCH',token:mod,body:{reviewed:true}})).data;
assert.equal(Number(reviewed.reviewed_by),Number(managed.id));
await request('/posts/'+posted.id,{method:'PATCH',token:member,body:{closed:true}});
await request('/posts/'+posted.id+'/comments',{method:'POST',token:mod,status:423,body:{content:'Closed reply'}});
await request('/posts/'+posted.id,{method:'PATCH',token:member,body:{closed:false}});
await request('/posts/'+posted.id+'/comments',{method:'POST',token:mod,status:201,body:{content:'Reopened'}});
await request('/posts/'+posted.id,{method:'PATCH',token:mod,body:{title:'Must not edit'},status:403});
await request('/posts/'+posted.id,{method:'PATCH',token:mod,body:{locked:true}});
await request('/posts/'+posted.id,{method:'PATCH',token:mod,body:{locked:false}});
await request('/posts/'+posted.id,{method:'DELETE',token:mod,status:204});
console.log('Social integrations passed: moderator permissions, verified comments, closing, hidden likes, scheduling, follows, DMs, interest topics');
