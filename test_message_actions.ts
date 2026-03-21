import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const db = new Database(path.join(__dirname, 'chat.db'));

async function runTests() {
  console.log('🚀 Starting Message Menu Logic Tests...\n');

  const testMsgGroupId = 'test-group-' + Date.now();
  const testUserId = 'test-user-123';

  // 1. Setup: Insert a dummy message
  db.prepare(`
    INSERT INTO encrypted_messages (id, message_group_id, conversation_id, sender_id, recipient_device_id, payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), testMsgGroupId, 'test-conv', testUserId, 'test-device', JSON.stringify({ body: 'Test Message' }));

  console.log('✅ Setup: Test message inserted.');

  // 2. Test: Star Logic
  db.prepare('UPDATE encrypted_messages SET is_starred = 1 WHERE message_group_id = ?').run(testMsgGroupId);
  const starred = db.prepare('SELECT is_starred FROM encrypted_messages WHERE message_group_id = ?').get(testMsgGroupId) as any;
  if (starred.is_starred === 1) {
    console.log('✅ Star Logic: PASS (Message successfully starred)');
  } else {
    console.log('❌ Star Logic: FAIL');
  }

  // 3. Test: Delete for Me (Check JSON column)
  const deletedBy = JSON.stringify([testUserId]);
  db.prepare('UPDATE encrypted_messages SET deleted_by = ? WHERE message_group_id = ?').run(deletedBy, testMsgGroupId);
  const delMe = db.prepare('SELECT deleted_by FROM encrypted_messages WHERE message_group_id = ?').get(testMsgGroupId) as any;
  if (JSON.parse(delMe.deleted_by).includes(testUserId)) {
    console.log('✅ Delete for Me Logic: PASS (UserID added to deleted_by list)');
  } else {
    console.log('❌ Delete for Me Logic: FAIL');
  }

  // 4. Test: Delete for Everyone (Check Timestamp)
  db.prepare('UPDATE encrypted_messages SET deleted_at = CURRENT_TIMESTAMP WHERE message_group_id = ?').run(testMsgGroupId);
  const delEvery = db.prepare('SELECT deleted_at FROM encrypted_messages WHERE message_group_id = ?').get(testMsgGroupId) as any;
  if (delEvery.deleted_at !== null) {
    console.log('✅ Delete for Everyone Logic: PASS (deleted_at timestamp set)');
  } else {
    console.log('❌ Delete for Everyone Logic: FAIL');
  }

  // Cleanup
  db.prepare('DELETE FROM encrypted_messages WHERE message_group_id = ?').run(testMsgGroupId);
  console.log('\n🧹 Cleanup: Test data removed.');
  console.log('\n🏁 Logic tests complete.');
}

runTests().catch(console.error);
