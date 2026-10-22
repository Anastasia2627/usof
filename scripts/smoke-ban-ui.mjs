// End-to-end coverage for a restricted member, the appeal UI and the
// administrator notification. Runs exclusively against disposable CI data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const apiBase=process.env.TEST_API_ORIGIN||'http://127.0.0.1:5000/api';
const web=process.env.TEST_WEB_ORIGIN||'http://127.0.0.1:5173';
const nonce=Date.now().toString(36);
const credentials={login:'banview_'+nonce,email:'banview_'+nonce+'@example.test',
  password:'VisualTest123!'};
let adminToken,accountId,browser,context;

async function request(path,{method='GET',token,body}={}){
  const res=await fetch(apiBase+path,{
    method,headers:{
      ...(token?{Authorization:'Bearer '+token}:{}),
      ...(body!==undefined?{'Content-Type':'application/json'}:{}),
    },
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
  });
  if(res.status===204)return null;
  const value=await res.json();
  if(!res.ok)throw Error(method+' '+path+': '+res.status+' '+JSON.stringify(value));
  return value;
}

try{
  const admin=await request('/auth/login',{method:'POST',
    body:{login:'admin',password:'Password123!'}});
  adminToken=admin.token;
  const created=await request('/users',{method:'POST',token:adminToken,body:{
    ...credentials,fullName:'Visual test member',
    passwordConfirmation:credentials.password,role:'user',
  }});
  accountId=created.data.id;
  // Admin-created members require email confirmation just like public signups
  const delivery=await request('/auth/resend-verification',{method:'POST',
    body:{email:credentials.email}});
  assert.match(delivery.verificationCode,/^\\d{6}$/,
    'The disposable test setup should expose the verification code');
  await request('/auth/verify-email-code',{method:'POST',
    body:{email:credentials.email,code:delivery.verificationCode}});
  const member=await request('/auth/login',{method:'POST',
    body:{login:credentials.login,password:credentials.password}});
  await request('/users/'+accountId+'/ban',{method:'POST',token:adminToken,
    body:{reason:'Repeated community guideline violations',internalNote:'Internal QA only'}});
  const current=await request('/users/'+accountId,{token:adminToken});

  browser=await chromium.launch({args:['--no-sandbox']});
  context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.addInitScript(auth=>{
    window.sessionStorage.setItem('usof-auth',JSON.stringify(auth));
    window.localStorage.setItem('circle-display-preferences-v1',
      JSON.stringify({language:'uk',theme:'light'}));
  },{token:member.token,user:current.data});
  const page=await context.newPage();
  await page.goto(web+'/#/ban',{waitUntil:'networkidle'});
  await page.locator('.banNightStage').waitFor();
  assert.equal(await page.locator('.banStudioLayout').count(),0,
    'Old lock-card layout should be absent');
  await page.getByRole('heading',{name:'Ваш акаунт заблоковано'}).waitFor();
  assert.ok(await page.locator('.banNightPanel').isVisible(),
    'Real reason and appeal controls must be visible');
  await mkdir('screenshots',{recursive:true});
  await page.screenshot({path:'screenshots/ban-desktop.png',fullPage:true});

  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'screenshots/ban-mobile.png',fullPage:true});
  // Keep all controls within the narrow browser window.
  const sizes=await page.evaluate(()=>{
    const panel=document.querySelector('.banNightPanel').getBoundingClientRect();
    return {left:panel.left,right:panel.right,width:innerWidth};
  });
  assert.ok(sizes.left>=0&&sizes.right<=sizes.width+1,
    'Ban appeal panel must not overflow mobile viewport: '+JSON.stringify(sizes));

  await page.locator('.banNightForm textarea').fill('Please reconsider the account restriction.');
  await page.getByRole('button',{name:/Подати оскарження/}).click();
  await page.locator('.banNightAppealBadge').waitFor({timeout:15000});
  assert.ok(await page.locator('.banNightExplanation').isVisible(),
    'Submitted appeal must appear to the member');
  await page.screenshot({path:'screenshots/ban-appealed-mobile.png',fullPage:true});

  const notifications=await request('/notifications?limit=50',{token:adminToken});
  assert.ok(notifications.data.some(row=>
    row.type==='ban_appeal'&&Number(row.actor_id)===Number(accountId)&&!row.read_at),
    'New appeal must produce an unread administrator notification');
  const reviewContext=await browser.newContext({viewport:{width:1280,height:840}});
  await reviewContext.addInitScript(auth=>{
    window.sessionStorage.setItem('usof-auth',JSON.stringify(auth));
  },{token:admin.token,user:admin.user});
  const review=await reviewContext.newPage();
  await review.goto(web+'/#/admin?tab=appeals',{waitUntil:'networkidle'});
  await review.locator('.appealWorkspace').waitFor({timeout:20000});
  const reviewed=review.locator('.appealInboxItem').filter({hasText:credentials.login});
  await reviewed.click();
  await review.locator('.appealWorkspaceDetail').getByText('Please reconsider the account restriction.').waitFor();
  assert.equal(await review.locator('.banAppealCard').count(),0);
  await review.screenshot({path:'screenshots/appeals-refined-desktop.png',fullPage:true});
  await review.setViewportSize({width:390,height:844});
  await review.screenshot({path:'screenshots/appeals-refined-mobile.png',fullPage:true});
  await review.goto(web+'/#/categories',{waitUntil:'networkidle'});
  await review.locator('.categoryReferencePill').first().waitFor();
  await review.setViewportSize({width:1280,height:840});
  await review.screenshot({path:'screenshots/categories-refined-desktop.png',fullPage:true});
  await review.setViewportSize({width:390,height:844});
  await review.screenshot({path:'screenshots/categories-refined-mobile.png',fullPage:true});
  await reviewContext.close();
  console.log('Ban UI screenshots and administrator appeal delivery passed.');
}finally{
  if(context)await context.close();
  if(browser)await browser.close();
  if(adminToken&&accountId){
    try{await request('/users/'+accountId+'/ban',{method:'DELETE',token:adminToken});}
    catch(error){console.error('Ban test cleanup warning:',error.message);}
    try{await request('/users/'+accountId,{method:'DELETE',token:adminToken});}
    catch(error){console.error('Member cleanup warning:',error.message);}
  }
}
