import express from 'express';import cors from 'cors';import path from 'path';import dotenv from 'dotenv';
import authRoutes from './src/routes/authRoutes.js';import userRoutes from './src/routes/userRoutes.js';import postRoutes from './src/routes/postRoutes.js';import categoryRoutes from './src/routes/categoryRoutes.js';import commentRoutes from './src/routes/commentRoutes.js';import {errorHandler,notFound} from './src/middleware/errorHandler.js';
dotenv.config();
const app=express();
app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173'}));app.use(express.json({limit:'1mb'}));app.use('/uploads',express.static(path.resolve('API/uploads')));
app.get('/api/health',(req,res)=>res.json({status:'ok'}));app.use('/api/auth',authRoutes);app.use('/api/users',userRoutes);app.use('/api/posts',postRoutes);app.use('/api/categories',categoryRoutes);app.use('/api/comments',commentRoutes);app.use(notFound);app.use(errorHandler);export default app;
