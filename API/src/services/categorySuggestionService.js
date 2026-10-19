import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

function checkId(value) {
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<1)throw new AppError(422,'INVALID_ID','Invalid suggestion ID');
  return n;
}
function safeInput(body) {
  const title=String(body?.title??'').trim().replace(/\s+/g,' ');
  const description=String(body?.description??'').trim();
  if(title.length<3||title.length>100)
    throw new AppError(422,'VALIDATION_ERROR','Topic name must be 3–100 characters');
  if(description.length>500)
    throw new AppError(422,'VALIDATION_ERROR','Topic description must be at most 500 characters');
  return {title,description};
}
function duplicateError(){
  return new AppError(409,'TOPIC_ALREADY_SUGGESTED','This topic already exists or is awaiting review');
}
async function notifyAdmins(suggestion,login) {
  try {
    const [admins]=await pool.execute("SELECT id FROM users WHERE role='admin'");
    for(const admin of admins) {
      await pool.execute(`INSERT INTO notifications(user_id,actor_id,type,title,body)
        VALUES(?,?,'category_suggestion',?,?)`,[
        admin.id,suggestion.user_id,
        'New topic suggestion',
        login+' suggested: '+suggestion.title,
      ]);
    }
  }catch(error){console.warn('Topic suggestion saved; admin notification failed:',error.message);}
}
async function notifyAuthor(suggestion,status) {
  try {
    await pool.execute(`INSERT INTO notifications(user_id,actor_id,type,title,body)
      VALUES(?,?,'category_decision',?,?)`,[
      suggestion.user_id,suggestion.reviewer_id,
      status==='approved'?'Topic suggestion approved':'Topic suggestion declined',
      suggestion.title
    ]);
  }catch(error){console.warn('Topic review saved; user notification failed:',error.message);}
}

export async function submitSuggestion(body,user) {
  const {title,description}=safeInput(body);
  const [[exists]]=await pool.execute(
    'SELECT id FROM categories WHERE LOWER(title)=LOWER(?) LIMIT 1',[title]);
  if(exists)throw duplicateError();
  const [[pending]]=await pool.execute(
    "SELECT id FROM category_suggestions WHERE LOWER(title)=LOWER(?) AND status='pending' LIMIT 1",[title]);
  if(pending)throw duplicateError();
  let inserted;
  try{
    [inserted]=await pool.execute(
      'INSERT INTO category_suggestions(user_id,title,description) VALUES(?,?,?)',
      [Number(user.sub),title,description]);
  }catch(error){
    if(error.code==='ER_DUP_ENTRY')throw duplicateError();
    throw error;
  }
  const [rows]=await pool.execute('SELECT * FROM category_suggestions WHERE id=?',[inserted.insertId]);
  await notifyAdmins(rows[0],user.login);
  return rows[0];
}
export async function mySuggestions(user) {
  const [rows]=await pool.execute('SELECT id,title,description,status,created_at,reviewed_at,category_id FROM category_suggestions WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 50',[Number(user.sub)]);
  return rows;
}
export async function suggestionsForAdmin(status='pending') {
  if(!['pending','approved','rejected','all'].includes(status))
    throw new AppError(422,'INVALID_STATUS','Unknown review filter');
  const [rows]=await pool.execute(`SELECT s.*,u.login AS suggested_by,
    reviewer.login AS reviewer_login FROM category_suggestions s
    INNER JOIN users u ON u.id=s.user_id
    LEFT JOIN users reviewer ON reviewer.id=s.reviewer_id
    ${status==='all'?'':'WHERE s.status=?'}
    ORDER BY FIELD(s.status,'pending','approved','rejected'),s.created_at DESC,s.id DESC LIMIT 100`,
    status==='all'?[]:[status]);
  return rows;
}
export async function reviewSuggestion(id,decision,admin) {
  const suggestionId=checkId(id);
  if(!['approved','rejected'].includes(decision))
    throw new AppError(422,'INVALID_DECISION','Choose approved or rejected');
  const connection=await pool.getConnection();
  let suggestion;
  try{
    await connection.beginTransaction();
    const [[found]]=await connection.execute('SELECT * FROM category_suggestions WHERE id=? FOR UPDATE',[suggestionId]);
    if(!found)throw new AppError(404,'SUGGESTION_NOT_FOUND','Suggestion not found');
    if(found.status!=='pending')
      throw new AppError(409,'ALREADY_REVIEWED','Suggestion was already reviewed');
    let categoryId=null;
    if(decision==='approved'){
      const [[existing]]=await connection.execute('SELECT id FROM categories WHERE LOWER(title)=LOWER(?) LIMIT 1',[found.title]);
      if(existing)throw new AppError(409,'CATEGORY_EXISTS','A category with this name already exists');
      const [inserted]=await connection.execute('INSERT INTO categories(title,description) VALUES(?,?)',
        [found.title,found.description]);
      categoryId=inserted.insertId;
    }
    await connection.execute('UPDATE category_suggestions SET status=?, reviewer_id=?, category_id=?, reviewed_at=NOW() WHERE id=?',
      [decision,Number(admin.sub),categoryId,suggestionId]);
    [[suggestion]]=await connection.execute('SELECT * FROM category_suggestions WHERE id=?',[suggestionId]);
    await connection.commit();
  }catch(error){await connection.rollback();
    if(error.code==='ER_DUP_ENTRY')throw new AppError(409,'CATEGORY_EXISTS','A category with this name already exists');
    throw error;
  }finally{connection.release();}
  await notifyAuthor(suggestion,decision);
  return suggestion;
}
