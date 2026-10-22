import { pool } from '../config/db.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Post } from '../models/Post.js';
import { preparePostMedia } from './postMediaAccess.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt, validateStatus } from '../utils/validation.js';
import { recalculateAllRatings } from './reactionService.js';
import { notifyPostFollowers } from './notificationService.js';
import { assertMayModerateAuthors } from './moderationPolicy.js';

const SORT_COLUMNS = {
  likes: 'like_count',
  date: 'COALESCE(p.publish_at, p.created_at)',
  trending: 'trend_score',
};

function normalizeCategories(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(422, 'CATEGORIES_REQUIRED', 'At least one category is required');
  }
  const ids = [...new Set(value.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    throw new AppError(422, 'INVALID_CATEGORY', 'Category IDs must be positive integers');
  }
  return ids;
}

function normalizePostText(title, content) {
  if (typeof title !== 'string' || typeof content !== 'string') {
    throw new AppError(422, 'VALIDATION_ERROR', 'title and content must be strings');
  }
  const cleanTitle = title.trim();
  const cleanContent = content.trim();
  if (!cleanTitle || !cleanContent) {
    throw new AppError(422, 'VALIDATION_ERROR', 'title and content are required');
  }
  if (cleanTitle.length > 180) {
    throw new AppError(422, 'TITLE_TOO_LONG', 'title must contain at most 180 characters');
  }
  if (cleanContent.length > 50000 || Buffer.byteLength(cleanContent,'utf8') > 60000) {
    throw new AppError(422, 'CONTENT_TOO_LONG', 'content must contain at most 50000 characters and fit in 60000 UTF-8 bytes');
  }
  return { title: cleanTitle, content: cleanContent };
}

function parseDate(value, field) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new AppError(422, 'INVALID_DATE', `${field} must be a valid date`);
  }
  return timestamp;
}

function endExclusiveForDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  const next = new Date(`${value}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 19).replace('T', ' ');
}

async function assertCategoriesExist(connection, ids) {
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await connection.query(`SELECT id FROM categories WHERE id IN (${placeholders})`, ids);
  if (rows.length !== ids.length) {
    throw new AppError(422, 'INVALID_CATEGORY', 'One or more categories do not exist');
  }
}

const elevated = user => ['admin','moderator'].includes(user?.role);
const isScheduled = post => Boolean(post.publish_at && new Date(post.publish_at).getTime() > Date.now());
function hideCounts(post,user) {
  if (post.hide_likes && !elevated(user) && Number(user?.sub) !== Number(post.author_id))
    return preparePostMedia({...post,like_count:null,dislike_count:null,score:null},user);
  return preparePostMedia(post,user);
}
function publishDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError(422,'INVALID_PUBLISH_DATE','Invalid publication date');
  const max = Date.now()+365*24*3600000;
  if (date.getTime() > max) throw new AppError(422,'INVALID_PUBLISH_DATE','Cannot schedule more than one year ahead');
  return date.toISOString().slice(0,19).replace('T',' ');
}

// A content-based revision catches edits even when MySQL TIMESTAMP values
// are unchanged within the same second, without requiring a schema migration
export function postRevision(post) {
  const categories=(post.categories||[])
    .map(item=>Number(typeof item==='object'?item.id:item))
    .sort((a,b)=>a-b);
  return crypto.createHash('sha256').update(JSON.stringify([
    post.title,post.content,post.status,
    Boolean(post.locked),Boolean(post.closed),Boolean(post.hide_likes),
    post.publish_at ? new Date(post.publish_at).toISOString() : null,
    categories,
  ])).digest('hex');
}

export async function getVisiblePost(idValue, user) {
  const id = positiveInt(idValue, 'INVALID_POST_ID', 'Invalid post id');
  const post = await Post.findById(id);
  if (!post) throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  const isOwner = user && Number(user.sub) === Number(post.author_id);
  if (((post.status === 'inactive' && !elevated(user)) ||
      (isScheduled(post) && user?.role !== 'admin')) && !isOwner) {
    throw new AppError(404, 'POST_NOT_FOUND', 'Post not found');
  }
  return {...hideCounts(post,user),revision:postRevision(post)};
}

export async function listPostFeed(query, user) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  const wantsPersonalization = query.personalized === '1' && Boolean(user?.sub) && !query.category;
  // Personalization is a ranking boost, not a restrictive filter: all posts remain discoverable.
  // The parameterized EXISTS clause checks the interests saved for the signed-in user.
  const sort = wantsPersonalization
    ? `(CASE WHEN EXISTS (
        SELECT 1 FROM post_categories preferred_pc
        JOIN user_interests preferred_ui ON preferred_ui.category_id=preferred_pc.category_id
        WHERE preferred_pc.post_id=p.id AND preferred_ui.user_id=?
      ) THEN 1 ELSE 0 END) DESC, like_count`
    : (SORT_COLUMNS[query.sort] || SORT_COLUMNS.likes);
  const sortParams = wantsPersonalization ? [Number(user.sub)] : [];
  const order = wantsPersonalization ? 'DESC' :
    (String(query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC');
  const where = [];
  const params = [];

  if (user?.role === 'moderator') {
    // Moderation of already-published content is allowed, private scheduled
    // drafts of other authors are not visible even to moderators.
    where.push('(p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP() OR p.author_id=?)');
    params.push(Number(user.sub));
  } else if (!elevated(user)) {
    if (user) {
      where.push("((p.status='active' AND (p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP())) OR p.author_id=?)");
      params.push(Number(user.sub));
    } else {
      where.push("p.status='active' AND (p.publish_at IS NULL OR p.publish_at<=UTC_TIMESTAMP())");
    }
  }

  if (query.status) {
    where.push('p.status=?');
    params.push(validateStatus(query.status));
  }
  if (query.author) {
    where.push('p.author_id=?');
    params.push(positiveInt(query.author, 'INVALID_AUTHOR_ID', 'Invalid author id'));
  }

  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from !== null && to !== null && from > to) {
    throw new AppError(422, 'INVALID_DATE_RANGE', 'from must be earlier than or equal to to');
  }
  if (query.from) {
    where.push('COALESCE(p.publish_at,p.created_at)>=?');
    params.push(query.from);
  }
  if (query.to) {
    const exclusiveEnd = endExclusiveForDateOnly(query.to);
    if (exclusiveEnd) {
      where.push('COALESCE(p.publish_at,p.created_at)<?');
      params.push(exclusiveEnd);
    } else {
      where.push('COALESCE(p.publish_at,p.created_at)<=?');
      params.push(query.to);
    }
  }
  if (query.category) {
    where.push('EXISTS(SELECT 1 FROM post_categories fpc WHERE fpc.post_id=p.id AND fpc.category_id=?)');
    params.push(positiveInt(query.category, 'INVALID_CATEGORY_ID', 'Invalid category id'));
  }
  if (query.search) {
    const search = String(query.search).trim().slice(0, 120);
    if (search) {
      where.push(`(p.title LIKE ? OR p.content LIKE ? OR u.login LIKE ? OR EXISTS (
        SELECT 1 FROM post_categories spc JOIN categories sc ON sc.id=spc.category_id
        WHERE spc.post_id=p.id AND sc.title LIKE ?
      ))`);
      const term = `%${search.replace(/[\\%_]/g, '')}%`;
      params.push(term, term, term, term);
    }
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { posts, total } = await Post.list({
    clause,
    params,
    sort,
    order,
    sortParams,
    limit,
    offset: (page - 1) * limit,
  });
  return {
    data: posts.map(post=>hideCounts(post,user)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createPostForUser(user, body) {
  const { title, content } = normalizePostText(body.title, body.content);
  const categories = normalizeCategories(body.categories);
  const connection = await pool.getConnection();
  let postId;
  try {
    await connection.beginTransaction();
    await assertCategoriesExist(connection, categories);
    const scheduled = publishDate(body.publishAt);
    if (body.hideLikes !== undefined && typeof body.hideLikes !== 'boolean')
      throw new AppError(422, 'INVALID_HIDDEN_LIKES', 'hideLikes must be boolean');
    const [result] = await connection.query(
      "INSERT INTO posts(author_id,title,content,status,locked,hide_likes,publish_at) VALUES(?,?,?,'active',0,?,?)",
      [Number(user.sub), title, content, body.hideLikes ? 1 : 0, scheduled],
    );
    postId = Number(result.insertId);
    for (const categoryId of categories) {
      await connection.query(
        'INSERT INTO post_categories(post_id,category_id) VALUES(?,?)',
        [postId, categoryId],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return getVisiblePost(postId, user);
}

export async function updatePostForUser(user, idValue, body) {
  const post=await getVisiblePost(idValue,user);
  const isAdmin=elevated(user);
  const isOwner=Number(user.sub)===Number(post.author_id);
  if(!isAdmin&&!isOwner)
    throw new AppError(403,'FORBIDDEN','Only the owner or an admin can update this post');
  if(post.locked&&!isAdmin)
    throw new AppError(423,'POST_LOCKED','This post is locked');
  if(isAdmin&&(user.role==='admin'||!isOwner)&&
     (body.title!==undefined||body.content!==undefined))
    throw new AppError(403,'POST_CONTENT_IMMUTABLE_FOR_ADMIN',
      'Admins may moderate status/categories/lock but cannot edit post title or content');
  if(!isAdmin && body.locked!==undefined)
    throw new AppError(403,'ADMIN_REQUIRED','Only admins can lock posts');
  // A member may deactivate their own post, but cannot reactivate
  // content removed by moderation (only an admin can do that)
  if(!isAdmin && body.status!==undefined && body.status!=='inactive')
    throw new AppError(403,'ADMIN_REQUIRED','Only admins can reactivate posts');
  if(body.closed!==undefined) {
    if(!isOwner&&!isAdmin)
      throw new AppError(403,'FORBIDDEN','Only the post owner or a moderator can close discussion');
    if(typeof body.closed!=='boolean')
      throw new AppError(422,'INVALID_CLOSED','closed must be boolean');
  }
  if(body.locked!==undefined&&typeof body.locked!=='boolean')
    throw new AppError(422,'INVALID_LOCKED','locked must be boolean');
  if(body.hideLikes!==undefined) {
    if(!isOwner) throw new AppError(403,'FORBIDDEN','Only the post owner can hide likes');
    if(typeof body.hideLikes!=='boolean')
      throw new AppError(422,'INVALID_HIDDEN_LIKES','hideLikes must be boolean');
  }
  if(body.publishAt!==undefined&&!isOwner)
    throw new AppError(403,'FORBIDDEN','Only the post owner can reschedule');
  if(body.categories!==undefined&&user.role==='moderator'&&!isOwner)
    throw new AppError(403,'ADMIN_REQUIRED','Moderators cannot change another author\'s categories');
  const categories=body.categories!==undefined?normalizeCategories(body.categories):null;
  const expectedRevision=body.revision;
  if(expectedRevision!==undefined&&expectedRevision!==null&&
     (typeof expectedRevision!=='string'||!/^[a-f0-9]{64}$/.test(expectedRevision)))
    throw new AppError(422,'INVALID_REVISION','Invalid post revision');

  const connection=await pool.getConnection();
  let changedForFollowers=false;
  let finalStatus='inactive';
  try {
    await connection.beginTransaction();
    const [[fresh]]=await connection.execute(
      `SELECT id,author_id,title,content,status,locked,closed,hide_likes,publish_at
       FROM posts WHERE id=? FOR UPDATE`,[post.id],
    );
    if(!fresh) throw new AppError(404,'POST_NOT_FOUND','Post not found');
    if(!isAdmin&&Number(fresh.author_id)!==Number(user.sub))
      throw new AppError(403,'FORBIDDEN','Only the owner or an admin can update this post');
    if(fresh.locked&&!isAdmin)
      throw new AppError(423,'POST_LOCKED','This post is locked');
    if(user.role==='moderator'&&!isOwner)
      await assertMayModerateAuthors(user,[fresh.author_id],connection);

    // Read categories after locking the parent; all category changes serialize
    // through the same post row
    const [currentCategories]=await connection.execute(
      'SELECT category_id AS id FROM post_categories WHERE post_id=? ORDER BY category_id',
      [post.id],
    );
    if(expectedRevision && expectedRevision!==postRevision({
      ...fresh,categories:currentCategories,
    })) {
      throw new AppError(409,'POST_EDIT_CONFLICT',
        'This post changed since you opened it. Reload before saving your edits');
    }
    const updatedTitle=body.title!==undefined||body.content!==undefined
      ?normalizePostText(body.title??fresh.title,body.content??fresh.content):null;
    const fields=[];
    const values=[];
    const set=(name,value)=>{fields.push(name+'=?');values.push(value);};
    if(updatedTitle?.title!==undefined&&updatedTitle.title!==fresh.title)
      set('title',updatedTitle.title);
    if(updatedTitle?.content!==undefined&&updatedTitle.content!==fresh.content)
      set('content',updatedTitle.content);
    if(body.status!==undefined){
      const status=validateStatus(body.status);
      if(!isAdmin && (Number(user.sub)!==Number(fresh.author_id)||status!=='inactive'))
        throw new AppError(403,'ADMIN_REQUIRED','Only admins can change another post status or reactivate posts');
      if(status!==fresh.status)set('status',status);
    }
    if(body.locked!==undefined&&isAdmin&&Number(fresh.locked)!==Number(body.locked))
      set('locked',body.locked?1:0);
    if(body.closed!==undefined&&Number(fresh.closed)!==Number(body.closed))
      set('closed',body.closed?1:0);
    if(body.hideLikes!==undefined&&Number(fresh.hide_likes)!==Number(body.hideLikes))
      set('hide_likes',body.hideLikes?1:0);
    if(body.publishAt!==undefined) {
      const date=publishDate(body.publishAt);
      const original=fresh.publish_at
        ?new Date(fresh.publish_at).toISOString().slice(0,19).replace('T',' '):null;
      if(date!==original)set('publish_at',date);
    }
    const categoryIds=currentCategories.map(item=>Number(item.id));
    const categoryChanged=categories!==null&&(
      categories.length!==categoryIds.length||
      categories.some(id=>!categoryIds.includes(id))
    );
    if(categoryChanged)await assertCategoriesExist(connection,categories);
    if(fields.length){
      await connection.execute(
        'UPDATE posts SET '+fields.join(',')+' WHERE id=?',
        [...values,post.id],
      );
    }
    if(categoryChanged){
      await connection.execute('DELETE FROM post_categories WHERE post_id=?',[post.id]);
      for(const id of categories)
        await connection.execute(
          'INSERT INTO post_categories(post_id,category_id) VALUES(?,?)',
          [post.id,id],
        );
    }
    changedForFollowers=isOwner&&user.role!=='admin'&&(
      fields.some(field=>field==='title=?'||field==='content=?')||categoryChanged
    );
    finalStatus=body.status!==undefined?body.status:fresh.status;
    if(changedForFollowers&&finalStatus==='active')
      await notifyPostFollowers({
        postId:Number(post.id),actorId:Number(user.sub),type:'post_updated',
      },connection);
    await connection.commit();
  } catch(error) {
    await connection.rollback();
    throw error;
  } finally {connection.release();}

  return getVisiblePost(post.id,user);
}

export async function deletePostForUser(user, idValue) {
  const post=await getVisiblePost(idValue,user);
  if(!elevated(user)&&Number(user.sub)!==Number(post.author_id))
    throw new AppError(403,'FORBIDDEN','Cannot delete this post');

  const connection=await pool.getConnection();
  let photos=[];
  try {
    await connection.beginTransaction();
    // Lock before listing media so a concurrent image upload cannot leave
    // untracked files behind when this post is removed
    const [[fresh]]=await connection.execute(
      'SELECT id,author_id FROM posts WHERE id=? FOR UPDATE',[post.id],
    );
    if(!fresh)throw new AppError(404,'POST_NOT_FOUND','Post not found');
    if(!elevated(user)&&Number(user.sub)!==Number(fresh.author_id))
      throw new AppError(403,'FORBIDDEN','Cannot delete this post');
    if(user.role==='moderator'&&Number(user.sub)!==Number(fresh.author_id))
      await assertMayModerateAuthors(user,[fresh.author_id],connection);
    const [images]=await connection.execute(
      'SELECT filename FROM post_images WHERE post_id=?',[post.id],
    );
    photos=images;
    await connection.execute('DELETE FROM posts WHERE id=?',[post.id]);
    await recalculateAllRatings(connection);
    await connection.commit();
  } catch(error) {
    await connection.rollback();
    throw error;
  } finally {connection.release();}
  // Disk cleanup follows the committed delete; filesystem errors cannot
  // undo a successful database transaction
  for(const photo of photos)
    await fs.unlink(path.resolve('API/uploads/posts',path.basename(photo.filename)))
      .catch(()=>{});
}
