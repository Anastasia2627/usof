import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {
  createCommentForUser,
  updateCommentForUser,
  deleteCommentForUser,
} from '../API/src/services/commentService.js';

if(process.env.NODE_ENV!=='test'|| !/_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Run comment permission tests only with a disposable *_test or *_ci database');
}
after(()=>pool.end());

test('comment mutations obey fresh locks and do not modify protected content',async t=>{
  const suffix=crypto.randomBytes(6).toString('hex');
  const [createdUser]=await pool.execute(
    "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
    ['locktest_'+suffix,'locktest_'+suffix+'@example.test','unused-test-password-hash'],
  );
  const userId=Number(createdUser.insertId);
  t.after(async()=>{await pool.execute('DELETE FROM users WHERE id=?',[userId]);});
  const actor={sub:userId,role:'user',email_verified:true};
  const [createdPost]=await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,? ,?,'active',0)",
    [userId,'Comment lock test','This post exercises moderation transaction locks'],
  );
  const postId=Number(createdPost.insertId);
  const [createdComment]=await pool.execute(
    "INSERT INTO comments(post_id,author_id,content,status,locked) VALUES(?,?,?,'active',0)",
    [postId,userId,'Original comment'],
  );
  const commentId=Number(createdComment.insertId);
  const [createdParent]=await pool.execute(
    "INSERT INTO comments(post_id,author_id,content,status,locked) VALUES(?,?,?,'active',1)",
    [postId,userId,'Locked parent comment'],
  );
  const parentId=Number(createdParent.insertId);

  await pool.execute('UPDATE comments SET locked=1 WHERE id=?',[commentId]);
  await assert.rejects(
    updateCommentForUser(actor,commentId,{status:'inactive'}),
    {code:'COMMENT_LOCKED'},
  );
  await assert.rejects(deleteCommentForUser(actor,commentId),{code:'COMMENT_LOCKED'});
  const [[unchanged]]=await pool.execute('SELECT status,locked FROM comments WHERE id=?',[commentId]);
  assert.equal(unchanged.status,'active');
  assert.equal(Number(unchanged.locked),1);

  await assert.rejects(
    createCommentForUser(actor,postId,{content:'Reply to locked parent',parentCommentId:parentId}),
    {code:'COMMENT_LOCKED'},
  );

  await pool.execute('UPDATE posts SET closed=1 WHERE id=?',[postId]);
  await assert.rejects(
    createCommentForUser(actor,postId,{content:'Not allowed on a closed discussion'}),
    {code:'POST_CLOSED'},
  );
  await pool.execute('UPDATE posts SET closed=0,locked=1 WHERE id=?',[postId]);
  await assert.rejects(
    createCommentForUser(actor,postId,{content:'Not allowed on locked post'}),
    {code:'POST_LOCKED'},
  );

  await pool.execute('UPDATE posts SET locked=0 WHERE id=?',[postId]);
  await pool.execute('UPDATE comments SET locked=0 WHERE id=?',[commentId]);
  await updateCommentForUser(actor,commentId,{status:'inactive'});
  const [[hidden]]=await pool.execute('SELECT status FROM comments WHERE id=?',[commentId]);
  assert.equal(hidden.status,'inactive');
  await updateCommentForUser({sub:userId,role:'admin',email_verified:true},
    commentId,{locked:true});
  const [[final]]=await pool.execute('SELECT status,locked FROM comments WHERE id=?',[commentId]);
  assert.equal(final.status,'inactive');
  assert.equal(Number(final.locked),1);
});
