import { getVisibleComment } from '../services/commentService.js';
import { createReport } from '../services/reportService.js';
export async function reportComment(req,res) {
  const comment=await getVisibleComment(req.params.comment_id,req.user);
  res.status(201).json({data:await createReport(req.user,{
    commentId:comment.id,targetAuthorId:comment.author_id,reason:req.body.reason,details:req.body.details,
  })});
}
