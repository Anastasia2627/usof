import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';
import { positiveInt } from '../utils/validation.js';
import { createNotification, deliverNotifications } from './notificationService.js';

function cleaned(value, limit, name, required = false) {
  const text = String(value ?? '').trim();
  if (text.length > limit || (required && text.length < 5))
    throw new AppError(422, 'INVALID_BAN_FIELD', name + ' must be between ' + (required ? 5 : 0) + ' and ' + limit + ' characters');
  return text;
}

export async function restrictAccount(targetId, actor, body) {
  const id = positiveInt(targetId, 'INVALID_USER_ID', 'Invalid user id');
  if (actor.role !== 'admin') throw new AppError(403, 'ADMIN_REQUIRED', 'Admin access required');
  if (Number(actor.sub) === id) throw new AppError(403, 'SELF_BAN_FORBIDDEN', 'You cannot block your own account');
  const reason = cleaned(body?.reason, 500, 'Official reason', true);
  const note = cleaned(body?.internalNote, 2000, 'Internal note');
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [[user]] = await db.execute('SELECT id, role, banned_at FROM users WHERE id=? FOR UPDATE', [id]);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    if (user.role === 'admin') throw new AppError(403, 'ADMIN_PROTECTED', 'Administrators cannot be banned');
    if (user.banned_at) throw new AppError(409, 'ALREADY_BANNED', 'User is already blocked');
    await db.execute('UPDATE users SET banned_at=NOW(), ban_reason=?, ban_internal_note=?, banned_by=? WHERE id=?',
      [reason, note || null, Number(actor.sub), id]);
    await db.commit();
    return { data: { id, banned: true } };
  } catch (error) { await db.rollback(); throw error; } finally { db.release(); }
}

export async function liftRestriction(targetId, actor) {
  const id = positiveInt(targetId, 'INVALID_USER_ID', 'Invalid user id');
  if (actor.role !== 'admin') throw new AppError(403, 'ADMIN_REQUIRED', 'Admin access required');
  const [result] = await pool.execute(
    'UPDATE users SET banned_at=NULL, ban_reason=NULL, ban_internal_note=NULL, banned_by=NULL WHERE id=? AND banned_at IS NOT NULL',
    [id],
  );
  if (!result.affectedRows) throw new AppError(404, 'ACTIVE_BAN_NOT_FOUND', 'No active restriction for this member');
  return { data: { id, banned: false } };
}

export async function getRestrictionStatus(userId) {
  const user = await User.findById(Number(userId));
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  let appeal = null;
  if (user.banned_at) {
    const [[row]] = await pool.execute(
      'SELECT id, explanation, status, created_at, review_note, reviewed_at FROM ban_appeals WHERE user_id=? AND ban_started_at=? ORDER BY id DESC LIMIT 1',
      [user.id, user.banned_at],
    );
    appeal = row || null;
  }
  return { data: { user, appeal } };
}

export async function appealRestriction(userId, body) {
  const user = await User.findById(Number(userId));
  if (!user?.banned_at) throw new AppError(409, 'NOT_BANNED', 'Your account is not blocked');
  const explanation = cleaned(body?.explanation, 4000, 'Appeal', true);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [[current]] = await db.execute(
      'SELECT banned_at, ban_reason, ban_internal_note, banned_by FROM users WHERE id=? FOR UPDATE',
      [user.id],
    );
    if (!current?.banned_at) throw new AppError(409, 'NOT_BANNED', 'Your account is not blocked');
    const [exists] = await db.execute('SELECT id FROM ban_appeals WHERE user_id=? AND ban_started_at=?', [user.id, current.banned_at]);
    if (exists.length) throw new AppError(409, 'APPEAL_ALREADY_SUBMITTED', 'An appeal for this block was already submitted');
    const [result] = await db.execute(
      'INSERT INTO ban_appeals(user_id,ban_started_at,ban_reason,ban_internal_note,banned_by,explanation) VALUES(?,?,?,?,?,?)',
      [user.id, current.banned_at, current.ban_reason || '', current.ban_internal_note, current.banned_by, explanation],
    );
    await db.commit();
    // Administrators review appeals; moderators only receive a status notice.
    // Never include the appeal's explanation, private ban note, or review controls
    // in moderator notifications.
    const [staff]=await pool.execute(
      "SELECT id,role FROM users WHERE role IN ('admin','moderator') AND banned_at IS NULL",
    );
    await deliverNotifications(staff.map(person=>()=>createNotification({
      userId:person.id,actorId:user.id,type:'ban_appeal',
      title:'New account ban appeal',
      body:person.role==='admin'
        ? 'A member appealed an account restriction. Review it in the admin center.'
        : 'A member appealed an account restriction. An administrator will review it.',
    })));
    return { data: { id: result.insertId, status: 'pending' } };
  } catch(error) { await db.rollback(); throw error; } finally { db.release(); }
}

export async function listRestrictionAppeals() {
  const [rows] = await pool.execute(
    'SELECT a.id,a.user_id,a.ban_started_at,a.ban_reason,a.ban_internal_note,a.banned_by,a.explanation,a.status,a.review_note,a.reviewed_at,a.created_at,u.login,u.email,u.banned_at FROM ban_appeals a JOIN users u ON u.id=a.user_id ORDER BY (a.status="pending") DESC,a.created_at DESC LIMIT 250',
  );
  return { data: rows };
}

export async function reviewRestrictionAppeal(appealId, actor, body) {
  const id = positiveInt(appealId, 'INVALID_APPEAL_ID', 'Invalid appeal id');
  const status = String(body?.status || '');
  if (!['approved','rejected'].includes(status)) throw new AppError(422, 'INVALID_APPEAL_STATUS', 'Choose approved or rejected');
  const reviewNote = cleaned(body?.reviewNote, 1000, 'Review note');
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [[appeal]] = await db.execute('SELECT * FROM ban_appeals WHERE id=? FOR UPDATE', [id]);
    if (!appeal) throw new AppError(404, 'APPEAL_NOT_FOUND', 'Appeal not found');
    if (appeal.status !== 'pending') throw new AppError(409, 'APPEAL_REVIEWED', 'This appeal has already been reviewed');
    if (status === 'approved') {
      // Only lift the exact ban that was appealed: a subsequent ban stays in force.
      await db.execute(
        'UPDATE users SET banned_at=NULL, ban_reason=NULL, ban_internal_note=NULL, banned_by=NULL WHERE id=? AND banned_at=?',
        [appeal.user_id, appeal.ban_started_at],
      );
    }
    await db.execute('UPDATE ban_appeals SET status=?,review_note=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?',
      [status, reviewNote || null, Number(actor.sub), id]);
    await db.commit();
    return { data: { id, status } };
  } catch(error) { await db.rollback(); throw error; } finally { db.release(); }
}
