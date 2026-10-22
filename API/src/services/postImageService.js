import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pool } from '../config/db.js';
import { getVisiblePost } from './postService.js';
import { preparePostMedia } from './postMediaAccess.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';

const dir=path.resolve('API/uploads/posts');
export async function addPostImage(user,postId,file) {
  const post=await getVisiblePost(postId,user);
  if(Number(post.author_id)!==Number(user.sub))
    throw new AppError(403,'OWNER_REQUIRED','Only the author can add images');
  if(post.locked) throw new AppError(423,'POST_LOCKED','This post is locked');
  if(!file?.buffer) throw new AppError(422,'IMAGE_REQUIRED','Select an image');
  let bytes;
  try {
    const image=sharp(file.buffer,{failOn:'error',limitInputPixels:25000000});
    const meta=await image.metadata();
    if(!['jpeg','png','webp'].includes(meta.format))throw Error('Unsupported image');
    bytes=await image.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true})
      .webp({quality:82}).toBuffer();
  } catch {
    throw new AppError(422,'INVALID_IMAGE','Upload a valid JPEG, PNG or WebP image under 5 MB');
  }
  const filename=crypto.randomUUID()+'.webp',connection=await pool.getConnection();
  let written=false;
  try {
    await connection.beginTransaction();
    const [[row]]=await connection.execute('SELECT id,locked FROM posts WHERE id=? FOR UPDATE',[post.id]);
    if(!row)throw new AppError(404,'POST_NOT_FOUND','Post not found');
    if(row.locked)throw new AppError(423,'POST_LOCKED','This post is locked');
    const [[count]]=await connection.execute('SELECT COUNT(*) AS total FROM post_images WHERE post_id=?',[post.id]);
    if(Number(count.total)>=4)throw new AppError(422,'IMAGE_LIMIT','Maximum four images per post');
    await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,filename),bytes,{flag:'wx'});
    written=true;
    const [result]=await connection.execute(
      'INSERT INTO post_images(post_id,uploader_id,filename) VALUES(?,?,?)',[post.id,user.sub,filename]);
    await connection.commit();
    const image={id:result.insertId,url:'/uploads/posts/'+filename};
    return preparePostMedia({...post,images:[image]},user).images[0];
  } catch(error) {
    await connection.rollback();
    if(written)await fs.unlink(path.join(dir,filename)).catch(()=>{});
    throw error;
  } finally {connection.release();}
}
export async function deletePostImage(user,postId,imageId) {
  const post=await getVisiblePost(postId,user);
  if(Number(post.author_id)!==Number(user.sub))
    throw new AppError(403,'OWNER_REQUIRED','Only the author can remove images');
  const id=positiveInt(imageId,'INVALID_IMAGE_ID','Invalid image ID');
  const connection=await pool.getConnection();
  let filename;
  try {
    await connection.beginTransaction();
    const [[fresh]]=await connection.execute('SELECT locked FROM posts WHERE id=? FOR UPDATE',[post.id]);
    if(!fresh)throw new AppError(404,'POST_NOT_FOUND','Post not found');
    if(fresh.locked)throw new AppError(423,'POST_LOCKED','This post is locked');
    const [[img]]=await connection.execute('SELECT filename FROM post_images WHERE id=? AND post_id=?',[id,post.id]);
    if(!img)throw new AppError(404,'IMAGE_NOT_FOUND','Image not found');
    filename=img.filename;
    await connection.execute('DELETE FROM post_images WHERE id=? AND post_id=?',[id,post.id]);
    await connection.commit();
  }catch(error){await connection.rollback();throw error;}
  finally{connection.release();}
  await fs.unlink(path.join(dir,path.basename(filename))).catch(()=>{});
}
