import crypto from 'node:crypto';
import { pool } from '../config/db.js';

/*
 * Post images cannot be served with the same unrestricted static middleware
 * as profile avatars: a saved URL must not reveal a draft or removed post.
 *
 * For images of private posts, the authorized API response contains a
 * short-lived signed capability URL. Access is checked AGAIN at request time.
 * Do not log, cache or store these capability URLs.
 */
const MEDIA_TTL_SECONDS = 5 * 60;
const MEDIA_FILENAME = /^[a-f0-9-]{36}\.webp$/i;

function signingKey() {
  return process.env.AUTH_SECRET || 'development-only-secret-change-me';
}

function signature(filename, viewerId, expires) {
  return crypto.createHmac('sha256', signingKey())
    .update('circle-post-image:v1\n' + filename + '\n' + viewerId + '\n' + expires)
    .digest('hex');
}

export function publicPostMedia(post, now = Date.now()) {
  if (post?.status !== 'active') return false;
  const time = post.publish_at == null ? null : new Date(post.publish_at).getTime();
  return time === null || (Number.isFinite(time) && time <= now);
}

export function permittedPrivateMedia(post, viewer) {
  if (!viewer?.sub || !viewer.email_verified || viewer.banned_at) return false;
  if (Number(viewer.sub) === Number(post.author_id)) return true;
  if (viewer.role === 'admin') return true;
  return viewer.role === 'moderator' && (
    post.publish_at == null || new Date(post.publish_at).getTime() <= Date.now()
  );
}

export function signedMediaUrl(filename, viewerId, now = Date.now()) {
  const expires = Math.floor(now / 1000) + MEDIA_TTL_SECONDS;
  const id = Number(viewerId);
  if (!MEDIA_FILENAME.test(filename) || !Number.isSafeInteger(id) || id < 1) {
    throw new Error('Invalid post media capability');
  }
  const qs = new URLSearchParams({
    uid: String(id), exp: String(expires), sig: signature(filename,id,expires),
  });
  return '/uploads/posts/' + filename + '?' + qs.toString();
}

export function preparePostMedia(post, viewer) {
  if (!post?.images?.length || publicPostMedia(post)) return post;
  if (!permittedPrivateMedia(post,viewer)) {
    // Do not expose file names to clients not permitted to see a private post
    return {...post, images:[]};
  }
  return {
    ...post,
    images:post.images.map(image=>({
      ...image,
      url:signedMediaUrl(String(image.url).split('/').pop().split('?')[0],viewer.sub),
    })),
  };
}

export async function requireVisiblePostMedia(req,res,next) {
  // We only serve recorded, validated post images — no arbitrary file paths
  const filename = String(req.path || '').replace(/^\//,'');
  if (!['GET','HEAD'].includes(req.method) || !MEDIA_FILENAME.test(filename)) {
    res.status(404).end();
    return;
  }
  try {
    const [rows] = await pool.execute(
      `SELECT p.author_id,p.status,p.publish_at
       FROM post_images i JOIN posts p ON p.id=i.post_id
       WHERE i.filename=? LIMIT 1`,
      [filename],
    );
    const post = rows[0];
    if (!post) {res.status(404).end();return;}
    if (!publicPostMedia(post)) {
      const uid = Number(req.query?.uid);
      const exp = Number(req.query?.exp);
      const sig = String(req.query?.sig || '');
      const now = Math.floor(Date.now()/1000);
      if (!Number.isSafeInteger(uid) || uid<1 ||
          !Number.isSafeInteger(exp) || exp < now || exp > now+MEDIA_TTL_SECONDS ||
          !/^[a-f0-9]{64}$/i.test(sig)) {
        res.status(404).end();return;
      }
      const expected = Buffer.from(signature(filename,uid,exp),'hex');
      const supplied = Buffer.from(sig,'hex');
      if (expected.length!==supplied.length || !crypto.timingSafeEqual(expected,supplied)) {
        res.status(404).end();return;
      }
      const [people] = await pool.execute(
        'SELECT id AS sub,role,email_verified,banned_at FROM users WHERE id=? LIMIT 1',
        [uid],
      );
      if (!permittedPrivateMedia(post,people[0])) {
        res.status(404).end();return;
      }
    }
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    next();
  } catch(error) {next(error);}
}
