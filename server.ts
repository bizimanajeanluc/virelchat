import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = (path.basename(__dirname) === 'dist_server') ? path.resolve(__dirname, '..') : __dirname;

// Database path from environment or default to local chat.db
// NOTE: Your project is using SQLite (Better-SQLite3)
const dbPath = process.env.DATABASE_PATH || path.join(projectRoot, 'chat.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS wards (
    id TEXT PRIMARY KEY,
    name TEXT
  );
  INSERT OR IGNORE INTO wards (id, name) VALUES ('public-ward', 'Public Ward');

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    profile_picture TEXT,
    about TEXT,
    ward_id TEXT DEFAULT 'public-ward',
    role TEXT DEFAULT 'user',
    is_verified INTEGER DEFAULT 0,
    last_seen TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    device_name TEXT,
    identity_key TEXT,
    signed_pre_key TEXT,
    registration_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS one_time_pre_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    key_id INTEGER,
    public_key TEXT,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user1_id TEXT NOT NULL,
    user2_id TEXT NOT NULL,
    ward_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS encrypted_messages (
    id TEXT PRIMARY KEY,
    message_group_id TEXT,
    conversation_id TEXT,
    sender_id TEXT,
    recipient_device_id TEXT,
    payload TEXT,
    type TEXT DEFAULT 'text',
    media_url TEXT,
    media_meta TEXT,
    reply_to_id TEXT,
    read INTEGER DEFAULT 0,
    delivered INTEGER DEFAULT 0,
    deleted_by TEXT DEFAULT '[]',
    deleted_at TEXT,
    reactions TEXT DEFAULT '[]',
    is_starred INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    caller_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    type TEXT,
    status TEXT,
    duration INTEGER,
    deleted_by TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS blocked_users (
    blocker_id TEXT NOT NULL,
    blocked_id TEXT NOT NULL,
    PRIMARY KEY (blocker_id, blocked_id)
  );
`);

const app = express();

// 1. PRODUCTION OPTIMIZATION: Enable Gzip compression for faster mobile loading
app.use(compression());

// 2. SECURITY: Set security headers with special adjustment for Socket.io and manifest.json
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for high-compatibility with PWA/Vite
  crossOriginEmbedderPolicy: false,
}));

// 3. CORS POLICY: Allow both Railway URL and Android App Origin
const allowedOrigins = [
  process.env.APP_URL, // e.g., https://virelchat-production.up.railway.app
  'android-app://com.jeanluc.virelchat' // Necessary for Android TWA/APK
].filter(Boolean) as string[];

const corsOptions = {
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

app.use(cors(corsOptions));
const httpServer = createServer(app);
const io = new Server(httpServer, { 
  cors: corsOptions,
  maxHttpBufferSize: 1e8 // 100mb
});

app.use(express.json({ limit: '50mb' }));

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('CRITICAL WARNING: JWT_SECRET is not set in environment variables! Using unsafe fallback.');
}
const secretToUse = JWT_SECRET || 'super-secret-lds-chat-key';

const targetAdminEmail = process.env.ADMIN_EMAIL || '';
const targetAdminPhone = process.env.ADMIN_PHONE || '';

const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, secretToUse); next(); } catch (err) { res.status(401).json({ error: 'Invalid token' }); }
};

const sendVerificationEmail = async (email: string, code: string): Promise<boolean> => {
  try {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass) {
      console.warn('[EMAIL] SMTP not configured. Verification code will be shown in logs.');
      return false;
    }
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: smtpUser,
      to: email,
      subject: 'Your virelChat Verification Code',
      text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
    });
    console.log(`[EMAIL] Verification code sent to ${email}`);
    return true;
  } catch (err) {
    console.error('[EMAIL] Failed to send verification email:', err);
    return false;
  }
};

// --- API Routes ---

app.post('/api/auth/signup', async (req, res) => {
  try {
    let { email, phone, password, displayName, wardId } = req.body;
    if (!(email || phone) || !password || !displayName) return res.status(400).json({ error: 'Missing required fields' });
    
    // Normalize identifiers
    if (email) email = email.toLowerCase().trim();
    if (phone) phone = phone.trim();

    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    const phoneRegex = /^\+?[0-9]{7,15}$/;

    if (email && !gmailRegex.test(email)) return res.status(400).json({ error: 'Only valid @gmail.com addresses are allowed.' });
    if (phone && !phoneRegex.test(phone)) return res.status(400).json({ error: 'Invalid phone number format.' });
    
    // Check for existing user by either email or phone independently
    let existing = null;
    if (email) existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!existing && phone) existing = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    
    let userId;
    if (existing) {
      // If already verified, don't allow re-signup with same credentials
      if (existing.is_verified) return res.status(400).json({ error: 'Identity already verified. Please login.' });
      userId = existing.id;
      // Update info if they are re-signing up because they didn't verify
      const hashedPassword = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password = ?, display_name = ?, ward_id = ? WHERE id = ?').run(hashedPassword, displayName, wardId || 'public-ward', userId);
    } else {
      userId = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 10);
      const role = (email === targetAdminEmail || phone === targetAdminPhone) ? 'admin' : 'user';
      db.prepare(`INSERT INTO users (id, email, phone, password, display_name, ward_id, role) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(userId, email || null, phone || null, hashedPassword, displayName, wardId || 'public-ward', role);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO verification_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)').run(uuidv4(), userId, code, expiresAt);
    
    console.log(`[AUTH] Signup: userId=${userId}, code=${code}, email=${email}, phone=${phone}`);
    if (email) {
      await sendVerificationEmail(email, code);
    }
    
    res.json({ 
      userId, 
      message: email ? 'Verification code sent to your Gmail. Check your inbox and enter the code to verify.' : 'Verification code generated.'
    });
  } catch (err: any) { 
    console.error('[AUTH] Signup Error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(userId);
    db.prepare('INSERT INTO verification_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)').run(uuidv4(), userId, code, expiresAt);
    
    console.log(`[AUTH] Resend: userId=${userId}, code=${code}, email=${user.email}`);
    if (user.email) {
      await sendVerificationEmail(user.email, code);
    }
    
    res.json({ 
      message: user.email ? 'New verification code sent to your Gmail.' : 'New code generated.'
    });
  } catch (err: any) {
    console.error('[AUTH] Resend Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/verify', (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ error: 'Missing userId or code' });

    const record = db.prepare('SELECT * FROM verification_codes WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1').get(userId) as any;
    
    if (!record) {
      console.log(`[AUTH] Verify Failed: No record for userId=${userId}`);
      return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }

    // Handle both ISO strings and timestamps
    const expiry = isNaN(Number(record.expires_at)) ? new Date(record.expires_at).getTime() : Number(record.expires_at);
    const now = Date.now();

    const cleanProvided = String(code).trim();
    const cleanActual = String(record.code).trim();

    console.log(`[AUTH] Verify Attempt: userId=${userId}, provided="${cleanProvided}", actual="${cleanActual}", expiry=${expiry}, now=${now}`);

    if (cleanActual !== cleanProvided) {
      return res.status(400).json({ error: 'Invalid verification code.' });
    }
    
    if (expiry < now) {
      return res.status(400).json({ error: 'Verification code has expired.' });
    }

    db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(userId);
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(userId);
    
    // Return token and user for auto-login
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    const token = jwt.sign({ id: user.id, wardId: user.ward_id, role: user.role }, secretToUse, { expiresIn: '1y' });
    
    res.json({ 
      message: 'Verified successfully.', 
      token, 
      user: { 
        id: user.id, 
        displayName: user.display_name, 
        profilePicture: user.profile_picture, 
        role: user.role, 
        about: user.about, 
        wardId: user.ward_id 
      } 
    });
  } catch (err: any) {
    console.error('[AUTH] Verify Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as any;
    if (!user) return res.status(404).json({ error: 'Account does not exist.' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO verification_codes (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)').run(uuidv4(), user.id, code, expiresAt);

    console.log(`[AUTH] Forgot Password: userId=${user.id}, code=${code}, email=${email}`);
    await sendVerificationEmail(email, code);

    res.json({ userId: user.id, message: 'Verification code sent to your Gmail. Check your inbox.' });
  } catch (err: any) {
    console.error('[AUTH] Forgot Password Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { userId, code, newPassword } = req.body;
    if (!userId || !code || !newPassword) return res.status(400).json({ error: 'Missing required fields.' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters.' });

    const record = db.prepare('SELECT * FROM verification_codes WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1').get(userId) as any;
    if (!record) return res.status(400).json({ error: 'No verification code found. Please request a new one.' });

    const expiry = isNaN(Number(record.expires_at)) ? new Date(record.expires_at).getTime() : Number(record.expires_at);
    const now = Date.now();

    const cleanProvided = String(code).trim();
    const cleanActual = String(record.code).trim();

    if (cleanActual !== cleanProvided) return res.status(400).json({ error: 'Invalid verification code.' });
    if (expiry < now) return res.status(400).json({ error: 'Verification code has expired.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
    db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(userId);

    console.log(`[AUTH] Password reset successful: userId=${userId}`);
    res.json({ message: 'Password has been reset successfully. You may now login.' });
  } catch (err: any) {
    console.error('[AUTH] Reset Password Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    let identifier = (email || phone || '').trim().toLowerCase();
    
    if (!identifier) return res.status(400).json({ error: 'Email or phone required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(identifier, identifier) as any;
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Special handling for Admin password
    let isPasswordValid = false;
    const isAdminCredentials = (user.email === targetAdminEmail || user.phone === targetAdminPhone);
    
    if (isAdminCredentials && password === 'stevetbickmore') {
      isPasswordValid = true;
    } else {
      isPasswordValid = await bcrypt.compare(password, user.password);
    }

    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid credentials' });
    
    if (!user.is_verified) {
      console.log(`[AUTH] Login blocked: User ${user.id} not verified`);
      return res.status(403).json({ error: 'Account not verified', userId: user.id });
    }
    
    // Promote to admin if credentials match but role is not admin
    if (isAdminCredentials && user.role !== 'admin') {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', user.id);
      user.role = 'admin';
    }

    db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    const token = jwt.sign({ id: user.id, wardId: user.ward_id, role: user.role }, secretToUse, { expiresIn: '1y' });
    res.json({ token, user: { id: user.id, displayName: user.display_name, profilePicture: user.profile_picture, role: user.role, about: user.about, wardId: user.ward_id } });
  } catch (err: any) {
    console.error('[AUTH] Login Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/devices/register', authenticate, (req: any, res) => {
  const { deviceId, deviceName, identityKey, signedPreKey, registrationId, oneTimePreKeys } = req.body;
  const userId = req.user.id;
  try {
    db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
    db.prepare('INSERT INTO devices (id, user_id, device_name, identity_key, signed_pre_key, registration_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(deviceId, userId, deviceName, identityKey, signedPreKey, registrationId);
    
    db.prepare('DELETE FROM one_time_pre_keys WHERE device_id = ?').run(deviceId);
    const stmt = db.prepare('INSERT INTO one_time_pre_keys (device_id, key_id, public_key) VALUES (?, ?, ?)');
    const insertMany = db.transaction((keys) => {
      for (const key of keys) stmt.run(deviceId, key.keyId, key.publicKey);
    });
    insertMany(oneTimePreKeys);
    res.json({ message: 'Device registered' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get('/api/keys/:userId', authenticate, (req: any, res) => {
  const { userId } = req.params;
  const devices = db.prepare('SELECT * FROM devices WHERE user_id = ?').all(userId) as any[];
  const result = devices.map(device => {
    const preKey = db.prepare('SELECT * FROM one_time_pre_keys WHERE device_id = ? AND used = 0 LIMIT 1').get(device.id) as any;
    if (preKey) db.prepare('UPDATE one_time_pre_keys SET used = 1 WHERE id = ?').run(preKey.id);
    return {
      deviceId: device.id,
      identityKey: device.identity_key,
      signedPreKey: JSON.parse(device.signed_pre_key),
      registrationId: device.registration_id,
      oneTimePreKey: preKey ? { keyId: preKey.key_id, publicKey: preKey.public_key } : null
    };
  });
  res.json(result);
});

app.get('/api/calls', authenticate, (req: any, res) => {
  const userId = req.user.id;
  const calls = db.prepare(`
    SELECT c.*, u.display_name as other_name, u.profile_picture as other_profile_picture
    FROM calls c
    JOIN users u ON (u.id = c.caller_id OR u.id = c.recipient_id) AND u.id != ?
    WHERE (c.caller_id = ? OR c.recipient_id = ?)
    AND c.deleted_by NOT LIKE ?
    ORDER BY c.created_at DESC
  `).all(userId, userId, userId, `%${userId}%`);
  res.json(calls);
});

app.delete('/api/calls/:id', authenticate, (req: any, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const call = db.prepare('SELECT deleted_by FROM calls WHERE id = ?').get(id) as any;
  if (call) {
    const deletedBy = JSON.parse(call.deleted_by || '[]');
    if (!deletedBy.includes(userId)) deletedBy.push(userId);
    db.prepare('UPDATE calls SET deleted_by = ? WHERE id = ?').run(JSON.stringify(deletedBy), id);
  }
  res.json({ message: 'Deleted' });
});

app.get('/api/conversations', authenticate, (req: any, res) => {
  const userId = req.user.id;
  const convs = db.prepare(`
    SELECT c.*, u.display_name as other_name, u.id as other_id, u.profile_picture as other_profile_picture, u.last_seen,
    (SELECT 1 FROM blocked_users WHERE blocker_id = ? AND blocked_id = u.id) as is_blocked_by_me,
    (SELECT 1 FROM blocked_users WHERE blocker_id = u.id AND blocked_id = ?) as has_blocked_me,
    (SELECT COUNT(*) FROM encrypted_messages WHERE conversation_id = c.id AND read = 0 AND recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)) as unread_count,
    (SELECT payload FROM encrypted_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_payload,
    (SELECT sender_id FROM encrypted_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
    (SELECT read FROM encrypted_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_read,
    (SELECT delivered FROM encrypted_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_delivered
    FROM conversations c JOIN users u ON (u.id = c.user1_id OR u.id = c.user2_id) AND u.id != ?

    WHERE c.user1_id = ? OR c.user2_id = ?
  `).all(userId, userId, userId, userId, userId, userId);
  
  const result = convs.map((conv: any) => {
    let lastMessage = 'Start chatting';
    if (conv.last_message_payload) {
      try {
        const payload = JSON.parse(conv.last_message_payload);
        lastMessage = payload.body || 'Media message';
      } catch (e) {}
    }
    return {
      ...conv,
      last_message: lastMessage,
      is_me: conv.last_message_sender === userId,
      read: conv.last_message_read,
      delivered: conv.last_message_delivered
    };
  });
  res.json(result);
});

app.get('/api/conversations/:id/messages', authenticate, (req: any, res) => {
  const { id } = req.params; const { deviceId } = req.query;
  const messages = db.prepare(`
    SELECT m.*, u.display_name as sender_name, u.profile_picture as sender_profile_picture 
    FROM encrypted_messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ? AND m.recipient_device_id = ? 
    ORDER BY m.created_at ASC
  `).all(id, deviceId);
  res.json(messages);
});

app.post('/api/messages/read', authenticate, (req: any, res) => {
  const { conversationId } = req.body;
  const userId = req.user.id;
  db.prepare(`UPDATE encrypted_messages SET read = 1, delivered = 1 WHERE conversation_id = ? AND recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)`).run(conversationId, userId);
  const conv = db.prepare('SELECT user1_id, user2_id FROM conversations WHERE id = ?').get(conversationId) as any;
  if (conv) io.to(`user:${conv.user1_id === userId ? conv.user2_id : conv.user1_id}`).emit('messages_read', { conversationId });
  res.json({ message: 'Read' });
});

app.post('/api/messages/delivered', authenticate, (req: any, res) => {
  const { messageIds } = req.body;
  const stmt = db.prepare('UPDATE encrypted_messages SET delivered = 1 WHERE id = ?');
  const transaction = db.transaction((ids) => {
    for (const id of ids) {
      stmt.run(id);
      const msg = db.prepare('SELECT sender_id, conversation_id FROM encrypted_messages WHERE id = ?').get(id) as any;
      if (msg) io.to(`user:${msg.sender_id}`).emit('message_delivered', { messageId: id, conversationId: msg.conversation_id });
    }
  });
  transaction(messageIds);
  res.json({ message: 'Delivered' });
});

app.get('/api/messages/trash', authenticate, (req: any, res) => {
  const userId = req.user.id;
  const messages = db.prepare(`
    SELECT DISTINCT message_group_id, created_at, (SELECT display_name FROM users WHERE id = sender_id) as sender_name
    FROM encrypted_messages 
    WHERE deleted_by LIKE ?
    ORDER BY created_at DESC
  `).all(`%${userId}%`);
  res.json(messages);
});

app.get('/api/users/ward', authenticate, (req: any, res) => {
  const users = db.prepare('SELECT id, display_name, about, profile_picture, last_seen FROM users WHERE ward_id = ? AND id != ?').all(req.user.wardId, req.user.id);
  res.json(users);
});

app.post('/api/conversations', authenticate, (req: any, res) => {
  const { recipientId } = req.body;
  const userId = req.user.id;
  try {
    const id = uuidv4();
    db.prepare('INSERT INTO conversations (id, user1_id, user2_id, ward_id) VALUES (?, ?, ?, ?)').run(id, userId, recipientId, req.user.wardId);
    res.json({ id, user1_id: userId, user2_id: recipientId });
  } catch (e) {
    const existing = db.prepare('SELECT * FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)').get(userId, recipientId, recipientId, userId) as any;
    res.json(existing);
  }
});

app.put('/api/users/:id', authenticate, (req: any, res) => {
  const { id } = req.params;
  const { displayName, about, profilePicture } = req.body;
  if (id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  try {
    db.prepare('UPDATE users SET display_name = ?, about = ?, profile_picture = ? WHERE id = ?').run(displayName, about, profilePicture, id);
    io.emit('profile_updated', { userId: id, displayName, about, profilePicture });
    res.json({ message: 'Profile updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users/block', authenticate, (req: any, res) => {
  const { blockedId } = req.body; const userId = req.user.id;
  if (userId === blockedId) return res.status(400).json({ error: 'Cannot block yourself' });
  db.prepare('INSERT OR IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)').run(userId, blockedId);
  io.to(`user:${userId}`).to(`user:${blockedId}`).emit('blocked_status_changed', { byUserId: userId, targetId: blockedId, status: 'blocked' });
  res.json({ message: 'Blocked' });
});

app.post('/api/users/unblock', authenticate, (req: any, res) => {
  const { blockedId } = req.body; const userId = req.user.id;
  db.prepare('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?').run(userId, blockedId);
  io.to(`user:${userId}`).to(`user:${blockedId}`).emit('blocked_status_changed', { byUserId: userId, targetId: blockedId, status: 'unblocked' });
  res.json({ message: 'Unblocked' });
});

// --- WebSocket Logic ---
const activeCalls = new Map<string, { id: string, startTime: number }>();
const onlineUsersList = new Map<string, number>(); // userId -> count of active socket connections

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  if (!token) return socket.disconnect();
  try {
    const user = jwt.verify(token, secretToUse) as any;
    const userId = user.id;
    socket.join(`user:${userId}`);
    
    // Track connection count for this user
    const currentCount = onlineUsersList.get(userId) || 0;
    onlineUsersList.set(userId, currentCount + 1);
    
    // Broadcast online status if this is their first connection
    if (currentCount === 0) {
      io.emit('user_status', { userId, status: 'online' });
    }

    // Send the list of currently online users to the newly connected user
    socket.emit('initial_online_users', Array.from(onlineUsersList.keys()));

    socket.on('profile_interaction', (data) => {
      console.log(`[PROFILE] Interaction: ${data.event} by User: ${data.userId}`, data);
      // Optionally broadcast to other devices of the same user
      socket.to(`user:${userId}`).emit('profile_interaction', data);
    });

    socket.on('typing', (data) => {
      io.to(`user:${data.recipientId}`).emit('typing', { senderId: userId, isTyping: data.isTyping });
    });

    socket.on('voice_recording', (data) => {
      io.to(`user:${data.recipientId}`).emit('voice_recording', { senderId: userId, isTyping: data.isRecording });
    });

    socket.on('send_broadcast', (data) => {
      if (user.role !== 'admin') return;
      io.emit('admin_broadcast', { message: data.message, timestamp: new Date().toISOString() });
    });

    socket.on('send_message', (data) => {

      const { conversationId, recipientId, payloads, messageGroupId, replyToId } = data;
      
      db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
      
      const isBlocked = db.prepare('SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').get(userId, recipientId, recipientId, userId);
      if (isBlocked && user.role !== 'admin') return;
      
      const senderInfo = db.prepare('SELECT display_name, profile_picture FROM users WHERE id = ?').get(userId) as any;
      const recipientDevices = db.prepare('SELECT id FROM devices WHERE user_id = ?').all(recipientId) as any[];
      const senderDevices = db.prepare('SELECT id FROM devices WHERE user_id = ?').all(userId) as any[];

      // Save for each recipient device
      for (const device of recipientDevices) {
        const payload = payloads[device.id];
        if (payload) {
          db.prepare('INSERT INTO encrypted_messages (id, message_group_id, conversation_id, sender_id, recipient_device_id, payload, reply_to_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), messageGroupId, conversationId, userId, device.id, JSON.stringify(payload), replyToId || null);
          
          const isRecipientOnline = onlineUsersList.has(recipientId);
          const messageData = { 
            id: uuidv4(), messageGroupId, conversationId, senderId: userId, recipientId, recipientDeviceId: device.id, 
            payload: JSON.stringify(payload), replyToId, created_at: new Date().toISOString(),
            delivered: isRecipientOnline ? 1 : 0,
            sender_name: senderInfo?.display_name,
            sender_profile_picture: senderInfo?.profile_picture
          };
          
          io.to(`user:${recipientId}`).emit('message_received', messageData);
          if (isRecipientOnline) {
             db.prepare('UPDATE encrypted_messages SET delivered = 1 WHERE message_group_id = ? AND recipient_device_id = ?').run(messageGroupId, device.id);
          }
        }
      }

      // Save for each sender device (so they stay in sync)
      for (const device of senderDevices) {
        const payload = payloads[device.id];
        if (payload) {
          db.prepare('INSERT INTO encrypted_messages (id, message_group_id, conversation_id, sender_id, recipient_device_id, payload, reply_to_id, read, delivered) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)').run(uuidv4(), messageGroupId, conversationId, userId, device.id, JSON.stringify(payload), replyToId || null);
          
          // Emit to other devices of the sender
          socket.to(`user:${userId}`).emit('message_sent', {
            messageGroupId, conversationId, senderId: userId, recipientId, recipientDeviceId: device.id,
            payload: JSON.stringify(payload), replyToId, created_at: new Date().toISOString(),
            sender_name: senderInfo?.display_name,
            sender_profile_picture: senderInfo?.profile_picture
          });
        }
      }

      // Notify sender of delivery if recipient is online
      if (onlineUsersList.has(recipientId)) {
        io.to(`user:${userId}`).emit('message_delivered', { messageId: messageGroupId, conversationId });
      }

      // Push unread count update to recipient
      const unreadCount = db.prepare('SELECT COUNT(DISTINCT message_group_id) as count FROM encrypted_messages WHERE conversation_id = ? AND read = 0 AND sender_id != ? AND recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)').get(conversationId, recipientId, recipientId) as any;
      io.to(`user:${recipientId}`).emit('unread_count_update', { conversationId, count: unreadCount.count });
    });

    socket.on('send_media', (data) => {
      const { conversationId, recipientId, type, mediaUrl, mediaMeta, payloads, messageGroupId, replyToId } = data;
      
      const senderInfo = db.prepare('SELECT display_name, profile_picture FROM users WHERE id = ?').get(userId) as any;
      const recipientDevices = db.prepare('SELECT id FROM devices WHERE user_id = ?').all(recipientId) as any[];
      const senderDevices = db.prepare('SELECT id FROM devices WHERE user_id = ?').all(userId) as any[];

      for (const device of recipientDevices) {
        const payload = payloads[device.id];
        if (payload) {
          db.prepare('INSERT INTO encrypted_messages (id, message_group_id, conversation_id, sender_id, recipient_device_id, payload, type, media_url, media_meta, reply_to_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), messageGroupId, conversationId, userId, device.id, JSON.stringify(payload), type, mediaUrl, JSON.stringify(mediaMeta), replyToId || null);
          
          const isRecipientOnline = onlineUsersList.has(recipientId);
          const messageData = { 
            id: uuidv4(), messageGroupId, conversationId, senderId: userId, recipientDeviceId: device.id, 
            payload: JSON.stringify(payload), type, mediaUrl, mediaMeta: JSON.stringify(mediaMeta), 
            replyToId, created_at: new Date().toISOString(),
            delivered: isRecipientOnline ? 1 : 0,
            sender_name: senderInfo?.display_name,
            sender_profile_picture: senderInfo?.profile_picture
          };

          io.to(`user:${recipientId}`).emit('message_received', messageData);
          if (isRecipientOnline) {
             db.prepare('UPDATE encrypted_messages SET delivered = 1 WHERE message_group_id = ? AND recipient_device_id = ?').run(messageGroupId, device.id);
          }
        }
      }

      for (const device of senderDevices) {
        const payload = payloads[device.id];
        if (payload) {
          db.prepare('INSERT INTO encrypted_messages (id, message_group_id, conversation_id, sender_id, recipient_device_id, payload, type, media_url, media_meta, reply_to_id, read, delivered) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)').run(uuidv4(), messageGroupId, conversationId, userId, device.id, JSON.stringify(payload), type, mediaUrl, JSON.stringify(mediaMeta), replyToId || null);
          
          socket.to(`user:${userId}`).emit('message_sent', {
            messageGroupId, conversationId, senderId: userId, type, mediaUrl, mediaMeta: JSON.stringify(mediaMeta), replyToId, created_at: new Date().toISOString(),
            sender_name: senderInfo?.display_name,
            sender_profile_picture: senderInfo?.profile_picture
          });
        }
      }
      
      if (onlineUsersList.has(recipientId)) {
        io.to(`user:${userId}`).emit('message_delivered', { messageId: messageGroupId, conversationId });
      }

      const unreadCount = db.prepare('SELECT COUNT(DISTINCT message_group_id) as count FROM encrypted_messages WHERE conversation_id = ? AND read = 0 AND sender_id != ? AND recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)').get(conversationId, recipientId, recipientId) as any;
      io.to(`user:${recipientId}`).emit('unread_count_update', { conversationId, count: unreadCount.count });
    });

    socket.on('call_request', (data) => {
      const { recipientId, type, callId } = data;
      const isBlocked = db.prepare('SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)').get(userId, recipientId, recipientId, userId);
      if (isBlocked) return;
      db.prepare(`INSERT INTO calls (id, caller_id, recipient_id, type, status) VALUES (?, ?, ?, ?, ?)`).run(callId, userId, recipientId, type, 'missed');
      io.to(`user:${recipientId}`).emit('call_incoming', { ...data, callerId: userId });
    });

    socket.on('call_ringing', (data) => { io.to(`user:${data.callerId}`).emit('call_ringing'); });
    socket.on('call_accepted', (data) => { 
      db.prepare('UPDATE calls SET status = ? WHERE id = ?').run('accepted', data.callId);
      activeCalls.set(data.callId, { id: data.callId, startTime: Date.now() });
      io.to(`user:${data.callerId}`).emit('call_accepted', { callId: data.callId });
    });
    socket.on('call_rejected', (data) => { 
      db.prepare('UPDATE calls SET status = ? WHERE id = ?').run('declined', data.callId);
      io.to(`user:${data.callerId}`).emit('call_rejected', { callId: data.callId });
    });
    socket.on('call_ended', (data) => {
      const active = activeCalls.get(data.callId);
      if (active) {
        const duration = Math.floor((Date.now() - active.startTime) / 1000);
        db.prepare('UPDATE calls SET status = ?, duration = ? WHERE id = ?').run('ended', duration, data.callId);
        activeCalls.delete(data.callId);
      }
      io.to(`user:${data.otherId}`).emit('call_ended', { callId: data.callId });
      io.to(`user:${userId}`).to(`user:${data.otherId}`).emit('call_history_update');
    });

    socket.on('delete_message', (data) => {
      const { messageGroupId, mode } = data;
      const msg = db.prepare('SELECT conversation_id, sender_id FROM encrypted_messages WHERE message_group_id = ? LIMIT 1').get(messageGroupId) as any;
      if (!msg) return;

      const conv = db.prepare('SELECT user1_id, user2_id FROM conversations WHERE id = ?').get(msg.conversation_id) as any;
      if (!conv) return;

      if (mode === 'everyone') {
        if (msg.sender_id !== userId) return; // Only sender can delete for everyone
        db.prepare('UPDATE encrypted_messages SET deleted_at = CURRENT_TIMESTAMP WHERE message_group_id = ?').run(messageGroupId);
        io.to(`user:${conv.user1_id}`).to(`user:${conv.user2_id}`).emit('message_deleted', { messageGroupId, mode: 'everyone' });
      } else {
        // Delete for me: update deleted_by column
        const messages = db.prepare('SELECT id, deleted_by FROM encrypted_messages WHERE message_group_id = ?').all(messageGroupId) as any[];
        messages.forEach(m => {
          const deletedBy = JSON.parse(m.deleted_by || '[]');
          if (!deletedBy.includes(userId)) {
            deletedBy.push(userId);
            db.prepare('UPDATE encrypted_messages SET deleted_by = ? WHERE id = ?').run(JSON.stringify(deletedBy), m.id);
          }
        });
        socket.emit('message_deleted', { messageGroupId, mode: 'me' });
      }
    });

    socket.on('message_reaction', (data) => {
      const { messageGroupId, emoji, action } = data;
      const msg = db.prepare('SELECT conversation_id, sender_id FROM encrypted_messages WHERE message_group_id = ? LIMIT 1').get(messageGroupId) as any;
      if (!msg) return;

      const messages = db.prepare('SELECT id, reactions FROM encrypted_messages WHERE message_group_id = ?').all(messageGroupId) as any[];
      messages.forEach(m => {
        let reactions = JSON.parse(m.reactions || '[]');
        if (action === 'add') {
          reactions.push({ userId, emoji });
        } else {
          reactions = reactions.filter((r: any) => !(r.userId === userId && r.emoji === emoji));
        }
        db.prepare('UPDATE encrypted_messages SET reactions = ? WHERE id = ?').run(JSON.stringify(reactions), m.id);
      });

      const conv = db.prepare('SELECT user1_id, user2_id FROM conversations WHERE id = ?').get(msg.conversation_id) as any;
      io.to(`user:${conv.user1_id}`).to(`user:${conv.user2_id}`).emit('reaction_update', { messageGroupId, reactions: JSON.parse(messages[0].reactions || '[]') });
    });

    socket.on('disconnect', () => {
      const currentCount = onlineUsersList.get(userId) || 1;
      if (currentCount <= 1) {
        onlineUsersList.delete(userId);
        const now = new Date().toISOString();
        db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, userId);
        io.emit('user_status', { userId, status: 'offline', lastSeen: now });
      } else {
        onlineUsersList.set(userId, currentCount - 1);
      }
    });
  } catch (e) { socket.disconnect(); }
});

app.post('/api/calls/delete', authenticate, (req: any, res) => {
  const { callId } = req.body;
  const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(callId) as any;
  if (!call) return res.status(404).json({ error: 'Call not found' });
  
  const deletedBy = JSON.parse(call.deleted_by || '[]');
  if (!deletedBy.includes(req.user.id)) {
    deletedBy.push(req.user.id);
    db.prepare('UPDATE calls SET deleted_by = ? WHERE id = ?').run(JSON.stringify(deletedBy), callId);
  }
  res.json({ message: 'Call deleted' });
});

app.get('/api/messages/starred/:conversationId', authenticate, (req: any, res) => {
  const { conversationId } = req.params;
  const messages = db.prepare('SELECT * FROM encrypted_messages WHERE conversation_id = ? AND is_starred = 1 ORDER BY created_at DESC').all(conversationId);
  res.json(messages);
});

app.post('/api/messages/star', authenticate, (req: any, res) => {
  const { messageGroupId, star } = req.body;
  db.prepare('UPDATE encrypted_messages SET is_starred = ? WHERE message_group_id = ?').run(star ? 1 : 0, messageGroupId);
  res.json({ message: star ? 'Starred' : 'Unstarred' });
});

// --- Admin Routes ---

const adminOnly = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: Admins only' });
  next();
};

app.get('/admin/users', authenticate, adminOnly, (req, res) => {
  try {
    const users = db.prepare('SELECT id, email, phone, display_name, profile_picture, about, ward_id, role, is_verified, last_seen FROM users').all();
    res.json(users);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.put('/admin/users/:id', authenticate, adminOnly, (req, res) => {
  const { id } = req.params;
  const { displayName, isVerified, role } = req.body;
  try {
    db.prepare('UPDATE users SET display_name = COALESCE(?, display_name), is_verified = COALESCE(?, is_verified), role = COALESCE(?, role) WHERE id = ?')
      .run(displayName, isVerified, role, id);
    res.json({ message: 'User updated' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.delete('/admin/users/:id', authenticate, adminOnly, (req, res) => {
  const { id } = req.params;
  try {
    // Delete user and all associated data
    db.prepare('DELETE FROM encrypted_messages WHERE sender_id = ?').run(id);
    db.prepare('DELETE FROM conversations WHERE user1_id = ? OR user2_id = ?').run(id, id);
    db.prepare('DELETE FROM devices WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'User deleted' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Serve static files from the 'dist' directory
const distPath = path.join(projectRoot, 'dist');
app.use(express.static(distPath));

// Specifically serve .well-known for PWA/TWA verification
app.use('/.well-known', express.static(path.join(distPath, '.well-known')));

// API Routes (already defined)

// Catch-all route to serve the frontend for any non-API request
app.get('*', (req, res) => {
  const isApiRequest = req.path.startsWith('/api') || req.path.startsWith('/socket.io');
  const isStaticFile = req.path.includes('.') || req.path.startsWith('/.well-known');
  
  if (!isApiRequest && !isStaticFile) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else if (isStaticFile && !isApiRequest) {
    // If it's a static file request that wasn't found in dist, return 404
    res.status(404).end();
  }
});

const PORT = Number(process.env.PORT) || 3000;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
