import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import authRoutes from './src/routes/authRoutes.js';
import categoryRoutes from './src/routes/categoryRoutes.js';
import commentRoutes from './src/routes/commentRoutes.js';
import postRoutes from './src/routes/postRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import { pingDatabase } from './src/config/db.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import { AppError } from './src/utils/AppError.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.resolve('API/uploads')));

app.get('/api/health', async (req, res, next) => {
  try {
    await pingDatabase();
    res.json({ status: 'ok' });
  } catch {
    next(new AppError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable'));
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/comments', commentRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
