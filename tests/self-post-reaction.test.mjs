import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {setReaction,deleteReaction} from '../API/src/services/reactionService.js';

if(process.env.NODE_ENV!=='test'||! /_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Run this test only with a disposable *_test or *_ci database');
}
after(()=>pool.end());

test('authors can react to their own post but not to their own comments',async t=>{
  const suffix=crypto.randomBytes(6).toString('hex');
  const [userResult]=await pool.execute(
    "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
    ['selflike_'+suffix,'selflike_'+suffix+'@example.test','unused-test-password-hash'],
  );
  const id=Number(userResult.insertId);
  t.after(()=>pool.execute('DELETE FROM users WHERE id=?',[id]));

  const [postResult]=await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,? ,?,'active',0)",
    [id,'Self reaction test','The post author may add a reaction'],
  );
  const postId=Number(postResult.insertId);
  const first=await setReaction({userId:id,postId,type:'like'});
  assert.equal(first.changed,true);
  const same=await setReaction({userId:id,postId,type:'like'});
  assert.equal(same.changed,false);
  const [[likeCount]]=await pool.execute(
    "SELECT COUNT(*) AS total FROM reactions WHERE post_id=? AND author_id=?",
    [postId,id],
  );
  assert.equal(Number(likeCount.total),1);

  const [commentResult]=await pool.execute(
    "INSERT INTO comments(post_id,author_id,content,status,locked) VALUES(?,?,?,'active',0)",
    [postId,id,'Own reply'],
  );
  await assert.rejects(
    setReaction({userId:id,commentId:Number(commentResult.insertId),type:'like'}),
    {code:'SELF_REACTION_NOT_ALLOWED'},
  );
  await deleteReaction({userId:id,postId});
});
