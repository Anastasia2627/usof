import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {
  getVisiblePost,
  updatePostForUser,
} from '../API/src/services/postService.js';

if(process.env.NODE_ENV!=='test'||! /_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Run post-edit tests only against a disposable *_test or *_ci database');
}
after(()=>pool.end());

test('stale editor state cannot overwrite another saved post revision',async t=>{
  const idSuffix=crypto.randomBytes(6).toString('hex');
  const [created]=await pool.execute(
    "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
    ['postedit_'+idSuffix,'postedit_'+idSuffix+'@example.test','unused-test-hash'],
  );
  const userId=Number(created.insertId);
  t.after(()=>pool.execute('DELETE FROM users WHERE id=?',[userId]));
  const [post]=await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,? ,?,'active',0)",
    [userId,'Post before edits','Original content'],
  );
  const postId=Number(post.insertId),actor={sub:userId,role:'user',email_verified:true};
  const first=await getVisiblePost(postId,actor);
  assert.match(first.revision,/^[0-9a-f]{64}$/);
  const saved=await updatePostForUser(actor,postId,{
    revision:first.revision,title:'The first edit',
  });
  assert.notEqual(saved.revision,first.revision);
  await assert.rejects(
    updatePostForUser(actor,postId,{
      revision:first.revision,content:'Stale content that must never save',
    }),
    {code:'POST_EDIT_CONFLICT'},
  );
  const current=await getVisiblePost(postId,actor);
  assert.equal(current.title,'The first edit');
  assert.equal(current.content,'Original content');

  // Updating only content must never replay stale title or change categories
  const final=await updatePostForUser(actor,postId,{
    revision:current.revision,content:'Second edit',
  });
  assert.equal(final.title,'The first edit');
  assert.equal(final.content,'Second edit');
});

test('concurrent submissions with one post revision accept at most one',async t=>{
  const suffix=crypto.randomBytes(6).toString('hex');
  const [user]=await pool.execute(
    "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
    ['postrace_'+suffix,'postrace_'+suffix+'@example.test','unused-test-hash'],
  );
  const userId=Number(user.insertId);
  t.after(()=>pool.execute('DELETE FROM users WHERE id=?',[userId]));
  const [post]=await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,? ,?,'active',0)",
    [userId,'Initial race title','Initial race body'],
  );
  const actor={sub:userId,role:'user',email_verified:true};
  const state=await getVisiblePost(post.insertId,actor);
  const results=await Promise.allSettled([
    updatePostForUser(actor,post.insertId,{revision:state.revision,title:'Winner A'}),
    updatePostForUser(actor,post.insertId,{revision:state.revision,title:'Winner B'}),
  ]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected'&&x.reason?.code==='POST_EDIT_CONFLICT').length,1);
});
