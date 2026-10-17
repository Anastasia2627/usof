import assert from 'node:assert/strict';
import {pool} from '../API/src/config/db.js';
if(process.env.NODE_ENV!=='test'||!/_ci$|_test$/.test(process.env.DB_NAME||''))throw Error('Disposable test DB required');
const url=process.env.API_BASE_URL||'http://127.0.0.1:5000/api';
async function req(path,{token,method='GET',body,expected=200}={}){
  const res=await fetch(url+path,{method,headers:{
    ...(token?{Authorization:'Bearer '+token}:{}),
    ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});
  const data=res.status===204?null:await res.json();
  assert.equal(res.status,expected,method+' '+path+' expected '+expected+', got '+res.status+' '+JSON.stringify(data));
  return data;
}
try{
const admin=(await req('/auth/login',{method:'POST',body:{login:'admin',password:'Password123!'}}));
const member=(await req('/auth/login',{method:'POST',body:{login:'asya',password:'Password123!'}}));
const moderator=(await req('/auth/login',{method:'POST',body:{login:'alex',password:'Password123!'}}));
const title='Gardening Guild '+Date.now();
const suggested=(await req('/categories/suggestions',{token:member.token,method:'POST',expected:201,
  body:{title,description:'A welcoming space for growing plants'}})).data;
assert.equal(suggested.status,'pending');
assert.equal((await req('/categories')).data.some(c=>c.title===title),false,
  'Unapproved suggestions must never appear as public categories');
assert.ok((await req('/categories/suggestions/mine',{token:member.token})).data.some(x=>Number(x.id)===Number(suggested.id)));
await req('/categories/suggestions',{expected:401,method:'POST',body:{title:'No auth'}});
await req('/categories/suggestions',{token:member.token,method:'POST',body:{title},expected:409});
await req('/categories/suggestions',{token:member.token,method:'POST',expected:422,body:{title:'A'}});
await req('/categories/suggestions',{token:member.token,expected:403});
await req('/categories/suggestions/'+suggested.id,{token:member.token,method:'PATCH',expected:403,body:{status:'approved'}});
const adminNotices=await req('/notifications',{token:admin.token});
assert.ok(adminNotices.data.some(n=>n.type==='category_suggestion'&&n.body.includes(title)),
  'Administrators must get a notification of every new proposal');
const pending=await req('/categories/suggestions?status=pending',{token:admin.token});
assert.ok(pending.data.some(x=>Number(x.id)===Number(suggested.id)));
const accepted=(await req('/categories/suggestions/'+suggested.id,{token:admin.token,method:'PATCH',body:{status:'approved'}})).data;
assert.equal(accepted.status,'approved');
assert.ok((await req('/categories')).data.some(c=>c.title===title),'Approving must publish category');
await req('/categories/suggestions/'+suggested.id,{token:admin.token,method:'PATCH',expected:409,body:{status:'approved'}});
assert.ok((await req('/notifications',{token:member.token})).data.some(n=>n.type==='category_decision'&&n.body===title));
const secondTitle='Night Sketchers '+Date.now();
const another=(await req('/categories/suggestions',{token:member.token,method:'POST',expected:201,
  body:{title:secondTitle,description:'Creative meetups'}})).data;
const rejected=(await req('/categories/suggestions/'+another.id,{token:admin.token,method:'PATCH',
  body:{status:'rejected'}})).data;
assert.equal(rejected.status,'rejected');
assert.equal((await req('/categories')).data.some(c=>c.title===secondTitle),false);
const [[stored]]=await pool.execute('SELECT status,category_id FROM category_suggestions WHERE id=?',[suggested.id]);
assert.equal(stored.status,'approved');
assert.ok(stored.category_id,'Approved suggestion must link to the newly created category');
await req('/categories/'+stored.category_id,{token:admin.token,method:'DELETE',expected:204});
console.log('Topic proposal/review and admin/member notifications passed');
}finally{await pool.end();}
