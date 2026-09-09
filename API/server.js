import dotenv from 'dotenv';import app from './app.js';import {pingDatabase} from './src/config/db.js';
dotenv.config();const port=Number(process.env.APP_PORT||5000);
try{await pingDatabase();app.listen(port,()=>console.log(`Usof API listening on http://localhost:${port}`));}catch(error){console.error('Cannot start API: MySQL connection failed. Run npm run db:init after configuring .env.');console.error(error.message);process.exit(1);}
