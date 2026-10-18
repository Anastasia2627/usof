import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../API/src/config/db.js';
import app from '../API/app.js';
import {createReport} from '../API/src/services/reportService.js';
import { User } from '../API/src/models/User.js';
import { requireAuth, requireAppealAuth, signAuthToken } from '../API/src/middleware/auth.js';
import {
  restrictAccount, liftRestriction, appealRestriction, getRestrictionStatus,
  listRestrictionAppeals, reviewRestrictionAppeal,
} from '../API/src/services/banService.js';

if (process.env.NODE_ENV !== 'test' || !/_(test|ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Ban tests require NODE_ENV=test and a disposable *_test or *_ci database');
}
after(() => pool.end());

async function fixture(t, role='user') {
  const nonce=crypto.randomBytes(6).toString('hex');
  const login='ban_'+nonce;
  const [created]=await pool.execute(
    'INSERT INTO users(login,email,role,email_verified,password_hash) VALUES(?,?,?,1,?)',
    [login,login+'@example.test',role,await bcrypt.hash('temporary-test-password',4)],
  );
  t.after(()=>pool.execute('DELETE FROM users WHERE id=?',[created.insertId]));
  return User.findById(created.insertId);
}

const requestWithToken=(token)=>({headers:{authorization:'Bearer '+token}});
async function authorize(middleware,token) {
  return new Promise((resolve,reject)=>{
    const req=requestWithToken(token);
    middleware(req,{},err=>err?reject(err):resolve(req.user));
  });
}

test('blocking prevents normal requests yet keeps private ban notes hidden from the member',async t=>{
  const admin=await fixture(t,'admin');
  const moderator=await fixture(t,'moderator');
  const member=await fixture(t);
  const actor={sub:admin.id,role:'admin'};
  const token=signAuthToken({...member,token_version:0});
  await restrictAccount(member.id,actor,{reason:'Repeated community guideline violations',internalNote:'Internal investigation #9'});
  await assert.rejects(authorize(requireAuth,token),{code:'ACCOUNT_BANNED'});
  const appealIdentity=await authorize(requireAppealAuth,token);
  assert.equal(appealIdentity.sub,member.id);
  const status=await getRestrictionStatus(member.id);
  assert.equal(status.data.user.ban_reason,'Repeated community guideline violations');
  assert.ok(status.data.user.banned_at);
  assert.ok(!JSON.stringify(status.data).includes('Internal investigation'));
  const submitted=await appealRestriction(member.id,{explanation:'I would like the team to reconsider the restriction.'});
  assert.equal(submitted.data.status,'pending');
  const [[adminNotice]]=await pool.execute(
    'SELECT type FROM notifications WHERE user_id=? AND actor_id=? AND type=? ORDER BY id DESC LIMIT 1',
    [admin.id,member.id,'ban_appeal'],
  );
  assert.equal(adminNotice?.type,'ban_appeal','Admin must receive an appeal notification');
  const [[moderatorNotice]]=await pool.execute(
    'SELECT type,body FROM notifications WHERE user_id=? AND actor_id=? AND type=? ORDER BY id DESC LIMIT 1',
    [moderator.id,member.id,'ban_appeal'],
  );
  assert.equal(moderatorNotice?.type,'ban_appeal','Moderators must receive an informational appeal notification');
  assert.match(moderatorNotice.body,/administrator/i);
  assert.ok(!moderatorNotice.body.includes('Internal investigation'));
  assert.ok(!moderatorNotice.body.includes('Repeated community guideline violations'));
  assert.ok(!moderatorNotice.body.includes('I would like the team'));
  await assert.rejects(appealRestriction(member.id,{explanation:'Repeat request'}),{code:'APPEAL_ALREADY_SUBMITTED'});
  const listed=await listRestrictionAppeals();
  const entry=listed.data.find(v=>v.id===submitted.data.id);
  assert.ok(entry);
  assert.equal(entry.ban_internal_note,'Internal investigation #9');
  assert.ok(entry.ban_started_at);
  await reviewRestrictionAppeal(entry.id,actor,{status:'rejected',reviewNote:'Restriction upheld'});
  await assert.rejects(authorize(requireAuth,token),{code:'ACCOUNT_BANNED'});
  await liftRestriction(member.id,actor);
  await authorize(requireAuth,token);
  assert.equal((await getRestrictionStatus(member.id)).data.appeal,null);
});

test('approval unblocks only the matching ban and administrators cannot be blocked',async t=>{
  const admin=await fixture(t,'admin');
  const member=await fixture(t);
  const actor={sub:admin.id,role:'admin'};
  await assert.rejects(restrictAccount(admin.id,actor,{reason:'Not permitted'}),{code:'SELF_BAN_FORBIDDEN'});
  await restrictAccount(member.id,actor,{reason:'Review required'});
  const created=await appealRestriction(member.id,{explanation:'Please consider my account history'});
  const result=await reviewRestrictionAppeal(created.data.id,actor,{status:'approved'});
  assert.equal(result.data.status,'approved');
  const user=await User.findById(member.id);
  assert.equal(user.banned_at,null);
  await assert.rejects(appealRestriction(member.id,{explanation:'Not banned'}),{code:'NOT_BANNED'});
});


test('HTTP /api/users/ban-appeals is never interpreted as /:user_id',async t=>{
  const admin=await fixture(t,'admin');
  const moderator=await fixture(t,'moderator');
  const token=signAuthToken({...admin,token_version:0});
  const moderatorToken=signAuthToken({...moderator,token_version:0});
  const server=app.listen(0,'127.0.0.1');
  try {
    await new Promise(resolve=>server.once('listening',resolve));
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/users/ban-appeals',{
      headers:{Authorization:'Bearer '+token},
    });
    const body=await response.json();
    assert.equal(response.status,200,JSON.stringify(body));
    assert.ok(Array.isArray(body.data));
    const moderatorResponse=await fetch('http://127.0.0.1:'+server.address().port+'/api/users/ban-appeals',{
      headers:{Authorization:'Bearer '+moderatorToken},
    });
    assert.equal(moderatorResponse.status,403,'Moderator cannot view confidential ban appeal details');
  }finally {
    await new Promise(resolve=>server.close(resolve));
  }
});


test('content reports notify administrators and only moderators can recommend a ban',async t=>{
  const admin=await fixture(t,'admin');
  const moderator=await fixture(t,'moderator');
  const member=await fixture(t);
  const ordinary=await fixture(t);
  const [post]=await pool.execute(
    'INSERT INTO posts(author_id,title,content) VALUES(?,?,?)',
    [member.id,'Report notification fixture','A post requiring moderation'],
  );
  const [comment]=await pool.execute(
    'INSERT INTO comments(post_id,author_id,content) VALUES(?,?,?)',
    [post.insertId,member.id,'A comment with concerning content'],
  );
  const recommendation=await createReport({sub:moderator.id,role:'moderator'},{
    commentId:comment.insertId,targetAuthorId:member.id,reason:'abuse',
    details:'Specific evidence from comment',recommendBan:true,
  });
  const [[reported]]=await pool.execute(
    'SELECT recommend_ban,comment_id FROM content_reports WHERE id=?',[recommendation.id],
  );
  assert.equal(Number(reported.recommend_ban),1);
  assert.equal(Number(reported.comment_id),comment.insertId);
  const [[notice]]=await pool.execute(
    'SELECT type,comment_id FROM notifications WHERE user_id=? AND actor_id=? AND type=?',
    [admin.id,moderator.id,'ban_recommendation'],
  );
  assert.equal(notice?.type,'ban_recommendation');
  assert.equal(Number(notice.comment_id),comment.insertId);
  await assert.rejects(createReport({sub:ordinary.id,role:'user'},{
    postId:post.insertId,targetAuthorId:member.id,reason:'abuse',
    recommendBan:true,
  }),{code:'MODERATOR_REQUIRED'});
  await createReport({sub:ordinary.id,role:'user'},{
    postId:post.insertId,targetAuthorId:member.id,reason:'spam',
  });
  const [[ordinaryNotice]]=await pool.execute(
    'SELECT type FROM notifications WHERE user_id=? AND actor_id=? AND type=?',
    [admin.id,ordinary.id,'content_report'],
  );
  assert.equal(ordinaryNotice?.type,'content_report');
});
