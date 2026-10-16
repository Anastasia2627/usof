import assert from 'node:assert/strict';

if (process.env.NODE_ENV !== 'test' || !/(_ci|_test)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Use only a disposable MySQL database');
}

const root = process.env.API_BASE_URL || 'http://127.0.0.1:5000/api';
async function call(path, { method='GET', token, body, status=200 } = {}) {
  const res = await fetch(root+path, {
    method,
    headers: {
      ...(token ? {Authorization:'Bearer '+token} : {}),
      ...(body ? {'Content-Type':'application/json'} : {}),
    },
    ...(body ? {body:JSON.stringify(body)} : {}),
  });
  const obj = res.status === 204 ? null : await res.json();
  assert.equal(res.status, status, path+' expected '+status+' got '+res.status+' / '+JSON.stringify(obj));
  return obj;
}

const topic = (await call('/categories')).data[0];
const users = (await call('/search?q=admin')).data.users;
assert.ok(users.some(x => x.login === 'admin'), 'Search must find people');
assert.ok(users.every(x => !('email' in x)), 'Search must not expose emails');
const topics = (await call('/search?q='+encodeURIComponent(topic.title))).data.categories;
assert.ok(topics.some(x => x.id === topic.id), 'Search must find categories');
const found = await call('/search?q='+encodeURIComponent(topic.title));
assert.ok(Array.isArray(found.data.posts), 'Search must return actual posts');
await call('/search?q=', {status:422});

const person = users.find(x => x.login === 'admin');
const publicProfile = (await call('/users/'+person.id)).data;
assert.equal(publicProfile.login, 'admin');
assert.equal(publicProfile.email, undefined);
const guestPosts = await call('/users/'+person.id+'/posts');
assert.ok(Array.isArray(guestPosts.data));
assert.ok(guestPosts.data.every(p => p.status === 'active'));

const admin = await call('/auth/login', {
  method:'POST', body:{login:'admin',password:'Password123!'},
});
const member = await call('/auth/login', {
  method:'POST', body:{login:'asya',password:'Password123!'},
});
const adminToken=admin.token, memberToken=member.token;
assert.ok(adminToken && memberToken);
await call('/reactions', {status:401});
await call('/reactions', {token:memberToken,status:403});

const created = await call('/posts', {
  method:'POST',token:memberToken,status:201,
  body:{title:'Extended API check '+Date.now(), content:'Testing search, replies and moderation.',categories:[topic.id]},
});
const postId=created.data.id;
const comment=await call('/posts/'+postId+'/comments',{
  method:'POST',token:memberToken,status:201,body:{content:'Primary comment'},
});
const reply=await call('/comments/'+comment.data.id+'/replies',{
  method:'POST',token:adminToken,status:201,body:{content:'Admin nested reply'},
});
assert.equal(reply.data.parent_comment_id, comment.data.id);
assert.equal(reply.data.post_id, postId);
const replies = (await call('/posts/'+postId+'/comments')).data;
assert.ok(replies.some(x => x.id === reply.data.id));

await call('/posts/'+postId+'/like',{method:'POST',token:adminToken,body:{type:'like'}});
const reactions=(await call('/reactions',{token:adminToken})).data;
const added=reactions.find(x => Number(x.post_id) === Number(postId) && Number(x.author_id) === Number(admin.user.id));
assert.ok(added, 'Admin reaction overview must show post votes');
await call('/reactions/'+added.id,{method:'DELETE',token:memberToken,status:403});
await call('/reactions/'+added.id,{method:'DELETE',token:adminToken,status:204});
const finalPost=(await call('/posts/'+postId)).data;
assert.equal(Number(finalPost.like_count),0,'Removing a reaction must update counts');
const comments = (await call('/posts/'+postId+'/comments')).data;
assert.ok(comments.some(x=>x.id===comment.data.id));
const userName = 'editmail' + Date.now().toString(36);
const originalEmail = userName + '@example.test';
const changedEmail = userName + '+new@example.test';
const managed = await call('/users', {
  method:'POST',token:adminToken,status:201,
  body:{ login:userName,email:originalEmail,fullName:'Managed User',role:'user',
    password:'Password123!',passwordConfirmation:'Password123!' },
});
const edited = await call('/users/'+managed.data.id, {
  method:'PATCH',token:adminToken,body:{ email:changedEmail },
});
assert.equal(edited.data.email_verified, 0);
assert.equal(edited.emailDelivery, 'sent');
assert.match(edited.verificationCode, /^\\d{6}$/);
await call('/auth/verify-email-code', {
  method:'POST',body:{email:changedEmail,code:edited.verificationCode},
});
const afterLogin = await call('/auth/login', {
  method:'POST',body:{email:changedEmail,password:'Password123!'},
});
assert.ok(afterLogin.token);
console.log('Extended search, profiles, replies, reaction moderation, and real changed-email confirmation passed.');
