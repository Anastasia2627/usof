import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';
import { createNotification, deliverNotifications } from './notificationService.js';

const REASONS = new Set(['spam','abuse','off_topic','other']);

export async function createReport(user, { postId=null, commentId=null, targetAuthorId, reason, details='', recommendBan=false }) {
  if (Number(targetAuthorId) === Number(user.sub))
    throw new AppError(422,'SELF_REPORT','You cannot report your own content');
  if (!REASONS.has(reason))
    throw new AppError(422,'INVALID_REASON','Choose spam, abuse, off_topic or other');
  if (typeof details !== 'string' || details.length > 500)
    throw new AppError(422,'INVALID_DETAILS','Details must be at most 500 characters');
  if (recommendBan && user.role !== 'moderator') throw new AppError(403,'MODERATOR_REQUIRED','Only moderators may recommend an account ban');
  try {
    const [result] = await pool.execute(
      'INSERT INTO content_reports(reporter_id,post_id,comment_id,reason,details,recommend_ban) VALUES(?,?,?,?,?,?)',
      [user.sub,postId,commentId,reason,details.trim(),recommendBan?1:0],
    );
    const [admins]=await pool.query("SELECT id FROM users WHERE role='admin' AND banned_at IS NULL");
    await deliverNotifications(admins.map(row=>()=>createNotification({
      userId:row.id,actorId:user.sub,type:recommendBan?'ban_recommendation':'content_report',
      postId:postId||null,commentId:commentId||null,
      title:recommendBan?'Moderator recommends a ban':'New content report',
      body:recommendBan?'A moderator requested an account ban. Open reports to review the evidence.':
        'A user reported a post or comment. Open reports to review it.',
    })));
    return {id:result.insertId,status:'open'};
  } catch(error) {
    if(error.code==='ER_DUP_ENTRY')
      throw new AppError(409,'ALREADY_REPORTED','You already reported this content');
    throw error;
  }
}
export async function listReports(query) {
  const status=query.status||'open';
  if(!['open','reviewed','dismissed','all'].includes(status))
    throw new AppError(422,'INVALID_STATUS','Invalid report status');
  const limit=25,page=Math.max(1,parseInt(query.page,10)||1);
  const where=status==='all'?'':'WHERE r.status=?';
  const args=status==='all'?[]:[status];
  const [[count]]=await pool.execute('SELECT COUNT(*) AS total FROM content_reports r '+where,args);
  const [rows]=await pool.query(`SELECT r.*, u.login AS reporter_login,
      p.title AS post_title, p.author_id AS post_author_id, c.author_id AS comment_author_id, c.content AS comment_content,
      c.post_id AS comment_post_id
    FROM content_reports r
    JOIN users u ON u.id=r.reporter_id
    LEFT JOIN posts p ON p.id=r.post_id
    LEFT JOIN comments c ON c.id=r.comment_id
    ${where} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
    [...args,limit,(page-1)*limit]);
  return {data:rows,pagination:{page,limit,total:Number(count.total),totalPages:Math.ceil(count.total/limit)}};
}
export async function reviewReport(value,user,status) {
  const id=positiveInt(value,'INVALID_REPORT_ID','Invalid report ID');
  if(!['open','reviewed','dismissed'].includes(status))
    throw new AppError(422,'INVALID_STATUS','Choose open, reviewed or dismissed');
  const [result]=await pool.execute(
    'UPDATE content_reports SET status=?,resolved_by=?,resolved_at=? WHERE id=?',
    [status,status==='open'?null:user.sub,status==='open'?null:new Date(),id]);
  if(!result.affectedRows)throw new AppError(404,'REPORT_NOT_FOUND','Report not found');
  return {id,status};
}
