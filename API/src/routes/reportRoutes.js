import { Router } from 'express';
import { requireAuth, requireModerator } from '../middleware/auth.js';
import { listReports, reviewReport } from '../services/reportService.js';

const router=Router();
router.get('/',requireAuth,requireModerator,async(req,res)=>res.json(await listReports(req.query)));
router.patch('/:report_id',requireAuth,requireModerator,async(req,res)=>
  res.json({data:await reviewReport(req.params.report_id,req.user,req.body.status)}));
export default router;
