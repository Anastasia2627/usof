import test from 'node:test';
import assert from 'node:assert/strict';
import {
  publicPostMedia,
  permittedPrivateMedia,
  preparePostMedia,
  signedMediaUrl,
  validMediaTicket,
} from '../API/src/services/postMediaAccess.js';

const author={sub:13,role:'user',email_verified:true,banned_at:null};
const admin={sub:2,role:'admin',email_verified:true,banned_at:null};
const moderator={sub:3,role:'moderator',email_verified:true,banned_at:null};
const guest={sub:99,role:'user',email_verified:true,banned_at:null};
const filename='4f548512-1aa2-4aae-86a3-86aa32911629.webp';
const now=Date.parse('2026-10-22T12:00:00Z');
const future=new Date('2099-01-01T00:00:00Z');
const past=new Date('2000-01-01T00:00:00Z');

test('public media is served only for active, published posts',()=>{
  assert.equal(publicPostMedia({status:'active',publish_at:null},now),true);
  assert.equal(publicPostMedia({status:'active',publish_at:past},now),true);
  assert.equal(publicPostMedia({status:'inactive',publish_at:null},now),false);
  assert.equal(publicPostMedia({status:'active',publish_at:future},now),false);
});

test('private media is limited to permitted and verified viewers',()=>{
  const scheduled={author_id:13,status:'active',publish_at:future};
  const hidden={author_id:13,status:'inactive',publish_at:past};
  assert.equal(permittedPrivateMedia(scheduled,author),true);
  assert.equal(permittedPrivateMedia(scheduled,admin),true);
  assert.equal(permittedPrivateMedia(scheduled,moderator),false);
  assert.equal(permittedPrivateMedia(hidden,moderator),true);
  assert.equal(permittedPrivateMedia(hidden,guest),false);
  assert.equal(permittedPrivateMedia(hidden,{...author,email_verified:false}),false);
  assert.equal(permittedPrivateMedia(hidden,{...author,banned_at:past}),false);
});

test('ticket expires and rejects other users, filenames and changed signatures',()=>{
  const url=new URL(signedMediaUrl(filename,13,now),'http://localhost');
  const exp=url.searchParams.get('exp');
  const sig=url.searchParams.get('sig');
  assert.equal(validMediaTicket(filename,13,exp,sig,now),true);
  assert.equal(validMediaTicket(filename,13,exp,sig,now+301000),false);
  assert.equal(validMediaTicket(filename,14,exp,sig,now),false);
  assert.equal(validMediaTicket('other-file.webp',13,exp,sig,now),false);
  assert.equal(validMediaTicket(filename,13,exp,'a'.repeat(64),now),false);
  assert.match(signedMediaUrl('seed-image-1.webp',13,now),/seed-image-1\.webp/);
  assert.throws(()=>signedMediaUrl('../secrets.webp',13,now));
  assert.throws(()=>signedMediaUrl('not-an-image.svg',13,now));
});

test('private media URLs are issued only to authorized readers',()=>{
  const post={
    author_id:13,status:'inactive',publish_at:null,
    images:[{id:4,url:'/uploads/posts/'+filename}],
  };
  assert.equal(preparePostMedia(post,null).images.length,0);
  assert.equal(preparePostMedia(post,guest).images.length,0);
  assert.equal(preparePostMedia(post,author).images.length,1);
  assert.match(preparePostMedia(post,author).images[0].url,/sig=[a-f0-9]{64}/);
  assert.equal(
    preparePostMedia({...post,status:'active'},null).images[0].url,
    '/uploads/posts/'+filename,
  );
});
