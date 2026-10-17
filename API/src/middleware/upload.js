import multer from 'multer';

export const postImageUpload = multer({
  storage:multer.memoryStorage(),
  limits:{files:1,fileSize:5*1024*1024,fields:2},
});
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 3 * 1024 * 1024,
    fields: 4,
  },
});
