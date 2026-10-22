import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {Reaction} from '../API/src/models/Reaction.js';

if(process.env.NODE_ENV!=='test'||! /_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Run reactions pagination tests only on a disposable *_test or *_ci database');
}
after(()=>pool.end());

test('an admin can paginate beyond 20 recent reactions without losing older votes',async t=>{
  const suffix=crypto.randomBytes(6).toString('hex');
  const [newUser]=await pool.execute(
    "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
    ['pagevotes_'+suffix,'pagevotes_'+suffix+'@example.test','unused-hash'],
  );
  const userId=Number(newUser.insertId);
  t.after(async()=>{await pool.execute('DELETE FROM users WHERE id=?',[userId]);});

  const before=await Reaction.countAdmin({actor:{role:'admin'}});
  const postIds=[];
  for(let i=0;i<23;i++){
    const [post]=await pool.execute(
      "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,?,?,'active',0)",
      [userId,'Paging '+suffix+' '+i,'Sample for reaction moderation'],
    );
    postIds.push(Number(post.insertId));
  }
  const reactionValues=postIds.map(id=>[userId,id,'like']);
  await pool.query(
    'INSERT INTO reactions(author_id,post_id,type) VALUES '+
      reactionValues.map(()=>'(?,?,?)').join(','),
    reactionValues.flat(),
  );

  const total=await Reaction.countAdmin({actor:{role:'admin'}});
  assert.equal(total,before+23);
  const first=await Reaction.listAdmin({actor:{role:'admin'},limit:20,offset:0});
  const next=await Reaction.listAdmin({actor:{role:'admin'},limit:20,offset:20});
  assert.equal(first.length,20);
  assert.ok(next.length>=3);
  const combined=[...first,...next];
  assert.equal(new Set(combined.map(r=>Number(r.id))).size,combined.length);
  assert.equal(combined.filter(r=>Number(r.author_id)===userId).length,23,
    'All 23 newly created reactions should be accessible across pages');
});
