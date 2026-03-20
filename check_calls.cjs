const Database = require('better-sqlite3');
const db = new Database('chat.db');
const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='calls'").get();
console.log(tableInfo.sql);
