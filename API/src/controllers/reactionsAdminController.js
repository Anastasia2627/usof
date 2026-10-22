import { Reaction } from '../models/Reaction.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';
import { deleteReaction } from '../services/reactionService.js';
import { assertMayModerateReaction } from '../services/moderationPolicy.js';

export async function listReactions(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const paginated=req.query.page!==undefined;
  const page=paginated?positiveInt(req.query.page,'INVALID_PAGE','Invalid page'):1;
  const offset=(page-1)*limit;
  if(!Number.isSafeInteger(offset))
    throw new AppError(422,'INVALID_PAGE','Page exceeds the supported range');
  if(!paginated){
    return res.json({ data: await Reaction.listAdmin({ limit, actor:req.user }) });
  }
  const [data,total]=await Promise.all([
    Reaction.listAdmin({limit,offset,actor:req.user}),
    Reaction.countAdmin({actor:req.user}),
  ]);
  res.json({data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}

export async function removeReaction(req, res) {
  const id = positiveInt(req.params.reaction_id, 'INVALID_REACTION_ID', 'Invalid reaction id');
  const reaction = await Reaction.findById(id);
  if (!reaction) throw new AppError(404, 'REACTION_NOT_FOUND', 'Reaction not found');
  if (req.user.role === 'moderator') await assertMayModerateReaction(req.user,reaction);
  await deleteReaction({
    userId: Number(reaction.author_id),
    ...(reaction.post_id ? { postId: Number(reaction.post_id) } : { commentId: Number(reaction.comment_id) }),
  });
  res.status(204).end();
}
