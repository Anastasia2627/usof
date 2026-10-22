import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  deliverNotifications,
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
