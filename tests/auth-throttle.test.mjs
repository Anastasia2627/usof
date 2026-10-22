import assert from 'node:assert/strict';
import {test} from 'node:test';
import {authThrottle} from '../API/src/routes/authRoutes.js';

function simulate(middleware,{route,ip,body={},responseCode=401}){
  const req={
    path:'/verify-email/'+Math.random().toString(36).slice(2),
    route:{path:route},
    baseUrl:'/api/auth',
    ip,body,
  };
  const headers={};
  let finish=null,answer=null,passed=false;
  const res={
    statusCode:responseCode,
    set(name,value){headers[name]=value;return this;},
    status(code){this.statusCode=code;return this;},
    json(data){answer=data;return this;},
    once(name,cb){if(name==='finish')finish=cb;return this;},
  };
  middleware(req,res,()=>{passed=true;});
  if(passed && finish)finish();
  return {passed,answer,headers};
}

test('auth rate limiting counts changing verification tokens under one route',()=>{
  const throttle=authThrottle({max:2,windowMs:900000});
  const ip='test-token-path-'+Date.now();
  assert.equal(simulate(throttle,{route:'/verify-email/:token',ip}).passed,true);
  assert.equal(simulate(throttle,{route:'/verify-email/:token',ip}).passed,true);
  const denied=simulate(throttle,{route:'/verify-email/:token',ip});
  assert.equal(denied.passed,false);
  assert.equal(denied.answer.code,'RATE_LIMITED');
  assert.ok(Number(denied.headers['Retry-After'])>0);
});

test('login failures are bounded per account and IP',()=>{
  const throttle=authThrottle({max:100,windowMs:900000,accountFailLimit:2});
  const ip='test-account-login-'+Date.now();
  assert.equal(simulate(throttle,{route:'/login',ip,body:{login:'repeat-user'}}).passed,true);
  assert.equal(simulate(throttle,{route:'/login',ip,body:{login:'repeat-user'}}).passed,true);
  const blocked=simulate(throttle,{route:'/login',ip,body:{login:'repeat-user'}});
  assert.equal(blocked.passed,false);
  assert.equal(blocked.answer.code,'RATE_LIMITED');
  // Another member on shared Wi-Fi is still able to attempt sign-in
  assert.equal(simulate(throttle,{route:'/login',ip,body:{login:'another-user'}}).passed,true);
});
