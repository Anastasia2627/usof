import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  deliverNotifications,
  notifyPostFollowers,
  retryableNotificationError,
} from '../API/src/services/notificationService.js';

const quiet={error(){}};
const noDelay=async()=>{};

test('retries a rejected deadlock without duplicating a successful insert',async()=>{
  let calls=0;
  const task=async()=>{
    calls++;
    if(calls===1)throw Object.assign(new Error('deadlock'),{code:'ER_LOCK_DEADLOCK'});
    return true;
  };
  const result=await deliverNotifications([task],{sleep:noDelay,logger:quiet});
  assert.deepEqual(result,{attempted:1,succeeded:1,failed:0});
  assert.equal(calls,2);
});

test('does not retry ambiguous network failures that could duplicate notifications',async()=>{
  let calls=0;
  const failures=[];
  const task=async()=>{
    calls++;
    throw Object.assign(new Error('sensitive recipient'),{code:'PROTOCOL_CONNECTION_LOST'});
  };
  const result=await deliverNotifications([task],{
    sleep:noDelay,logger:{error:(...args)=>failures.push(args)},
  });
  assert.equal(calls,1);
  assert.equal(result.failed,1);
  assert.equal(failures.length,1);
  assert.equal(JSON.stringify(failures).includes('sensitive recipient'),false);
});

test('delivery errors are isolated from other recipients and attempts are bounded',async()=>{
  let calls=0;
  const result=await deliverNotifications([
    async()=>true,
    async()=>{calls++;throw {code:'ER_LOCK_WAIT_TIMEOUT'};},
  ],{sleep:noDelay,logger:quiet});
  assert.deepEqual(result,{attempted:2,succeeded:1,failed:1});
  assert.equal(calls,3);
  assert.equal(retryableNotificationError({code:'ER_LOCK_DEADLOCK'}),true);
  assert.equal(retryableNotificationError({code:'ER_DUP_ENTRY'}),false);
});

test('follower notification is one atomic insert with deduplicated exclusions',async()=>{
  const queries=[],writes=[];
  const database={
    async query(sql,args){queries.push({sql,args});return [[{login:'author'}]];},
    async execute(sql,args){writes.push({sql,args});return [{affectedRows:3}];},
  };
  await notifyPostFollowers({
    postId:12,actorId:5,type:'reply',commentId:19,
    excludeUserIds:[8,8,9],
  },database);
  assert.equal(queries.length,1);
  assert.equal(writes.length,1);
  assert.match(writes[0].sql,/INSERT INTO notifications/);
  assert.match(writes[0].sql,/FROM post_subscriptions ps/);
  assert.equal(writes[0].sql.includes('VALUES('),false);
  assert.deepEqual(writes[0].args.slice(-4),[12,5,8,9]);
  assert.equal(writes[0].args[0],5);
  assert.equal(writes[0].args[1],'reply');
});
