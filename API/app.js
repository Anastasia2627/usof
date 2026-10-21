import path from 'path';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import authRoutes from './src/routes/authRoutes.js';
import categoryRoutes from './src/routes/categoryRoutes.js';
import commentRoutes from './src/routes/commentRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import libraryRoutes from './src/routes/libraryRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import postRoutes from './src/routes/postRoutes.js';
import socialRoutes from './src/routes/socialRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import searchRoutes from './src/routes/searchRoutes.js';
import reactionsAdminRoutes from './src/routes/reactionsAdminRoutes.js';
import reportRoutes from './src/routes/reportRoutes.js';
import { pingDatabase } from './src/config/db.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import { AppError } from './src/utils/AppError.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use((req,res,next)=>{
  req.requestId=randomUUID();
  res.setHeader('X-Request-ID',req.requestId);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  if (req.body == null) req.body = {};
  next();
});
app.use('/uploads', express.static(path.resolve('API/uploads')));

app.get('/api/health', async (req, res, next) => {
  try {
    await pingDatabase();
    res.json({ status: 'ok', features: { categorySuggestions: true, avatarCropUpload: true } });
  } catch {
    next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable'));
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reactions', reactionsAdminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
