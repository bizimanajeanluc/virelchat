import Database from 'better-sqlite3';
const db = new Database('chat.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
console.log(tables.map(t => t.name).join(', '));
