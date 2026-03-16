import Database from 'better-sqlite3';
import dotenv from 'dotenv';
dotenv.config();
const db = new Database('chat.db');
const adminEmail = process.env.ADMIN_IDENTIFIER;
const admin = db.prepare('SELECT id, email, role FROM users WHERE email = ?').get(adminEmail) as any;
console.log(admin);
