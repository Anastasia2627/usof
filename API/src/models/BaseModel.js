import { pool } from '../config/db.js';

export class BaseModel {
  static async query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
}
