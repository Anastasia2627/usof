import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {test} from 'node:test';
import {
  hashEmailVerificationCode,
  matchesEmailVerificationCode,
} from '../API/src/utils/emailVerificationCode.js';

test('new six-digit verification codes use a keyed hash and retain old-code compatibility',()=>{
  const previous=process.env.AUTH_SECRET;
  try{
    process.env.AUTH_SECRET='unit-test-secret-value-abcdefghijklmnopqrstuvwxyz';
    const code='000127';
    const keyed=hashEmailVerificationCode(code);
    const legacy=crypto.createHash('sha256').update(code).digest('hex');
    assert.match(keyed,/^[0-9a-f]{64}$/);
    assert.notEqual(keyed,legacy,'New codes must not be unkeyed SHA-256 hashes');
    assert.equal(matchesEmailVerificationCode(code,keyed),true);
    assert.equal(matchesEmailVerificationCode(code,legacy),true);
    assert.equal(matchesEmailVerificationCode('000128',keyed),false);
    assert.equal(matchesEmailVerificationCode('000128',legacy),false);
    assert.equal(matchesEmailVerificationCode('12345',keyed),false);
    assert.equal(matchesEmailVerificationCode(code,'not-a-hash'),false);
    process.env.AUTH_SECRET='another-unit-test-secret-value-abcdefghijklmnop';
    assert.notEqual(hashEmailVerificationCode(code),keyed);
  }finally{
    if(previous===undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET=previous;
  }
});
