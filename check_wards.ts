import Database from 'better-sqlite3';
const db = new Database('chat.db');
const wards = db.prepare('SELECT * FROM wards').all();
console.log(wards);
