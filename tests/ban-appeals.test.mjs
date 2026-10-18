import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../API/src/config/db.js';
import app from '../API/app.js';
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
  const token=signAuthToken({...admin,token_version:0});
  const server=app.listen(0,'127.0.0.1');
  try {
    await new Promise(resolve=>server.once('listening',resolve));
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api/users/ban-appeals',{
      headers:{Authorization:'Bearer '+token},
    });
    const body=await response.json();
    assert.equal(response.status,200,JSON.stringify(body));
    assert.ok(Array.isArray(body.data));
  }finally {
    await new Promise(resolve=>server.close(resolve));
  }
});
