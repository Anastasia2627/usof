import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {createCommentForUser} from '../API/src/services/commentService.js';
import {getVisiblePost,updatePostForUser} from '../API/src/services/postService.js';

if(process.env.NODE_ENV!=='test'||! /_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Notification transaction test requires a disposable *_test or *_ci DB');
}
after(()=>pool.end());

test('comments and post edits persist notifications for author and followers',async t=>{
  const random=crypto.randomBytes(6).toString('hex');
  const users=[];
  const createUser=async marker=>{
    const [result]=await pool.execute(
      "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
      ['notitx_'+marker+random,'notitx_'+marker+random+'@example.test','unused-hash'],
    );
    const id=Number(result.insertId);
    users.push(id);
    return id;
  };
  const authorId=await createUser('a');
  const commenterId=await createUser('b');
  const followerId=await createUser('c');
  t.after(()=>pool.execute(
    'DELETE FROM users WHERE id IN (?,?,?)',users,
  ));
  const [post]=await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,?,?,'active',0)",
    [authorId,'Notification transaction','Testing atomic events'],
  );
  const postId=Number(post.insertId);
  await pool.execute(
    'INSERT INTO post_subscriptions(user_id,post_id) VALUES(?,?)',
    [followerId,postId],
  );

  const actor={sub:commenterId,role:'user',email_verified:true};
  const reply=await createCommentForUser(actor,postId,{content:'A valid comment'});
  assert.ok(reply.id);
  const [commentAlerts]=await pool.execute(
    'SELECT user_id,type,comment_id FROM notifications WHERE post_id=? ORDER BY user_id',
    [postId],
  );
  assert.deepEqual(
    commentAlerts.map(x=>[Number(x.user_id),x.type,Number(x.comment_id)])
      .sort((a,b)=>a[0]-b[0]),
    [[authorId,'comment',Number(reply.id)],[followerId,'comment',Number(reply.id)]]
      .sort((a,b)=>a[0]-b[0]),
  );

  const author={sub:authorId,role:'user',email_verified:true};
  const before=await getVisiblePost(postId,author);
  await updatePostForUser(author,postId,{
    revision:before.revision,
    title:'Notification transaction updated',
  });
  const [updateAlerts]=await pool.execute(
    "SELECT user_id FROM notifications WHERE post_id=? AND type='post_updated'",
    [postId],
  );
  assert.deepEqual(updateAlerts.map(x=>Number(x.user_id)),[followerId]);
});
