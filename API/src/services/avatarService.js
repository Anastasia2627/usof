import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { pool } from '../config/db.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const AVATAR_DIR = path.resolve('API/uploads/avatars');
const MAX_INPUT_PIXELS = 20_000_000;
const MAX_SIDE = 8192;

export async function replaceAvatar(userId, file) {
  if (!file?.buffer?.length) {
    throw new AppError(422, 'FILE_REQUIRED', 'Avatar file is required');
  }

  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  let image;
  let metadata;
  try {
    image = sharp(file.buffer, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS });
    metadata = await image.metadata();
  } catch {
    throw new AppError(422, 'INVALID_FILE', 'Avatar must contain a valid JPEG, PNG, or WEBP image');
  }

  if (!ALLOWED_FORMATS.has(metadata.format)) {
    throw new AppError(422, 'INVALID_FILE', 'Avatar must contain a valid JPEG, PNG, or WEBP image');
  }
  if (!metadata.width || !metadata.height || metadata.width > MAX_SIDE || metadata.height > MAX_SIDE) {
    throw new AppError(422, 'INVALID_IMAGE_SIZE', 'Avatar dimensions are invalid or too large');
  }
  if (Number(metadata.pages || 1) > 1) {
    throw new AppError(422, 'ANIMATED_AVATAR_NOT_ALLOWED', 'Animated avatars are not supported');
  }

  await fs.mkdir(AVATAR_DIR, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}.webp`;
  const outputPath = path.join(AVATAR_DIR, filename);

  try {
    await image
      .rotate()
      .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(outputPath);
    await pool.execute('UPDATE users SET avatar=? WHERE id=?', [`/uploads/avatars/${filename}`, userId]);
  } catch (error) {
    await fs.unlink(outputPath).catch(() => {});
    if (error instanceof AppError) throw error;
    throw new AppError(422, 'INVALID_FILE', 'Avatar could not be decoded and saved');
  }

  if (user.avatar?.startsWith('/uploads/avatars/')) {
    const oldPath = path.join(AVATAR_DIR, path.basename(user.avatar));
    if (oldPath !== outputPath) await fs.unlink(oldPath).catch(() => {});
  }

  return User.findById(userId);
}
