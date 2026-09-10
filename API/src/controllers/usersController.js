import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';
import { createManagedUser, deleteAccount, updateAccount } from '../services/accountService.js';
import { replaceAvatar } from '../services/avatarService.js';

export async function listUsers(req, res) {
  res.json({ data: await User.list() });
}

export async function getUser(req, res) {
  const id = positiveInt(req.params.user_id, 'INVALID_USER_ID', 'Invalid user id');
  const user = await User.findById(id);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  res.json({ data: user });
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

export async function uploadAvatar(req, res) {
  res.json({ data: await replaceAvatar(Number(req.user.sub), req.file) });
}

export async function deleteUser(req, res) {
  await deleteAccount({ targetId: req.params.user_id, actor: req.user });
  res.status(204).end();
}
