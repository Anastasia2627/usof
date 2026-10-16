import assert from 'node:assert/strict';
import { chromium } from 'playwright';

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
  await page.locator('button.authSubmit').click();
  await page.waitForURL(/#\/$/);
}
try {
  // 1: default order is the number of positive reactions (descending).
  await open(user,'/');
  await user.locator('.threadCard').first().waitFor();
  const expected = (await fetchApi('/posts?sort=likes&order=desc&limit=8')).data;
  assert.equal(await user.locator('.threadCard .postTitleLink').first().innerText(),expected[0].title);
  assert.deepEqual(expected.map(x=>Number(x.like_count)),
    expected.map(x=>Number(x.like_count)).sort((a,b)=>b-a));

  // 2 and 3: date ascending/descending, filtering by category.
  await user.getByLabel('Sort by').selectOption('date');
  await user.getByLabel('Sort direction').selectOption('asc');
  await user.getByRole('button',{name:'Apply'}).click();
  await user.waitForURL(/order=asc/);
  await user.getByLabel('Sort direction').selectOption('desc');
  await user.getByRole('button',{name:'Apply'}).click();
  await user.waitForURL(/order=desc/);
  const cats=(await fetchApi('/categories')).data;
  await user.getByLabel('Category').selectOption(String(cats[0].id));
  await user.getByRole('button',{name:'Apply'}).click();
  await user.waitForURL(/category=/);

  // 4, 5, 6: actual registration, email code and login.
  await open(user,'/register');
  await user.locator('[autocomplete=username]').fill(name);
  await user.locator('[autocomplete=email]').fill(email);
  await user.locator('[autocomplete=new-password]').nth(0).fill('Password123!');
  await user.locator('[autocomplete=new-password]').nth(1).fill('Password123!');
  await user.locator('button.authSubmit').click();
  await user.locator('.verificationForm button.authSubmit').click();
  await user.waitForURL(/#\/$/);

  // 7, 8, 9: mobile header, profile, edit and reload.
  const avatar=user.getByRole('button',{name:'Profile of '+name+' (user)'});
  assert.ok(await avatar.isVisible());
  assert.ok(await user.locator('.headerLogout').isVisible());
  await avatar.click();
  await user.waitForURL(/#\/profile$/);
  await user.getByLabel('Full name').fill('Review participant');
  await user.getByRole('button',{name:'Save profile'}).click();
  await user.getByText('Profile saved.').waitFor();
  await user.reload();
  assert.equal(await user.getByLabel('Full name').inputValue(),'Review participant');

  // 10 and 11: create 2 posts, edit content and categories.
  const posts=[];
  for(let i=0;i<2;i++){
    await open(user,'/create');
    await user.locator('input[maxlength="180"]').fill('Review post '+i+' '+suffix);
    await user.locator('textarea[maxlength="50000"]').fill('Review content '+i);
    await user.locator('fieldset input[type=checkbox]').nth(i).check();
    await user.getByRole('button',{name:'Publish post'}).click();
    await user.waitForURL(/#\/post\/\d+$/);
    posts.push(Number(new URL(user.url()).hash.match(/post\/(\d+)/)[1]));
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
    assert.ok(await user.locator('.headerLogout').isVisible());
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
  await open(admin,'/post/'+posts[0]);
  const card=admin.locator('.commentCard').filter({hasText:rootReply}).first();
  await card.getByRole('button',{name:'Like',exact:true}).click();
  await card.getByRole('button',{name:'Reply',exact:true}).click();
  await card.getByLabel('Reply').fill('Admin replied '+suffix);
  await card.getByRole('button',{name:'Post reply'}).click();
  await admin.getByText('Admin replied '+suffix).waitFor();
  await user.reload();
  const answer=user.locator('.commentCard').filter({hasText:'Admin replied '+suffix}).first();
  await answer.getByRole('button',{name:'Dislike',exact:true}).click();
  await answer.getByRole('button',{name:'Remove my vote'}).click();
  await admin.reload();
  const adminCard=admin.locator('.commentCard').filter({hasText:rootReply}).first();
  await adminCard.getByRole('button',{name:'Deactivate'}).click();
  await adminCard.getByRole('button',{name:'Activate'}).click();

  // 16: admin updates first user.
  await open(admin,'/admin');
  const row=admin.locator('tr').filter({has:admin.getByRole('textbox',{name:'Login for '+name})});
  await row.getByRole('textbox',{name:'Full name for '+name}).fill('Admin edited member');
  await row.getByRole('button',{name:'Save'}).click();

  // 17: author edits their own content, but not other users or admin.
  await open(user,'/edit/'+posts[0]);
  await user.locator('textarea[maxlength="50000"]').fill('Last user change');
  await user.getByRole('button',{name:'Save changes'}).click();
  await user.waitForURL(/#\/post\/\d+$/);
  assert.equal((await fetchApi('/posts/'+posts[0])).data.content,'Last user change');

  // 18: admin adds a category; 19: admin deletes other's comment.
  await open(admin,'/admin');
  await admin.locator('.tabs').getByRole('button',{name:'categories'}).click();
  const categoryName='Review category '+suffix;
  await admin.locator('form').filter({hasText:'Create category'}).getByLabel('Title').fill(categoryName);
  await admin.getByRole('button',{name:'Create category'}).click();
  await admin.getByText(categoryName).waitFor();
  await open(user,'/create');
  await user.getByText(categoryName).waitFor();
  await open(admin,'/post/'+posts[0]);
  admin.once('dialog',dialog=>dialog.accept());
  await admin.locator('.commentCard').filter({hasText:rootReply}).first()
    .getByRole('button',{name:'Delete'}).click();
  await admin.getByText(rootReply).waitFor({state:'detached'});

  // 20: logout.
  await user.locator('.headerLogout').click();
  await user.locator('.headerLogout').waitFor({state:'detached'});
  console.log('Defense rehearsal passed: all 20 review steps and two isolated browser sessions.');
} finally {
  await browser.close();
}
