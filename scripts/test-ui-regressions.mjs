import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin=process.env.TEST_WEB_ORIGIN||'http://localhost:5173';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
  const admin=await browser.newContext({viewport:{width:1280,height:820}});
  const page=await admin.newPage();
  await page.goto(origin+'/#/login',{waitUntil:'networkidle'});
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('Password123!');
  await page.locator('button.authSubmit').click();
  await page.waitForURL(/#\/$/);

  await page.goto(origin+'/#/create',{waitUntil:'networkidle'});
  const options=page.locator('details.editorOptions');
  await options.locator('summary').click();
  const copy=page.locator('.editorOptionRows .editorOptionCopy').first();
  const checkbox=page.locator('#editor-hide-likes');
  const date=page.locator('#editor-publish-date');
  assert.ok(await options.getAttribute('open')!==null);
  assert.equal(await checkbox.isVisible(),true);
  assert.equal(await date.isVisible(),true);

  async function validateSettings(width){
    await page.setViewportSize({width,height:820});
    const box=await page.locator('.editorOptionRows').boundingBox();
    const label=await copy.boundingBox();
    const check=await checkbox.boundingBox();
    const schedule=await date.boundingBox();
    assert.ok(box&&label&&check&&schedule,'Composer inputs must be laid out');
    assert.ok(label.width >= Math.min(185,box.width*.53),
      'Settings label must not collapse: '+JSON.stringify({width,box,label}));
    assert.ok(check.x>label.x+label.width-2,
      'Checkbox must align to the right of its label');
    assert.ok(schedule.width>=Math.min(170,box.width*.50),
      'Date input must be readable on '+width+'px viewport');
    assert.ok(schedule.x>=box.x-1&&schedule.x+schedule.width<=box.x+box.width+2,
      'Date input must stay inside the advanced settings');
  }
  await validateSettings(1280);
  await validateSettings(390);
  await admin.close();

  // Recreate an auth payload from a revoked/old session. The backend must
  // reject it once; the whole feed should gracefully become public.
  const revoked=await browser.newContext({viewport:{width:1280,height:820}});
  await revoked.addInitScript(()=>{
    window.sessionStorage.setItem('usof-auth',JSON.stringify({
      token:'expired.session.token',
      user:{id:2,login:'former-moderator',role:'moderator'},
    }));
  });
  const expired=await revoked.newPage();
  await expired.goto(origin+'/#/',{waitUntil:'networkidle'});
  await expired.locator('.sessionExpiredBanner').waitFor({timeout:15000});
  assert.equal(await expired.locator('.sessionExpiredBanner').count(),1);
  assert.equal(await expired.getByRole('button',{name:'Log in',exact:true}).count()>=1,true);
  assert.equal(await expired.locator('.threadCard .inlineError').count(),0,
    'Expired sessions must never show repeated errors per post');
  const authCleared=await expired.evaluate(()=>sessionStorage.getItem('usof-auth'));
  assert.equal(authCleared,null,'Invalid session should be removed from storage');
  await expired.locator('.sessionExpiredBanner button').first().click();
  await expired.waitForURL(/#\/login$/);
  await revoked.close();

  console.log('UI regressions passed: advanced settings layout at desktop/mobile and invalid-session recovery.');
}finally{await browser.close();}
