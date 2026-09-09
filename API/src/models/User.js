import { BaseModel } from './BaseModel.js';

export class User extends BaseModel {
  static async findById(id) {
    const rows = await this.query('SELECT id, login, full_name, email, email_verified, avatar, rating, role, created_at FROM users WHERE id=?', [id]);
    return rows[0] || null;
  }
  static async findByLoginOrEmail(login, email) {
    const rows = await this.query('SELECT * FROM users WHERE login=? OR email=? LIMIT 1', [login || '', email || '']);
    return rows[0] || null;
  }
  static async list() {
    return this.query('SELECT id, login, full_name, email, email_verified, avatar, rating, role, created_at FROM users ORDER BY id');
  }
}
