import assert from 'node:assert/strict';
import sharp from 'sharp';
import {pool} from '../API/src/config/db.js';

if(process.env.NODE_ENV!=='test'||!/(_ci|_test)$/.test(process.env.DB_NAME||'')) {
  throw new Error('Run integration tests on a disposable test database only');
}
const base='http://127.0.0.1:5000/api';
async function request(path,{token,method='GET',body,data,expected=200}={}){
  const response=await fetch(base+path,{
    method,headers:{...(token?{Authorization:'Bearer '+token}:{}),
      ...(body?{'Content-Type':'application/json'}:{})},
    body:data||(body?JSON.stringify(body):undefined),
  });
  const result=response.status===204?null:await response.json().catch(()=>({}));
  assert.equal(response.status,expected,method+' '+path+': '+JSON.stringify(result));
  return result;
}
const admin=(await request('/auth/login',{method:'POST',body:{login:'admin',password:'Password123!'}}));
const author=(await request('/auth/login',{method:'POST',body:{login:'asya',password:'Password123!'}}));
let member=(await request('/auth/login',{method:'POST',body:{login:'alex',password:'Password123!'}}));
const category=(await request('/categories')).data[0].id;
const post=(await request('/posts',{token:author.token,method:'POST',expected:201,
  body:{title:'Community features integration post',content:'Test **bold** and - list',categories:[category]}})).data;
const comment=(await request('/posts/'+post.id+'/comments',{token:member.token,method:'POST',expected:201,
  body:{content:'A useful solution'}})).data;
const chosen=(await request('/posts/'+post.id+'/solution',{token:author.token,method:'PATCH',
  body:{commentId:comment.id}})).data;
assert.equal(Number(chosen.accepted_comment_id),Number(comment.id));
await request('/posts/'+post.id+'/solution',{token:member.token,method:'PATCH',
  body:{commentId:null},expected:403});

const png=await sharp({create:{width:24,height:24,channels:3,background:'#ffffff'}}).png().toBuffer();
const form=new FormData();form.append('image',new Blob([png],{type:'image/png'}),'fixture.png');
const photo=(await request('/posts/'+post.id+'/images',{token:author.token,method:'POST',data:form,expected:201})).data;
assert.ok(photo.url.startsWith('/uploads/posts/'));
assert.equal((await request('/posts/'+post.id)).data.images.length,1);
const imageResponse=await fetch('http://127.0.0.1:5000'+photo.url);
assert.equal(imageResponse.status,200);
assert.ok((imageResponse.headers.get('content-type')||'').includes('image/webp'));
await request('/posts/'+post.id+'/images/'+photo.id,{token:member.token,method:'DELETE',expected:403});
await request('/posts/'+post.id+'/images/'+photo.id,{token:author.token,method:'DELETE',expected:204});
assert.equal((await request('/posts/'+post.id)).data.images.length,0);

await request('/posts/'+post.id+'/report',{token:author.token,method:'POST',
  expected:422,body:{reason:'spam'}});
const report=(await request('/posts/'+post.id+'/report',{token:member.token,method:'POST',
  expected:201,body:{reason:'off_topic',details:'Check topic match'}})).data;
await request('/posts/'+post.id+'/report',{token:member.token,method:'POST',
  expected:409,body:{reason:'off_topic'}});
await request('/reports',{token:member.token,expected:403});
const reports=await request('/reports',{token:admin.token});
assert.ok(reports.data.some(item=>Number(item.id)===Number(report.id)));
await request('/reports/'+report.id,{token:admin.token,method:'PATCH',body:{status:'reviewed'}});

// Only an administrator grants or revokes moderator roles.
await request('/users/'+member.user.id,{token:admin.token,method:'PATCH',
  body:{role:'moderator'}});
member=await request('/auth/login',{method:'POST',body:{login:'alex',password:'Password123!'}});
assert.equal(member.user.role,'moderator');
await request('/users',{token:member.token,expected:403});
await request('/categories',{token:member.token,method:'POST',body:{title:'Unauthorized topic'},expected:403});
await request('/users/'+author.user.id,{token:member.token,method:'PATCH',
  body:{role:'admin'},expected:403});
await request('/reports',{token:member.token});
await request('/posts/'+post.id,{token:member.token,method:'PATCH',
  body:{status:'inactive'}});
await request('/posts/'+post.id,{token:member.token,method:'PATCH',
  body:{categories:[category]},expected:403});
const [seed]=await pool.query(
  "SELECT (SELECT COUNT(*) FROM user_follows) AS follows,(SELECT COUNT(*) FROM user_interests) AS interests, (SELECT COUNT(*) FROM direct_messages) AS messages, (SELECT COUNT(*) FROM post_images) AS images, (SELECT COUNT(*) FROM content_reports) AS reports"
);
assert.ok(seed[0].follows>=5 && seed[0].interests>=5 && seed[0].messages>=5 && seed[0].images>=5 && seed[0].reports>=5);
await pool.end();
console.log('Community integration passed: solutions, images, reporting, roles and seed data.');
