import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import sharp from 'sharp';

if (process.env.NODE_ENV !== 'test' || !/(_test|_ci)$/.test(process.env.DB_NAME || '')) {
  throw new Error('Use only a disposable CI database');
}
const host = 'http://localhost:5173';
const apiHost = 'http://127.0.0.1:5000/api';
const suffix = Date.now().toString(36);
const name = 'review' + suffix;
const email = name + '@example.test';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const userContext = await browser.newContext({viewport:{width:390,height:844}});
const adminContext = await browser.newContext({viewport:{width:1280,height:800}});
const user = await userContext.newPage();
const admin = await adminContext.newPage();
async function open(page,path){await page.goto(host+'/#'+path,{waitUntil:'networkidle'});}
async function fetchApi(path, token, method='GET', body){
  const response = await fetch(apiHost+path,{method,headers:{
    ...(token?{Authorization:'Bearer '+token}:{}),
    ...(body?{'Content-Type':'application/json'}:{})
  }, ...(body?{body:JSON.stringify(body)}:{})});
  const json = await response.json().catch(()=>({}));
  assert.ok(response.ok,path+' failed '+response.status+' '+JSON.stringify(json));
  return json;
}
async function logIn(page,name){
  await open(page,'/login');
  await page.locator('[autocomplete=username]').fill(name);
  await page.locator('[autocomplete=current-password]').fill('Password123!');
  await page.locator('button.circleAuthSubmit').click();
  await page.waitForURL(/#\/$/);
}
try {
  // 1: default order is the number of positive reactions (descending).
  await open(user,'/');
  await user.locator('.threadCard').first().waitFor();
  assert.ok(await user.locator('.headerSearch').isVisible(), 'Guest homepage has search');
  await open(user,'/explore');
  await user.locator('.threadCard').first().waitFor();
  const expected = (await fetchApi('/posts?sort=likes&order=desc&limit=8')).data;
  assert.equal(await user.locator('.threadCard .postTitleLink').first().innerText(),expected[0].title);
  assert.deepEqual(expected.map(x=>Number(x.like_count)),
    expected.map(x=>Number(x.like_count)).sort((a,b)=>b-a));

  // 2 and 3: expand the compact Threads-like filters, then sort and filter.
  await user.locator('.filterDetails summary').click();
  await user.getByLabel('Sort by').selectOption('date');
  await user.getByLabel('Sort direction').selectOption('asc');
  await user.getByRole('button',{name:'Apply filters'}).click();
  await user.waitForURL(/order=asc/);
  // Wait until the URL-synchronizing React effect has updated the filter form.
  await user.waitForFunction(() => document.querySelector('[aria-label="Sort direction"]')?.value === 'asc');
  await user.locator('.filterDetails summary').click();
  await user.getByLabel('Sort direction').selectOption('desc');
  await user.waitForFunction(() => document.querySelector('[aria-label="Sort direction"]')?.value === 'desc');
  await user.getByRole('button',{name:'Apply filters'}).click();
  await user.waitForURL(/order=desc/);
  await user.waitForLoadState('networkidle');
  // Wait for the route-to-form synchronization effect before editing next field.
  await user.waitForTimeout(200);
  await user.locator('.filterDetails summary').click();
  const cats=(await fetchApi('/categories')).data;
  await user.getByLabel('Category').selectOption(String(cats[0].id));
  await user.getByRole('button',{name:'Apply filters'}).click();
  await user.waitForURL(/category=/);

  // 4, 5, 6: actual registration, email code and login.
  await open(user,'/register');
  await user.locator('[autocomplete=username]').fill(name);
  await user.locator('[autocomplete=email]').fill(email);
  await user.locator('[autocomplete=new-password]').nth(0).fill('Password123!');
  await user.locator('[autocomplete=new-password]').nth(1).fill('Password123!');
  await user.locator('button.circleAuthSubmit').click();
  await user.locator('.verificationForm button.authSubmit').click();
  await user.waitForURL(url => url.hash === '#/categories');
  await user.locator('.categoryReferenceSkip').click();
  await user.waitForURL(/#\/$/);

  // 7, 8, 9: mobile header, profile, edit and reload.
  const avatar=user.getByRole('button',{name:'Profile of '+name+' (user)'});
  assert.ok(await avatar.isVisible());
  assert.ok(await user.locator('.accountMenu summary').isVisible());
  await avatar.click();
  await user.waitForURL(/#\/profile$/);
  assert.equal(await user.getByLabel('Full name').count(), 0, 'Edit form should stay hidden until requested');
  await user.getByRole('button',{name:'Edit profile'}).click();
  await user.getByLabel('Full name').fill('Review participant');
  await user.getByRole('button',{name:'Save profile'}).click();
  await user.getByText('Profile saved.').waitFor();
  await user.reload();
  await user.getByRole('button',{name:'Edit profile'}).click();
  // The profile is loaded asynchronously after refresh; wait for MySQL data.
  await user.waitForFunction(() => {
    const input = Array.from(document.querySelectorAll('input')).find(
      item => item.closest('label')?.textContent?.includes('Full name'),
    );
    return input?.value === 'Review participant';
  });

  await user.getByRole('button',{name:'Close editor'}).click();
  assert.ok(await user.getByRole('button',{name:'Recent'}).isVisible());

  // Keep screenshots of the actual redesigned profile in the same disposable test.
  await user.waitForTimeout(150);
  await mkdir('screenshots', { recursive: true });
  await user.screenshot({ path: 'screenshots/profile-mobile.png', fullPage: true });
  await user.setViewportSize({ width: 1280, height: 800 });
  await user.screenshot({ path: 'screenshots/profile-desktop.png', fullPage: true });
  await user.setViewportSize({ width: 390, height: 844 });

  // Ordinary members must never see controls to delete someone else's post.
  await open(user,'/post/1');
  assert.equal(await user.getByRole('button',{name:'Delete post'}).count(),0,
    'Ordinary members must not have a delete button on another author post');

  // 10 and 11: create 2 posts, edit content and categories.
  const posts=[];
  for(let i=0;i<2;i++){
    await open(user,'/create');
    await user.locator('input[maxlength="180"]').fill('Review post '+i+' '+suffix);
    await user.locator('textarea[maxlength="50000"]').fill('Review content '+i);
    await user.locator('fieldset input[type=checkbox]').nth(i).check();
    if (i === 0) {
      const photo=await sharp({create:{width:32,height:32,channels:3,background:'#edc8db'}}).png().toBuffer();
      await user.locator('#post-photo-input').setInputFiles({name:'review.png',mimeType:'image/png',buffer:photo});
      await user.locator('.editorPhotoLivePreview .postPhotoGallery img').first().waitFor();
      await user.locator('.editorPhotoLivePreview .postPhotoGallery button').first().click();
      await user.getByRole('dialog',{name:'Full-size post photo'}).waitFor();
      await user.getByRole('button',{name:'Close photo'}).click();
      const labels = user.locator('.editorTopic');
      assert.ok(await labels.first().isVisible(), 'Topics should be offered as selectable chips');
      assert.ok(await user.locator('fieldset input[type=checkbox]').nth(0).isChecked(), 'Native checkbox selection should be preserved');
      assert.equal(await user.locator('.postComposerForm').evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
      await mkdir('screenshots', { recursive: true });
      // Capture after the subtle 120ms selection transition has finished.
      await user.waitForTimeout(180);
      await user.screenshot({ path: 'screenshots/editor-mobile.png', fullPage: true });
      await user.setViewportSize({ width: 1280, height: 800 });
      await user.screenshot({ path: 'screenshots/editor-desktop.png', fullPage: true });
      await user.setViewportSize({ width: 390, height: 844 });
    }
    await user.getByRole('button',{name:'Publish post'}).click();
    await user.waitForURL(/#\/post\/\d+$/);
    posts.push(Number(new URL(user.url()).hash.match(/post\/(\d+)/)[1]));
    if(i===0){
      await user.locator('.naturalPost .postPhotoGallery img').first().waitFor();
      assert.equal((await fetchApi('/posts/'+posts[0])).data.images.length,1);
    }
  }
  await open(user,'/edit/'+posts[0]);
  await user.locator('input[maxlength="180"]').fill('Review EDITED '+suffix);
  await user.locator('textarea[maxlength="50000"]').fill('Review updated text');
  await user.locator('fieldset input[type=checkbox]').nth(0).uncheck();
  await user.locator('fieldset input[type=checkbox]').nth(1).check();
  await user.getByRole('button',{name:'Save changes'}).click();
  await user.waitForURL(/#\/post\/\d+$/);
  assert.equal((await fetchApi('/posts/'+posts[0])).data.content,'Review updated text');

  // 12 and 13: previews and mobile layout.
  await open(user,'/');
  const preview=user.locator('.threadCard').filter({hasText:'Review EDITED '+suffix}).first();
  await preview.waitFor();
  assert.ok(await preview.locator('.tags').isVisible());
  assert.ok(await user.getByRole('navigation',{name:'Main navigation'}).isVisible());
  for(const width of [390,768,1280]){
    await user.setViewportSize({width,height:800});
    assert.ok(await user.locator('.accountMenu summary').isVisible());
  }

  // 14: admin in another browser session.
  await logIn(admin,'admin');
  assert.ok(await admin.getByRole('button',{name:'Admin',exact:true}).isVisible());

  // 15: nested dialogue, reactions, status update and delete.
  await open(user,'/post/'+posts[0]);
  const rootReply='Member reply '+suffix;
  await user.getByLabel('New comment').fill(rootReply);
  await user.getByRole('button',{name:'Comment',exact:true}).click();
  await user.getByText(rootReply).waitFor();
  // A locally displayed comment must also be committed and readable by the
  // server before the other browser attempts to load it
  let persisted=false;
  for(let retry=0;retry<15;retry++){
    const all=(await fetchApi('/posts/'+posts[0]+'/comments')).data;
    if(all.some(item=>item.content===rootReply)){persisted=true;break;}
    await user.waitForTimeout(300);
  }
  assert.ok(persisted,'The new comment must be visible from the public API');
  await open(admin,'/post/'+posts[0]);
  assert.equal(await admin.locator('.naturalPostManagement button').count(),0,
    'Discussion moderation is not an always-visible icon toolbar');
  await admin.locator('.naturalPost').click({button:'right'});
  const postMenu=admin.getByRole('menu',{name:'Post actions'});
  await postMenu.waitFor({state:'visible'});
  assert.ok(await postMenu.getByRole('menuitem').count()>=3);
  assert.ok(await postMenu.getByRole('menuitem',{name:'Hide post'}).isVisible());
  await mkdir('screenshots',{recursive:true});
  await admin.screenshot({path:'screenshots/discussion-action-menu-desktop.png',fullPage:true});
  await admin.keyboard.press('Escape');
  await postMenu.waitFor({state:'detached'});
  await admin.screenshot({path:'screenshots/discussion-clean-desktop.png',fullPage:true});
  const card=admin.locator('.commentCard').filter({hasText:rootReply}).first();
  try { await card.waitFor({ state:'visible', timeout:5000 }); }
  catch (error) {
    console.error('Admin comment view debug:',(await admin.locator('body').innerText()).slice(0,1800));
    throw error;
  }
  await card.getByRole('button',{name:'Like',exact:true}).click();
  await card.click({button:'right'});
  await admin.getByRole('menu',{name:'Comment actions'}).getByRole('menuitem',{name:'Reply'}).click();
  await card.getByRole('textbox',{name:'Reply'}).fill('Admin replied '+suffix);
  await card.getByRole('button',{name:'Post reply'}).click();
  await admin.getByText('Admin replied '+suffix).waitFor();
  // Switching back to the user's browser should refresh cross-browser comments.
  await user.bringToFront();
  await user.getByText('Admin replied '+suffix).waitFor({timeout:18000});
  const answer=user.locator('.commentCard').filter({hasText:'Admin replied '+suffix}).first();
  await answer.getByRole('button',{name:'Dislike',exact:true}).click();
  await answer.getByRole('button',{name:'Dislike',exact:true}).click();

  // Notifications should read like messages rather than nested form buttons.
  await open(user,'/notifications');
  const notice=user.locator('.notificationItem').first();
  await notice.waitFor({timeout:12000});
  assert.equal(await notice.locator('.notificationMain').evaluate(
    el=>getComputedStyle(el).borderTopWidth),'0px','Notification content must have no inner border');
  for(const width of [1280,390]) {
    await user.setViewportSize({width,height:800});
    const cardBox=await notice.boundingBox();
    const headlineBox=await notice.locator('.notificationTitle').boundingBox();
    const descriptionBox=await notice.locator('.notificationDescription').boundingBox();
    const dateBox=await notice.locator('.notificationTime').boundingBox();
    assert.ok(cardBox&&headlineBox&&descriptionBox&&dateBox);
    assert.ok(descriptionBox.y >= headlineBox.y+headlineBox.height-2,
      'Notification description must sit beneath the heading');
    assert.ok(dateBox.y >= descriptionBox.y+descriptionBox.height-2,
      'Notification date must sit beneath the description');
    assert.equal(await notice.locator('.notificationDeleteIcon').count(),0,
      'The delete action should exist only in the contextual menu');
    assert.ok(cardBox.x>=0 && cardBox.x+cardBox.width<=width+1,
      'Notification card must stay inside mobile viewport');
  }
  await user.setViewportSize({width:390,height:844});
  await user.screenshot({path:'screenshots/notifications-mobile.png',fullPage:true});
  await user.setViewportSize({width:1280,height:800});
  await user.screenshot({path:'screenshots/notifications-desktop.png',fullPage:true});
  await notice.click({button:'right'});
  await user.locator('.notificationContextMenu [role=menuitem]').waitFor();
  await user.keyboard.press('Escape');
  await user.locator('.notificationContextMenu').waitFor({state:'detached'});
  await open(user,'/post/'+posts[0]);

  await admin.reload();
  const adminCard=admin.locator('.commentCard').filter({hasText:rootReply}).first();
  await adminCard.click({button:'right'});
  await admin.getByRole('menu',{name:'Comment actions'}).getByRole('menuitem',{name:'Hide comment'}).click();
  await adminCard.click({button:'right'});
  await admin.getByRole('menu',{name:'Comment actions'}).getByRole('menuitem',{name:'Show comment'}).click();

  // 16: admin updates first user.
  await open(admin,'/admin');
  const userRow=admin.locator('.adminUserRow')
    .filter({has:admin.locator('.adminName',{hasText:name})}).first();
  await userRow.locator('.adminUserActionMenu summary').click();
  await userRow.locator('.adminUserMenuItems button').first().click();
  await userRow.getByRole('textbox',{name:'Full name for '+name}).fill('Admin edited member');
  await userRow.getByRole('button',{name:'Save user'}).click();
  await userRow.locator('.adminInlineForm').waitFor({state:'detached'});

  // The redesigned admin list is responsive and does not expose edit forms by default.
  await mkdir('screenshots', { recursive: true });
  await admin.screenshot({path:'screenshots/admin-desktop.png',fullPage:true});
  await admin.setViewportSize({width:390,height:844});
  await admin.screenshot({path:'screenshots/admin-mobile.png',fullPage:true});
  await admin.setViewportSize({width:1280,height:800});

  // 17: author edits their own content, but not other users or admin.
  await open(user,'/edit/'+posts[0]);
  await user.locator('textarea[maxlength="50000"]').fill('Last user change');
  await user.getByRole('button',{name:'Save changes'}).click();
  await user.waitForURL(/#\/post\/\d+$/);
  assert.equal((await fetchApi('/posts/'+posts[0])).data.content,'Last user change');

  // 18: admin adds a category; 19: admin deletes other's comment.
  await open(admin,'/admin');
  await admin.locator('.adminMoreTabs summary').click();
  await admin.locator('.adminMoreMenu').getByRole('button',{name:/categories/i}).click();
  const categoryName='Review category '+suffix;
  await admin.locator('.adminCategoryCreate').getByLabel('Topic name').fill(categoryName);
  await admin.locator('.adminCategoryCreate').getByRole('button',{name:'Create topic'}).click();
  await admin.getByText(categoryName).waitFor();
  await open(user,'/create');
  await user.getByText(categoryName).waitFor();
  await open(admin,'/post/'+posts[0]);
  admin.once('dialog',dialog=>dialog.accept());
  await admin.locator('.commentCard').filter({hasText:rootReply}).first().click({button:'right'});
  await admin.getByRole('menu',{name:'Comment actions'}).getByRole('menuitem',{name:'Delete comment'}).click();
  await admin.getByText(rootReply).waitFor({state:'detached'});

  // Role updates must keep an already logged-in user on the same page.
  const originalPage=user.url();
  await open(admin,'/admin');
  await userRow.locator('.adminUserActionMenu summary').click();
  admin.once('dialog',dialog=>dialog.accept());
  await userRow.locator('.adminUserMenuItems button').filter({hasText:'Make moderator'}).click();
  await user.locator('.accountRole').getByText('moderator').waitFor({timeout:18000});
  assert.equal(user.url(),originalPage,'Promotion must not redirect the member');
  assert.equal(await user.locator('.sessionExpiredBanner').count(),0);

  await userRow.locator('.adminUserActionMenu summary').click();
  admin.once('dialog',dialog=>dialog.accept());
  await userRow.locator('.adminUserMenuItems button').filter({hasText:'Remove moderator'}).click();
  await user.locator('.accountRole').getByText('user').waitFor({timeout:18000});
  assert.equal(user.url(),originalPage,'Demotion must not redirect the member');
  assert.equal(await user.locator('.sessionExpiredBanner').count(),0);

  // 20: logout.
  await user.locator('.accountMenu summary').click();
  await user.getByRole('button',{name:'Log out'}).click();
  await user.locator('.accountMenu').waitFor({state:'detached'});
  console.log('Defense rehearsal passed: all 20 review steps and two isolated browser sessions.');
} finally {
  await browser.close();
}
