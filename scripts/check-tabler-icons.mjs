import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read=p=>readFileSync(path.resolve(p),'utf8');
const iconSource=read('web/src/TablerIcon.jsx');
const uiSource=read('web/src/ui.jsx');
const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.dependencies['@tabler/icons-react'],'The official Tabler React package must be installed');
assert.ok(iconSource.includes("from '@tabler/icons-react'"));
assert.ok(!uiSource.includes("from './googleIconsA.js'"));
assert.ok(!uiSource.includes('dangerouslySetInnerHTML'),'Do not re-introduce embedded icon SVG strings');

const mappingBlock=iconSource.match(/const icons = \{([\s\S]*?)\n\};/);
assert.ok(mappingBlock,'Icon mapping not found');
const names=new Set([...mappingBlock[1].matchAll(/^\s*(\w+):\s*(Icon\w+)/gm)].map(m=>m[1]));
const pages=['ui.jsx','ModeratorControl.jsx','ReportButton.jsx','pages/PostPage.jsx',
  'pages/AdminPage.jsx','pages/CategoriesPage.jsx','pages/HomePage.jsx','pages/PostEditor.jsx',
  'pages/SettingsPage.jsx','pages/ProfilePage.jsx','pages/NotificationsPage.jsx',
  'pages/DashboardPage.jsx','pages/WelcomePage.jsx','pages/InterestsPage.jsx',
  'pages/SavedPage.jsx'];
for(const name of pages){
  const source=read('web/src/'+name);
  for(const [,key] of source.matchAll(/<Icon\s+name\s*=\s*["']([^"']+)["']/g)) {
    assert.ok(names.has(key),name+': missing Tabler icon mapping for '+key);
  }
}
for(const name of ['heartFilled','dislikeFilled','bookmark','bookmarkBorder','homeFilled','bell','comment','trash','share'])
  assert.ok(names.has(name),'Missing essential Tabler icon: '+name);
assert.ok(uiSource.includes("myVote==='like'?'heartFilled':'heart'"));
assert.ok(uiSource.includes("myVote==='dislike'?'dislikeFilled':'dislike'"));
console.log('All shared icons use Tabler, without legacy Google SVGs.');
