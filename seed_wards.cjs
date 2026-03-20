const Database = require('better-sqlite3');
const db = new Database('chat.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS wards (
    id TEXT PRIMARY KEY,
    name TEXT
  );
  INSERT OR IGNORE INTO wards (id, name) VALUES ('public-ward', 'Public Ward');
`);

console.log('Wards table checked and seeded.');
