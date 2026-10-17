import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';
import { getVisiblePost } from '../services/postService.js';
import { getVisibleComment } from '../services/commentService.js';
import { addPostImage,deletePostImage } from '../services/postImageService.js';
import { createReport } from '../services/reportService.js';
import { pool } from '../config/db.js';

export async function setSolution(req,res) {
  const post=await getVisiblePost(req.params.post_id,req.user);
  if(Number(post.author_id)!==Number(req.user.sub))
    throw new AppError(403,'OWNER_REQUIRED','Only the author can choose the best answer');
  let commentId=null;
  if(req.body.commentId!==null) {
    commentId=positiveInt(req.body.commentId,'INVALID_COMMENT','Provide commentId or null');
    const comment=await getVisibleComment(commentId,req.user);
    if(Number(comment.post_id)!==Number(post.id)||comment.status!=='active')
      throw new AppError(422,'INVALID_SOLUTION','Select an active reply on this post');
  }
  await pool.execute('UPDATE posts SET accepted_comment_id=? WHERE id=?',[commentId,post.id]);
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
    postId:post.id,targetAuthorId:post.author_id,reason:req.body.reason,details:req.body.details,
  })});
}
