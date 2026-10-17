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
  // Tab-scoped text drafts survive an accidental refresh and can be discarded.
  await page.goto(origin+'/#/create',{waitUntil:'networkidle'});
  await page.locator('#post-title').fill('A draft worth keeping');
  await page.locator('#post-content').fill('Unsaved writing survives a refresh.');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#post-title').inputValue(),'A draft worth keeping');
  assert.equal(await page.locator('#post-content').inputValue(),'Unsaved writing survives a refresh.');
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Discard draft'}).click();
  assert.equal(await page.locator('#post-title').inputValue(),'');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#post-title').inputValue(),'');

  // Sharing is possible directly from the feed, without navigating through menus.
  await admin.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto(origin+'/#/',{waitUntil:'networkidle'});
  const share=page.getByRole('button',{name:'Copy link'}).first();
  await share.waitFor();
  await share.click();
  await page.getByRole('button',{name:'Link copied'}).first().waitFor();
  const copiedUrl=await page.evaluate(()=>navigator.clipboard.readText());
  assert.match(copiedUrl,/\/#\/post\/\d+$/);

  // Shared icon source: Tabler for feed, navigation, and post actions.
  await page.locator('.threadCard .tablerSvgIcon svg.tabler-icon').first().waitFor();
  assert.ok(await page.locator('.mainNav .tablerSvgIcon svg.tabler-icon').count()>=3,
    'Navigation must use the chosen Tabler icon set');
  assert.equal(await page.locator('.googleSvgIcon').count(),0,
    'Old Google icons must not be rendered');
  const like=page.locator('.threadCard button[aria-label="Like"]').first();
  assert.equal(await like.locator('svg.tabler-icon').count(),1);
  await page.goto(origin+'/#/post/1',{waitUntil:'networkidle'});
  await page.locator('.naturalPost .tablerSvgIcon svg.tabler-icon').first().waitFor();
  await page.goto(origin+'/#/',{waitUntil:'networkidle'});

  // Rounded interactive surfaces stay legible at common desktop/mobile sizes.
  const card=page.locator('.threadCard').first();
  const desktopRadius=await card.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
  assert.ok(desktopRadius>=14,'Feed cards should have comfortable rounded corners');
  await page.setViewportSize({width:390,height:844});
  const mobileRadius=await card.evaluate(el=>parseFloat(getComputedStyle(el).borderTopLeftRadius));
  assert.ok(mobileRadius>=14,'Feed cards must stay rounded on mobile');
  // Search stays usable when the topic collection grows.
  await page.goto(origin+'/#/create',{waitUntil:'networkidle'});
  const topicFilter=page.getByRole('searchbox',{name:'Search topics'});
  await topicFilter.fill('zz_topic_that_does_not_exist');
  assert.equal(await page.locator('.editorTopicList .editorTopic').count(),0);
  await page.getByRole('button',{name:'Clear search'}).click();
  assert.ok(await page.locator('.editorTopicList .editorTopic').count()>=12);
  await page.goto(origin+'/#/categories',{waitUntil:'networkidle'});
  const categoryFilter=page.getByRole('searchbox',{name:'Search topics'});
  await categoryFilter.fill('zz_topic_that_does_not_exist');
  await page.getByText('No matching topics').waitFor();
  await page.locator('.categorySearchField').getByRole('button',{name:'Clear search'}).click();
  assert.ok(await page.locator('.categoryCard').count()>0);

  // The whole language picker supports English and Ukrainian only.
  await page.goto(origin+'/#/settings',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.settingsLanguages button').count(),2);
  assert.equal(await page.getByText('Русский').count(),0);
  await page.getByRole('radio',{name:'Dark'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.getByRole('radio',{name:'Light'}).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');

  // Date selection should use the app calendar, never Chromium's native popup.
  await page.goto(origin+'/#/create',{waitUntil:'networkidle'});
  await page.locator('details.editorOptions summary').click();
  await page.locator('#editor-publish-date').click();
  await page.locator('.circleCalendar[role=dialog]').waitFor();
  await page.locator('.calendarDay.today').first().click();
  assert.equal(await page.locator('.calendarTime select').count(),2);
  await page.locator('details.editorOptions summary').click();
  await page.goto(origin+'/#/',{waitUntil:'networkidle'});
  await page.locator('.filterDetails summary').click();
  await page.getByRole('button',{name:'Last 7 days'}).click();
  assert.ok(await page.locator('.filterPanelDates .circleDatePicker').count()===2);
  await page.getByRole('button',{name:'Apply filters'}).click();
  await page.waitForURL(/from=.*to=/);

  // Topic proposals must work from inside the post composer without
  // accidentally submitting a post (nested HTML forms are not allowed).
  await page.goto(origin+'/#/create',{waitUntil:'networkidle'});
  const proposed='UI Topic '+Date.now();
  await page.getByRole('button',{name:'Suggest a topic'}).click();
  await page.getByLabel('Topic name').fill(proposed);
  await page.getByRole('button',{name:'Send suggestion'}).click();
  await page.getByText('Suggestion sent for review').waitFor();
  assert.ok(page.url().includes('#/create'),'Submitting a topic idea must not publish a post');
  await page.goto(origin+'/#/admin?tab=suggestions',{waitUntil:'networkidle'});
  await page.getByText(proposed).waitFor();
  const idea=page.locator('.suggestReviewCard').filter({hasText:proposed});
  page.once('dialog',dialog=>dialog.accept());
  await idea.getByRole('button',{name:'Reject'}).click();
  await idea.waitFor({state:'detached'});

  // The dashboard is reachable from Admin and is no longer a sidebar item.
  await page.goto(origin+'/#/admin',{waitUntil:'networkidle'});
  await page.getByRole('navigation',{name:'Main navigation'})
    .getByRole('button',{name:'Dashboard'}).waitFor({state:'detached'});
  await page.getByRole('button',{name:'Dashboard'}).click();
  await page.locator('.embeddedDashboard .dashStats').first().waitFor();
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
