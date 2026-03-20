const Database = require('better-sqlite3');
const db = new Database('chat.db');
const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='encrypted_messages'").get();
console.log(tableInfo.sql);
