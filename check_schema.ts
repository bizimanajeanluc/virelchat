import Database from 'better-sqlite3';
const db = new Database('chat.db');
const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string };
console.log(row.sql);
