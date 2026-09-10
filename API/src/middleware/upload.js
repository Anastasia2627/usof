import multer from 'multer';

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 3 * 1024 * 1024,
    fields: 4,
  },
});
