import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {after,test} from 'node:test';
import {pool} from '../API/src/config/db.js';
import {Notification} from '../API/src/models/Notification.js';

if(process.env.NODE_ENV!=='test'||! /_(test|ci)$/.test(process.env.DB_NAME||'')){
  throw new Error('Use a disposable *_test or *_ci MySQL database for notification tests');
}
after(()=>pool.end());

test('members can read, mark and delete only their own notifications',async t=>{
  const key=crypto.randomBytes(6).toString('hex');
  async function user(suffix){
    const [row]=await pool.execute(
      "INSERT INTO users(login,email,password_hash,email_verified,role) VALUES(?,?,?,1,'user')",
      ['notify_'+suffix+key,'notify_'+suffix+key+'@example.test','unused-test-hash'],
    );
    return Number(row.insertId);
  }
  const alice=await user('a');
  const bob=await user('b');
  t.after(async()=>{
    await pool.execute('DELETE FROM users WHERE id IN (?,?)',[alice,bob]);
  });
  const [record]=await pool.execute(
    "INSERT INTO notifications(user_id,actor_id,type,title,body) VALUES(?,?,'comment',?,?)",
    [alice,bob,'A private notification','For Alice only'],
  );
  const id=Number(record.insertId);

  assert.equal(await Notification.unreadCount(alice),1);
  assert.equal(await Notification.unreadCount(bob),0);
  const bobList=await Notification.list(bob);
  assert.equal(bobList.data.some(item=>Number(item.id)===id),false);
  assert.equal(await Notification.markRead(bob,id),false);
  assert.equal(await Notification.remove(bob,id),false);
  assert.equal(await Notification.unreadCount(alice),1);
  assert.equal(await Notification.markRead(alice,id),true);
  assert.equal(await Notification.unreadCount(alice),0);
  assert.equal(await Notification.remove(alice,id),true);
  assert.equal(await Notification.remove(alice,id),false);
});
