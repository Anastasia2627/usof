import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';
import { getVisiblePost } from '../services/postService.js';
import { addPostImage,deletePostImage } from '../services/postImageService.js';
import { createReport } from '../services/reportService.js';
import { pool } from '../config/db.js';

export async function setSolution(req,res) {
  const post=await getVisiblePost(req.params.post_id,req.user);
  if(Number(post.author_id)!==Number(req.user.sub))
    throw new AppError(403,'OWNER_REQUIRED','Only the author can choose the best answer');
  const commentId=req.body.commentId===null ? null :
    positiveInt(req.body.commentId,'INVALID_COMMENT','Provide commentId or null');
  const db=await pool.getConnection();
  try{
    await db.beginTransaction();
    const [[freshPost]]=await db.execute(
      'SELECT id,author_id FROM posts WHERE id=? FOR UPDATE',[post.id],
    );
    if(!freshPost||Number(freshPost.author_id)!==Number(req.user.sub))
      throw new AppError(403,'OWNER_REQUIRED','Only the author can choose the best answer');
    if(commentId!==null){
      const [[answer]]=await db.execute(
        'SELECT id,post_id,status FROM comments WHERE id=? FOR UPDATE',[commentId],
      );
      if(!answer||Number(answer.post_id)!==Number(post.id)||answer.status!=='active')
        throw new AppError(422,'INVALID_SOLUTION','Select an active reply on this post');
    }
    await db.execute('UPDATE posts SET accepted_comment_id=? WHERE id=?',[commentId,post.id]);
    await db.commit();
  }catch(error){await db.rollback();throw error;}
  finally{db.release();}
  res.json({data:await getVisiblePost(post.id,req.user)});
}
export async function uploadImage(req,res) {
  res.status(201).json({data:await addPostImage(req.user,req.params.post_id,req.file)});
}
export async function removeImage(req,res) {
  await deletePostImage(req.user,req.params.post_id,req.params.image_id);
  res.status(204).end();
}
export async function reportPost(req,res) {
  const post=await getVisiblePost(req.params.post_id,req.user);
  res.status(201).json({data:await createReport(req.user,{
    postId:post.id,targetAuthorId:post.author_id,reason:req.body.reason,details:req.body.details,recommendBan:req.body.recommendBan,
  })});
}
