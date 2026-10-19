import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';
import { positiveInt } from '../utils/validation.js';

const router = Router();
router.use(requireAuth);

router.get('/follows/:user_id',async(req,res)=>{
  const target=positiveInt(req.params.user_id);
  const [[row]]=await pool.execute(`SELECT COUNT(*) AS followers,
    (SELECT COUNT(*) FROM user_follows WHERE follower_id=? AND followed_id=?) AS following
    FROM user_follows WHERE followed_id=?`,
    [req.user.sub,target,target]);
  res.json({data:{followers:Number(row.followers),following:Boolean(row.following)}});
});
router.post('/follows/:user_id',async(req,res)=>{
  const target=positiveInt(req.params.user_id);
  if(target===req.user.sub)throw new AppError(422,'SELF_FOLLOW','You cannot follow yourself');
  const [[exists]]=await pool.execute('SELECT id FROM users WHERE id=?',[target]);
  if(!exists)throw new AppError(404,'USER_NOT_FOUND','User not found');
  await pool.execute('INSERT IGNORE INTO user_follows(follower_id,followed_id) VALUES(?,?)',[req.user.sub,target]);
  res.json({data:{following:true}});
});
router.delete('/follows/:user_id',async(req,res)=>{
  const target=positiveInt(req.params.user_id);
  await pool.execute('DELETE FROM user_follows WHERE follower_id=? AND followed_id=?',[req.user.sub,target]);
  res.status(204).end();
});
router.get('/following',async(req,res)=>{
  const [rows]=await pool.execute(`SELECT u.id,u.login,u.full_name,u.avatar,u.role
    FROM user_follows f JOIN users u ON u.id=f.followed_id
    WHERE f.follower_id=? ORDER BY f.created_at DESC LIMIT 200`,[req.user.sub]);
  res.json({data:rows});
});

router.get('/interests',async(req,res)=>{
  const [rows]=await pool.execute('SELECT category_id FROM user_interests WHERE user_id=? ORDER BY category_id',[req.user.sub]);
  res.json({data:rows.map(x=>Number(x.category_id))});
});
router.put('/interests',async(req,res)=>{
  const ids=req.body.categories;
  if(!Array.isArray(ids)||ids.length>40||ids.some(v=>!Number.isInteger(v)||v<1))
    throw new AppError(422,'INVALID_INTERESTS','Choose valid category IDs');
  const selected=[...new Set(ids)];
  const connection=await pool.getConnection();
  try {
    await connection.beginTransaction();
    if(selected.length){
      const [check]=await connection.query(`SELECT id FROM categories WHERE id IN (${selected.map(()=>'?').join(',')})`,selected);
      if(check.length!==selected.length)throw new AppError(422,'INVALID_INTERESTS','Some categories do not exist');
    }
    await connection.query('DELETE FROM user_interests WHERE user_id=?',[req.user.sub]);
    for(const categoryId of selected)
      await connection.query('INSERT INTO user_interests(user_id,category_id) VALUES(?,?)',[req.user.sub,categoryId]);
    await connection.commit();
  } catch(err){await connection.rollback();throw err;}finally{connection.release();}
  res.json({data:selected});
});

export default router;
