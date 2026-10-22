import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {updateAccount} from '../API/src/services/accountService.js';
import {getVisiblePost,updatePostForUser} from '../API/src/services/postService.js';
import {signAuthToken} from '../API/src/middleware/auth.js';
import jwt from 'jsonwebtoken';

if(process.env.NODE_ENV!=='test'||! /_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Coursework integration tests require a disposable *_test or *_ci database');
}
after(()=>pool.end());

async function fixture(t){
  const unique=crypto.randomBytes(6).toString('hex');
  const initial='InitialPassword-123!';
  const idByRole={};
  for(const kind of ['owner','other','admin']){
    const [r]=await pool.execute(
      'INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,?)',
      ['core_'+kind+'_'+unique,'core_'+kind+'_'+unique+'@example.test',
        await bcrypt.hash(initial,4),kind==='admin'?'admin':'user'],
    );
    idByRole[kind]=Number(r.insertId);
  }
  t.after(()=>pool.execute('DELETE FROM users WHERE id IN (?,?,?)',
    [idByRole.owner,idByRole.other,idByRole.admin]));
  const actors=Object.fromEntries(Object.entries(idByRole).map(([role,id])=>[
    role,{sub:id,role:role==='admin'?'admin':'user',email_verified:true},
  ]));
  return {idByRole,actors,initial};
}

test('a member can change their password; old password and old JWT become invalid',async t=>{
  const {idByRole,actors,initial}=await fixture(t);
  const id=idByRole.owner;
  const [[previous]]=await pool.execute('SELECT * FROM users WHERE id=?',[id]);
  const oldToken=signAuthToken(previous);
  await assert.rejects(
    updateAccount({targetId:id,actor:actors.owner,
      body:{password:'NewPassword-123!',oldPassword:'incorrect-password'}}),
    {code:'INVALID_OLD_PASSWORD'},
  );
  const changed=await updateAccount({
    targetId:id,actor:actors.owner,
    body:{newPassword:'NewPassword-123!',oldPassword:initial,
      passwordConfirmation:'NewPassword-123!'},
  });
  assert.equal(changed.sessionInvalidated,true);
  const [[updated]]=await pool.execute('SELECT * FROM users WHERE id=?',[id]);
  assert.equal(await bcrypt.compare(initial,updated.password_hash),false);
  assert.equal(await bcrypt.compare('NewPassword-123!',updated.password_hash),true);
  assert.equal(Number(updated.token_version),Number(previous.token_version)+1);
  assert.equal(Number(jwt.verify(oldToken,process.env.AUTH_SECRET).ver),
    Number(previous.token_version));
  await assert.rejects(updateAccount({
    targetId:idByRole.other,actor:actors.owner,body:{password:'Unauthorized-123!'},
  }),{code:'FORBIDDEN'});
});

test('admins can reset member passwords without knowing the old password',async t=>{
  const {idByRole,actors,initial}=await fixture(t);
  const res=await updateAccount({
    targetId:idByRole.other,actor:actors.admin,
    body:{password:'AdminAssigned-123!'},
  });
  assert.equal(res.sessionInvalidated,false);
  const [[updated]]=await pool.execute('SELECT password_hash,token_version FROM users WHERE id=?',[idByRole.other]);
  assert.equal(await bcrypt.compare(initial,updated.password_hash),false);
  assert.equal(await bcrypt.compare('AdminAssigned-123!',updated.password_hash),true);
  assert.equal(Number(updated.token_version),1);
});

test('authors may deactivate but not re-enable their own posts; admins can reactivate',async t=>{
  const {idByRole,actors}=await fixture(t);
  const [created]=await pool.execute(
    "INSERT INTO posts(author_id,title,content,status,locked) VALUES(?,?,?,'active',0)",
    [idByRole.owner,'Status assessment','Changing post status'],
  );
  const postId=Number(created.insertId);
  await assert.rejects(
    updatePostForUser(actors.other,postId,{status:'inactive'}),{code:'FORBIDDEN'},
  );
  const hidden=await updatePostForUser(actors.owner,postId,{status:'inactive'});
  assert.equal(hidden.status,'inactive');
  await assert.rejects(getVisiblePost(postId,null),{code:'POST_NOT_FOUND'});
  await assert.rejects(
    updatePostForUser(actors.owner,postId,{status:'active'}),{code:'ADMIN_REQUIRED'},
  );
  const restored=await updatePostForUser(actors.admin,postId,{status:'active'});
  assert.equal(restored.status,'active');
});
