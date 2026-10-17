import assert from 'node:assert/strict';

if (process.env.NODE_ENV !== 'test' || !/_(test|ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Moderator security tests require a disposable *_ci or *_test database.');
}

const base=process.env.API_BASE_URL||'http://127.0.0.1:5000/api';
const password=process.env.TEST_ACCOUNT_PASSWORD||'Password123!';
async function request(path,{token,method='GET',body,expected=200}={}) {
  const response=await fetch(base+path,{
    method,headers:{...(token?{Authorization:'Bearer '+token}:{}),
      ...(body!==undefined?{'Content-Type':'application/json'}:{})},
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  });
  const data=response.status===204?null:await response.json();
  assert.equal(response.status,expected,
    method+' '+path+' expected '+expected+' got '+response.status+' '+JSON.stringify(data));
  return data;
}

const admin=await request('/auth/login',{method:'POST',body:{login:'admin',password}});
const member=await request('/auth/login',{method:'POST',body:{login:'asya',password}});
const name='modguard'+Date.now().toString(36);
const created=(await request('/users',{token:admin.token,method:'POST',expected:201,body:{
  login:name,email:name+'@example.test',fullName:'Moderation Security Test',
  role:'user',password,passwordConfirmation:password,
}})).data;
const signedIn=await request('/auth/login',{method:'POST',body:{login:name,password}});
const moderator=signedIn.token;

await request('/users/'+created.id,{token:moderator,method:'PATCH',expected:403,body:{role:'moderator'}});
await request('/users/'+created.id,{token:admin.token,method:'PATCH',body:{role:'moderator'}});
const activeSession=await request('/reports',{token:moderator});
assert.ok(Array.isArray(activeSession.data),'promotion must work in an already-open session');
const promoted=await request('/notifications?unread=1',{token:moderator});
assert.ok(promoted.data.some(row=>row.type==='role_changed'&&row.title.includes('moderator')));

const category=(await request('/categories')).data[0].id;
const ownPost=(await request('/posts',{token:moderator,method:'POST',expected:201,
  body:{title:'My own moderator hobby post',content:'I should be able to edit this.',
    categories:[category]}})).data;
const editedOwn=(await request('/posts/'+ownPost.id,{token:moderator,method:'PATCH',
  body:{title:'My edited moderator hobby post',content:'I updated my own hobby.',
    hideLikes:true,categories:[category]}})).data;
assert.equal(editedOwn.title,'My edited moderator hobby post');
assert.equal(editedOwn.hide_likes,1);

const publicPost=(await request('/posts',{token:member.token,method:'POST',expected:201,
  body:{title:'Moderator security public discussion',content:'A regular published post.',
    categories:[category]}})).data;
const adminPost=(await request('/posts',{token:admin.token,method:'POST',expected:201,
  body:{title:'Administrator discussion is protected',content:'Admin text.',
    categories:[category]}})).data;

await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{title:'Tamper with somebody else'},expected:403});
await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{hideLikes:true},expected:403});
await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{categories:[category]},expected:403});
await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{locked:'false'},expected:422});
await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{locked:true}});
await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{locked:false}});
await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{status:'inactive'}});
await request('/posts/'+publicPost.id,{token:moderator,method:'PATCH',
  body:{status:'active'}});

await request('/posts/'+adminPost.id,{token:moderator,method:'PATCH',
  body:{status:'inactive'},expected:403});
await request('/posts/'+adminPost.id,{token:moderator,method:'PATCH',
  body:{locked:true},expected:403});
await request('/posts/'+adminPost.id,{token:moderator,method:'DELETE',expected:403});
await request('/posts/'+adminPost.id,{token:admin.token});

const adminComment=(await request('/posts/'+publicPost.id+'/comments',{
  token:admin.token,method:'POST',expected:201,body:{content:'Administrator reply protected'},
})).data;
await request('/comments/'+adminComment.id,{token:moderator,method:'PATCH',
  body:{status:'inactive'},expected:403});
await request('/comments/'+adminComment.id,{token:moderator,method:'PATCH',
  body:{locked:true},expected:403});
await request('/comments/'+adminComment.id+'/review',{token:moderator,
  method:'PATCH',body:{reviewed:true},expected:403});
await request('/comments/'+adminComment.id,{token:moderator,method:'DELETE',expected:403});
const memberOnAdmin=(await request('/posts/'+adminPost.id+'/comments',{
  token:member.token,method:'POST',expected:201,body:{content:'Reply on admin thread'},
})).data;
await request('/comments/'+memberOnAdmin.id,{token:moderator,method:'DELETE',expected:403});

await request('/posts/'+publicPost.id+'/like',{token:admin.token,method:'POST',body:{type:'like'}});
const adminReaction=(await request('/reactions',{token:moderator})).data
  .find(row=>Number(row.post_id)===Number(publicPost.id) &&
    Number(row.author_id)===Number(admin.user.id));
assert.ok(adminReaction,'Admin vote must be present for privilege test');
await request('/reactions/'+adminReaction.id,{token:moderator,method:'DELETE',expected:403});
await request('/posts/'+publicPost.id+'/like?all=1',{token:moderator,method:'DELETE',expected:403});
await request('/posts/'+adminPost.id+'/like',{token:member.token,method:'POST',
  body:{type:'like'}});
await request('/posts/'+adminPost.id+'/like?all=1',{token:moderator,
  method:'DELETE',expected:403});

const scheduledTitle='Private future post '+Date.now().toString(36);
const scheduled=(await request('/posts',{token:member.token,method:'POST',expected:201,
  body:{title:scheduledTitle,content:'Not released yet',categories:[category],
    publishAt:new Date(Date.now()+3600000).toISOString()}})).data;
await request('/posts/'+scheduled.id,{token:moderator,expected:404});
await request('/posts/'+scheduled.id,{token:admin.token});
await request('/posts/'+scheduled.id,{token:member.token});
const modFeed=await request('/posts?search='+encodeURIComponent(scheduledTitle),{token:moderator});
assert.ok(!modFeed.data.some(post=>Number(post.id)===Number(scheduled.id)));
const modSearch=await request('/search?q='+encodeURIComponent(scheduledTitle),{token:moderator});
assert.ok(!modSearch.data.posts.some(post=>Number(post.id)===Number(scheduled.id)));
await request('/users/'+member.user.id,{token:moderator,method:'PATCH',
  body:{role:'admin'},expected:403});
await request('/categories',{token:moderator,method:'POST',expected:403,
  body:{title:'Unauthorized category'}});
await request('/dashboard/admin',{token:moderator,expected:403});
await request('/users/'+admin.user.id,{token:moderator,method:'DELETE',expected:403});

const report=(await request('/posts/'+publicPost.id+'/report',{
  token:moderator,method:'POST',body:{reason:'off_topic'},expected:201,
})).data;
await request('/reports/'+report.id,{token:moderator,method:'PATCH',
  body:{status:'reviewed'}});

await request('/users/'+created.id,{token:admin.token,method:'PATCH',body:{role:'user'}});
await request('/reports',{token:moderator,expected:403});
await request('/reactions',{token:moderator,expected:403});
await request('/posts/'+publicPost.id,{token:moderator,method:'DELETE',expected:403});
const demoted=await request('/notifications',{token:moderator});
assert.ok(demoted.data.some(row=>row.type==='role_changed'&&row.title.includes('removed')));
console.log('Moderator security passed: own content, role changes, scoped moderation, admin protection, private scheduled posts, and notifications.');
