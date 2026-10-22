import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {setReaction} from '../API/src/services/reactionService.js';

if(process.env.NODE_ENV!=='test'||! /_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Reaction notification tests require a disposable *_test or *_ci database');
}
after(()=>pool.end());

test('a positive reaction and notification are committed together, without repeat alerts',async t=>{
  const suffix=crypto.randomBytes(6).toString('hex');
  const ids=[];
  for(const marker of ['author','reader']){
    const [result]=await pool.execute(
      "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
      ['reactnotify_'+marker+suffix,'reactnotify_'+marker+suffix+'@example.test','unused-hash'],
    );
    ids.push(Number(result.insertId));
  }
  t.after(()=>pool.execute('DELETE FROM users WHERE id IN (?,?)',ids));
  const [post]=await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,?,?,'active',0)",
    [ids[0],'Reaction alerts','Positive reactions should have a matching notification'],
  );
  const postId=Number(post.insertId);

  const first=await setReaction({userId:ids[1],postId,type:'like'});
  const repeat=await setReaction({userId:ids[1],postId,type:'like'});
  assert.equal(first.changed,true);
  assert.equal(repeat.changed,false);

  const [rows]=await pool.execute(
    "SELECT user_id,actor_id,type FROM notifications WHERE post_id=? AND type='reaction'",
    [postId],
  );
  assert.equal(rows.length,1);
  assert.equal(Number(rows[0].user_id),ids[0]);
  assert.equal(Number(rows[0].actor_id),ids[1]);

  // Dislikes do not generate positive alerts
  await setReaction({userId:ids[1],postId,type:'dislike'});
  const [afterDislike]=await pool.execute(
    "SELECT id FROM notifications WHERE post_id=? AND type='reaction'",
    [postId],
  );
  assert.equal(afterDislike.length,1);
});
