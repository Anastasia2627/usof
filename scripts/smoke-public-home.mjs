import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('http://localhost:5173/#/',{waitUntil:'networkidle'});
  await page.locator('.threadCard').first().waitFor();
  assert.ok(await page.locator('.headerSearch').isVisible(),'Search is visible to guests');
  assert.ok(await page.locator('.mainNav').isVisible(),'Navigation is visible to guests');
  const posts=await fetch('http://localhost:5173/api/posts?sort=likes&order=desc&limit=8').then(r=>r.json());
  assert.equal(await page.locator('.threadCard .postTitleLink').first().innerText(),posts.data[0].title);
  await page.locator('.filterDetails summary').click();
  await page.getByLabel('Sort by').selectOption('date');
  await page.getByLabel('Sort direction').selectOption('asc');
  await page.getByRole('button',{name:'Apply filters'}).click();
  await page.waitForURL(/order=asc/);
  for(const width of [390,768,1280]){
    await page.setViewportSize({width,height:800});
    assert.ok(await page.locator('.mainNav').isVisible());
  }
  console.log('Public home: posts, default sort, date filters, search, nav and responsive UI passed');
}finally{await browser.close();}
