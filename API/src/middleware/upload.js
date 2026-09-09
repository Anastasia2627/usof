import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../utils/AppError.js';

const MIME_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: path.resolve('API/uploads/avatars'),
  filename: (req, file, callback) => {
    const extension = MIME_EXTENSIONS[file.mimetype] || '';
    const filename = `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`;
    callback(null, filename);
  },
});

export const avatarUpload = multer({
  storage,
  limits: {
    files: 1,
    fileSize: 3 * 1024 * 1024,
  },
  fileFilter: (req, file, callback) => {
    if (!MIME_EXTENSIONS[file.mimetype]) {
      return callback(
        new AppError(422, 'INVALID_FILE', 'Avatar must be JPEG, PNG, or WEBP'),
      );
    }
    callback(null, true);
  },
});
