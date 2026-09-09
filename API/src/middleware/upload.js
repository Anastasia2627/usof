import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../utils/AppError.js';

const storage = multer.diskStorage({
  destination: path.resolve('API/uploads/avatars'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

export const avatarUpload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new AppError(422, 'INVALID_FILE', 'Avatar must be JPEG, PNG, or WEBP'));
    }
    cb(null, true);
  },
});
