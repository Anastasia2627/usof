import { Router } from 'express';
import * as controller from '../controllers/categoriesController.js';
import {submitSuggestion,mySuggestions,suggestionsForAdmin,reviewSuggestion} from '../services/categorySuggestionService.js';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

// Place named routes before /:category_id so that 'suggestions' never binds as an ID.
router.post('/suggestions', requireAuth, async (req,res,next)=>{
  try{res.status(201).json({data:await submitSuggestion(req.body,req.user)});}catch(err){next(err);}
});
router.get('/suggestions/mine', requireAuth, async (req,res,next)=>{
  try{res.json({data:await mySuggestions(req.user)});}catch(err){next(err);}
});
router.get('/suggestions', requireAuth, requireAdmin, async (req,res,next)=>{
  try{res.json({data:await suggestionsForAdmin(req.query.status||'pending')});}catch(err){next(err);}
});
router.patch('/suggestions/:id', requireAuth, requireAdmin, async (req,res,next)=>{
  try{res.json({data:await reviewSuggestion(req.params.id,req.body?.status,req.user)});}catch(err){next(err);}
});
router.get('/', controller.listCategories);
router.get('/:category_id', controller.getCategory);
router.get('/:category_id/posts', optionalAuth, controller.postsByCategory);
router.post('/', requireAuth, requireAdmin, controller.createCategory);
router.patch('/:category_id', requireAuth, requireAdmin, controller.updateCategory);
router.delete('/:category_id', requireAuth, requireAdmin, controller.deleteCategory);

export default router;
