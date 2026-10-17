import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';
import { listPostFeed } from '../services/postService.js';
import { createManagedUser, deleteAccount, updateAccount, changeAccountRole } from '../services/accountService.js';
import { replaceAvatar } from '../services/avatarService.js';

export async function listUsers(req, res) {
  res.json({ data: await User.list() });
}

export async function getUser(req, res) {
  const id = positiveInt(req.params.user_id, 'INVALID_USER_ID', 'Invalid user id');
  const isSelf = Number(req.user?.sub) === id;
  const user = req.user?.role === 'admin' || isSelf
    ? await User.findById(id)
    : await User.findPublicById(id);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  res.json({ data: user });
}

export async function listUserPosts(req, res) {
  const id = positiveInt(req.params.user_id, 'INVALID_USER_ID', 'Invalid user id');
  const person = await User.findPublicById(id);
  if (!person) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  res.json(await listPostFeed({ ...req.query, author: String(id) }, req.user));
}

export async function createUser(req, res) {
  res.status(201).json({ data: await createManagedUser(req.body) });
}

export async function updateUser(req, res) {
  res.json(await updateAccount({
    targetId: req.params.user_id,
    actor: req.user,
    body: req.body,
  }));
}

export async function updateUserRole(req,res) {
  res.json(await changeAccountRole({targetId:req.params.user_id,actor:req.user,body:req.body}));
}

export async function uploadAvatar(req, res) {
  res.json({ data: await replaceAvatar(Number(req.user.sub), req.file) });
}

export async function deleteUser(req, res) {
  await deleteAccount({ targetId: req.params.user_id, actor: req.user });
  res.status(204).end();
}
