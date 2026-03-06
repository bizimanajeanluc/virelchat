import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import fs from 'fs';
import nodemailer from 'nodemailer';
import cors from 'cors';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('chat.db');

// Email Configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false
  }
});

async function sendVerificationEmail(to: string, code: string) {
  if (!process.env.SMTP_HOST) {
    const errorMsg = 'SMTP host not configured in environment variables.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    await transporter.verify(); // Verify connection before sending
    await transporter.sendMail({
      from: `"virelChat" <${process.env.SMTP_USER}>`,
      to,
      subject: `${code} is your virelChat verification code`,
      text: `Welcome to virelChat!\n\nYour verification code is: ${code}\n\nThis code will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; color: #374151;">
          <h2 style="color: #059669; margin-bottom: 24px;">Welcome to virelChat</h2>
          <p style="font-size: 16px; line-height: 24px;">Please use the following code to verify your account:</p>
          <div style="background-color: #f3f4f6; padding: 32px; text-align: center; margin: 24px 0; border-radius: 8px;">
            <span style="font-size: 38px; font-weight: bold; letter-spacing: 12px; color: #111827; font-family: monospace;">${code}</span>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
            This code will expire in 10 minutes. If you didn't request this code, you can safely ignore this email.
          </p>
        </div>
      `,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (err: any) {
    console.error('SMTP Error:', err.message);
    throw new Error(`Failed to send verification email: ${err.message}`);
  }
}

async function sendVerificationSMS(to: string, code: string) {
  // Placeholder for SMS service (Twilio, MessageBird, etc.)
  console.log(`[SMS] Sending verification code ${code} to ${to}`);
  // If you have a provider, implement it here
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    password TEXT,
    display_name TEXT,
    profile_picture TEXT,
    about TEXT,
    ward_id TEXT,
    role TEXT DEFAULT 'user',
    is_verified INTEGER DEFAULT 0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blocked_users (
    user_id TEXT,
    blocked_id TEXT,
    PRIMARY KEY (user_id, blocked_id)
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    code TEXT,
    expires_at DATETIME,
    attempts INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    device_name TEXT,
    identity_key TEXT,
    signed_pre_key TEXT,
    registration_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS one_time_pre_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    key_id INTEGER,
    public_key TEXT,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user1_id TEXT,
    user2_id TEXT,
    ward_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
  );

  CREATE TABLE IF NOT EXISTS encrypted_messages (
    id TEXT PRIMARY KEY,
    message_group_id TEXT,
    conversation_id TEXT,
    sender_id TEXT,
    recipient_device_id TEXT,
    payload TEXT,
    delivered INTEGER DEFAULT 0,
    read INTEGER DEFAULT 0,
    edited_at DATETIME,
    deleted_at DATETIME,
    deleted_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS wards (
    id TEXT PRIMARY KEY,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    caller_id TEXT,
    recipient_id TEXT,
    type TEXT,
    status TEXT, -- 'missed', 'accepted', 'rejected', 'busy'
    deleted_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration for existing tables
try {
  db.exec('ALTER TABLE encrypted_messages ADD COLUMN deleted_by TEXT');
} catch (e) {}
try {
  db.exec('ALTER TABLE calls ADD COLUMN deleted_by TEXT');
} catch (e) {}

// Seed some wards if empty
const wardCount = db.prepare('SELECT COUNT(*) as count FROM wards').get() as { count: number };
if (wardCount.count === 0) {
  db.prepare('INSERT INTO wards (id, name) VALUES (?, ?)').run('ward-1', 'Salt Lake 1st Ward');
  db.prepare('INSERT INTO wards (id, name) VALUES (?, ?)').run('ward-2', 'Provo 5th Ward');
}

// Seed the primary admin user if they don't exist
const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get('bizimanajeanluc73@gmail.com');
if (!adminUser) {
  console.log('Seeding primary admin user...');
  const adminId = uuidv4();
  // Password hash for 'stevetbickmore'
  const adminHash = '$2b$10$166yYO9F3rJoWZLpiE/gwufY1pnsMzoAPk/55t6j2YpD6qkTK9Q2q';
  db.prepare(`
    INSERT INTO users (id, email, phone, password, display_name, ward_id, role, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(adminId, 'bizimanajeanluc73@gmail.com', '0723223652', adminHash, 'Jean Luc', 'ward-1', 'admin', 1);
}

const app = express();
app.use(cors());
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-lds-chat-key';

// Middleware to verify JWT
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Logger for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Global Error Handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get Call History
app.get('/api/calls', authenticate, (req: any, res) => {
  const userId = req.user.id;
  try {
    const calls = db.prepare(`
      SELECT c.*, u.display_name as other_name, u.profile_picture as other_profile_picture
      FROM calls c
      JOIN users u ON (u.id = c.caller_id OR u.id = c.recipient_id) AND u.id != ?
      WHERE (c.caller_id = ? OR c.recipient_id = ?)
      ORDER BY c.created_at DESC
      LIMIT 50
    `).all(userId, userId, userId);
    res.json(calls);
  } catch (err) {
    console.error('Failed to fetch call history:', err);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

// Delete Call Record
app.delete('/api/calls/:id', authenticate, (req: any, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM calls WHERE id = ?').run(id);
    res.json({ message: 'Call record deleted completely' });
  } catch (err) {
    console.error('Failed to delete call record:', err);
    res.status(500).json({ error: 'Failed to delete call record' });
  }
});

// --- REST API Routes ---

// Signup
app.post('/api/auth/signup', async (req, res) => {
  const { email, phone, password, displayName, wardId } = req.body;
  console.log('Signup attempt:', { email, phone, displayName, wardId });
  
  if (!password || (!email && !phone) || !displayName || !wardId) {
    console.log('Signup failed: Missing required fields');
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  const hashedPassword = await bcrypt.hash(password, 10);

  // Robust Admin Check: 
  // 1. Is it the first user?
  // 2. Does it match the ADMIN_IDENTIFIER (email or phone) from .env?
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const adminIdentifier = process.env.ADMIN_IDENTIFIER;
  const isTargetAdmin = adminIdentifier && (email === adminIdentifier || phone === adminIdentifier);
  const role = (userCount.count === 0 || isTargetAdmin) ? 'admin' : 'user';

  try {
    // Check if email or phone already exists
    if (email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existingEmail) return res.status(400).json({ error: 'Email already registered' });
    }
    if (phone) {
      const existingPhone = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (existingPhone) return res.status(400).json({ error: 'Phone number already registered' });
    }

    db.prepare(`
      INSERT INTO users (id, email, phone, password, display_name, ward_id, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, email || null, phone || null, hashedPassword, displayName, wardId, role);

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins
    db.prepare(`
      INSERT INTO verification_codes (id, user_id, code, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), id, code, expiresAt);

    console.log(`Verification code for ${email || phone}: ${code}`); // In production, send via Email/SMS

    if (email) {
      await sendVerificationEmail(email, code);
    } else if (phone) {
      await sendVerificationSMS(phone, code);
    }

    res.json({ 
      userId: id, 
      message: `Signup successful! A verification code has been sent to your ${email ? 'email' : 'phone number'}.` 
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    res.status(400).json({ error: err.message || 'Signup failed' });
  }
});

// Verify Code
app.post('/api/auth/verify', (req, res) => {
  const { userId, code } = req.body;
  const record = db.prepare('SELECT * FROM verification_codes WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1').get(userId) as any;

  if (!record || record.code !== code || new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }

  db.prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(userId);
  db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(userId);

  res.json({ message: 'Account verified' });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, phone, password } = req.body;
  console.log('Login attempt:', { email, phone });

  if (!password || (!email && !phone)) {
    console.log('Login failed: Missing credentials');
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? OR phone = ?').get(email || '', phone || '') as any;

  if (!user) {
    console.log('Login failed: User not found');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!(await bcrypt.compare(password, user.password))) {
    console.log('Login failed: Password mismatch');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_verified) {
    return res.status(403).json({ error: 'Account not verified', userId: user.id });
  }

  const token = jwt.sign({ id: user.id, wardId: user.ward_id, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, displayName: user.display_name, wardId: user.ward_id, role: user.role, profilePicture: user.profile_picture } });
});

// Update Profile
app.put('/api/users/:id', authenticate, (req: any, res) => {
  const { id } = req.params;
  const { displayName, about, profilePicture } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Only admin or the user themselves can update
  if (userRole !== 'admin' && userId !== id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    db.prepare(`
      UPDATE users 
      SET display_name = COALESCE(?, display_name), 
          about = COALESCE(?, about), 
          profile_picture = COALESCE(?, profile_picture)
      WHERE id = ?
    `).run(displayName, about, profilePicture, id);

    // Broadcast update to the ward
    const user = db.prepare('SELECT id, display_name, profile_picture, about, ward_id FROM users WHERE id = ?').get(id) as any;
    if (user) {
      io.to(`ward:${user.ward_id}`).emit('profile_updated', {
        userId: user.id,
        displayName: user.display_name,
        profilePicture: user.profile_picture,
        about: user.about
      });
    }

    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update profile' });
  }
});

// Block User
app.post('/api/users/block', authenticate, (req: any, res) => {
  const { blockedId } = req.body;
  const userId = req.user.id;

  try {
    db.prepare('INSERT OR IGNORE INTO blocked_users (user_id, blocked_id) VALUES (?, ?)').run(userId, blockedId);
    res.json({ message: 'User blocked' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to block user' });
  }
});

// Get Messages for Conversation
app.get('/api/conversations/:id/messages', authenticate, (req: any, res) => {
  const { id } = req.params;
  const { deviceId } = req.query;
  const userId = req.user.id;

  try {
    // Verify user is part of the conversation
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
    if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch payloads specifically for THIS device
    const messages = db.prepare(`
      SELECT * FROM encrypted_messages 
      WHERE conversation_id = ? 
      AND recipient_device_id = ?
      AND (deleted_by IS NULL OR deleted_by NOT LIKE ?)
      ORDER BY created_at ASC
    `).all(id, deviceId, `%${userId}%`);

    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages', details: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Mark Messages as Read
app.post('/api/messages/read', authenticate, (req: any, res) => {
  const { conversationId } = req.body;
  const userId = req.user.id;

  try {
    db.prepare(`
      UPDATE encrypted_messages
      SET read = 1, delivered = 1
      WHERE conversation_id = ?
      AND recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)
    `).run(conversationId, userId);

    // Notify the other person in the conversation
    const conv = db.prepare('SELECT user1_id, user2_id FROM conversations WHERE id = ?').get(conversationId) as any;
    if (conv) {
      const otherId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
      io.to(`user:${otherId}`).emit('messages_read', { conversationId, readerId: userId });
    }

    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    console.error('Error marking messages as read:', err);
    res.status(400).json({ error: 'Failed to mark messages as read' });
  }
});

// Mark Messages as Delivered
app.post('/api/messages/delivered', authenticate, (req: any, res) => {
  const { messageIds } = req.body;
  const userId = req.user.id;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: 'No message IDs provided' });
  }

  try {
    const placeholders = messageIds.map(() => '?').join(',');
    db.prepare(`
      UPDATE encrypted_messages
      SET delivered = 1
      WHERE id IN (${placeholders})
      AND recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)
    `).run(...messageIds, userId);

    // Notify senders
    messageIds.forEach(id => {
      const msg = db.prepare('SELECT sender_id, conversation_id FROM encrypted_messages WHERE id = ?').get(id) as any;
      if (msg) {
        io.to(`user:${msg.sender_id}`).emit('message_delivered', { messageId: id, conversationId: msg.conversation_id });
      }
    });

    res.json({ message: 'Messages marked as delivered' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to mark as delivered' });
  }
});

// Admin: Get All Users
app.get('/api/admin/users', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const users = db.prepare(`
      SELECT id, email, phone, display_name, profile_picture, about, ward_id, role, is_verified, last_seen 
      FROM users
    `).all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: Update User
app.put('/api/admin/users/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const { displayName, email, phone, role, isVerified, wardId } = req.body;

  try {
    db.prepare(`
      UPDATE users 
      SET display_name = COALESCE(?, display_name),
          email = COALESCE(?, email),
          phone = COALESCE(?, phone),
          role = COALESCE(?, role),
          is_verified = COALESCE(?, is_verified),
          ward_id = COALESCE(?, ward_id)
      WHERE id = ?
    `).run(
      displayName ?? null, 
      email ?? null, 
      phone ?? null, 
      role ?? null, 
      isVerified ?? null, 
      wardId ?? null, 
      id
    );

    // Broadcast update if display name changed
    const user = db.prepare('SELECT id, display_name, profile_picture, about, ward_id, role, is_verified FROM users WHERE id = ?').get(id) as any;
    if (user) {
      io.to(`ward:${user.ward_id}`).emit('profile_updated', {
        userId: user.id,
        displayName: user.display_name,
        profilePicture: user.profile_picture,
        about: user.about,
        role: user.role,
        isVerified: user.is_verified
      });
      // Also notify the user specifically (they might need to re-login or refresh)
      io.to(`user:${id}`).emit('user_role_updated', { role: user.role });
    }

    res.json({ message: 'User updated' });
  } catch (err: any) {
    console.error('Admin update error:', err);
    res.status(400).json({ error: 'Failed to update user', details: err.message });
  }
});

// Admin: Delete User
app.delete('/api/admin/users/:id', authenticate, (req: any, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
  const { id } = req.params;

  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own admin account' });

  try {
    const user = db.prepare('SELECT ward_id FROM users WHERE id = ?').get(id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    const wardId = user.ward_id;

    db.transaction(() => {
      // 1. Delete messages (both sent and received)
      db.prepare('DELETE FROM encrypted_messages WHERE sender_id = ?').run(id);
      db.prepare('DELETE FROM encrypted_messages WHERE recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)').run(id);
      
      // 2. Delete conversations
      db.prepare('DELETE FROM conversations WHERE user1_id = ? OR user2_id = ?').run(id, id);
      
      // 3. Delete keys for user's devices
      db.prepare('DELETE FROM one_time_pre_keys WHERE device_id IN (SELECT id FROM devices WHERE user_id = ?)').run(id);
      
      // 4. Delete devices
      db.prepare('DELETE FROM devices WHERE user_id = ?').run(id);
      
      // 5. Delete other related data
      db.prepare('DELETE FROM verification_codes WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM blocked_users WHERE user_id = ? OR blocked_id = ?').run(id, id);
      db.prepare('DELETE FROM calls WHERE caller_id = ? OR recipient_id = ?').run(id, id);
      
      // 6. Finally, delete the user
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    })();

    if (wardId) {
      io.to(`ward:${wardId}`).emit('user_deleted', { userId: id });
    }
    
    res.json({ message: 'User and all related data deleted' });
  } catch (err: any) {
    console.error('Admin delete error:', err);
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

// Delete Conversation

app.delete('/api/conversations/:id', authenticate, (req: any, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any;
  if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    db.prepare('DELETE FROM encrypted_messages WHERE conversation_id = ?').run(id);
    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete conversation' });
  }
});

// Get Wards
app.get('/api/wards', (req, res) => {
  const wards = db.prepare('SELECT * FROM wards').all();
  res.json(wards);
});

// Get Deleted Messages (Trash)
app.get('/api/messages/trash', authenticate, (req: any, res) => {
  const userId = req.user.id;
  try {
    const messages = db.prepare(`
      SELECT em.*, u.display_name as sender_name
      FROM encrypted_messages em
      JOIN users u ON u.id = em.sender_id
      WHERE (em.deleted_at IS NOT NULL AND (em.sender_id = ? OR em.recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)))
      OR (em.deleted_by LIKE ?)
      ORDER BY em.deleted_at DESC, em.created_at DESC
    `).all(userId, userId, `%${userId}%`);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
});

// Device Registration
app.post('/api/devices/register', authenticate, (req: any, res) => {
  const { deviceId, deviceName, identityKey, signedPreKey, registrationId, oneTimePreKeys } = req.body;
  const userId = req.user.id;

  db.transaction(() => {
    // Delete existing device with same ID if exists
    db.prepare('DELETE FROM devices WHERE id = ?').run(deviceId);
    db.prepare('DELETE FROM one_time_pre_keys WHERE device_id = ?').run(deviceId);

    db.prepare(`
      INSERT INTO devices (id, user_id, device_name, identity_key, signed_pre_key, registration_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(deviceId, userId, deviceName, identityKey, signedPreKey, registrationId);

    const insertKey = db.prepare('INSERT INTO one_time_pre_keys (device_id, key_id, public_key) VALUES (?, ?, ?)');
    for (const key of oneTimePreKeys) {
      insertKey.run(deviceId, key.keyId, key.publicKey);
    }
  })();

  res.json({ message: 'Device registered' });
});

// Fetch Recipient Keys
app.get('/api/keys/:userId', authenticate, (req: any, res) => {
  const targetUserId = req.params.userId;
  const senderWardId = req.user.wardId;
  const senderId = req.user.id;

  // 1. Always allow fetching own keys (for sync)
  if (targetUserId === senderId) {
    const devices = db.prepare('SELECT * FROM devices WHERE user_id = ?').all(targetUserId) as any[];
    const bundles = devices.map(device => {
      const otpk = db.prepare('SELECT * FROM one_time_pre_keys WHERE device_id = ? AND used = 0 LIMIT 1').get(device.id) as any;
      return {
        deviceId: device.id,
        registrationId: device.registration_id,
        identityKey: device.identity_key,
        signedPreKey: JSON.parse(device.signed_pre_key),
        oneTimePreKey: otpk ? { keyId: otpk.key_id, publicKey: otpk.public_key } : null
      };
    });
    return res.json(bundles);
  }

  // 2. Allow if same ward OR if an active conversation exists between them
  const targetUser = db.prepare('SELECT ward_id FROM users WHERE id = ?').get(targetUserId) as any;
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  const conversationId1 = `${senderId}:${targetUserId}`;
  const conversationId2 = `${targetUserId}:${senderId}`;
  const existingConv = db.prepare('SELECT id FROM conversations WHERE id = ? OR id = ?').get(conversationId1, conversationId2);

  if (targetUser.ward_id !== senderWardId && !existingConv) {
    return res.status(403).json({ error: 'Users must be in the same ward or have an active conversation' });
  }

  const devices = db.prepare('SELECT * FROM devices WHERE user_id = ?').all(targetUserId) as any[];
  const bundles = devices.map(device => {
    const otpk = db.prepare('SELECT * FROM one_time_pre_keys WHERE device_id = ? AND used = 0 LIMIT 1').get(device.id) as any;
    if (otpk) {
      db.prepare('UPDATE one_time_pre_keys SET used = 1 WHERE id = ?').run(otpk.id);
    }
    return {
      deviceId: device.id,
      registrationId: device.registration_id,
      identityKey: device.identity_key,
      signedPreKey: JSON.parse(device.signed_pre_key),
      oneTimePreKey: otpk ? { keyId: otpk.key_id, publicKey: otpk.public_key } : null
    };
  });

  res.json(bundles);
});

// Create Conversation
app.post('/api/conversations', authenticate, (req: any, res) => {
  const { recipientId } = req.body;
  const userId = req.user.id;
  const wardId = req.user.wardId;

  const targetUser = db.prepare('SELECT ward_id FROM users WHERE id = ?').get(recipientId) as any;
  if (!targetUser || targetUser.ward_id !== wardId) {
    return res.status(403).json({ error: 'Cannot create conversation outside of ward' });
  }

  const id = [userId, recipientId].sort().join(':');
  try {
    db.prepare('INSERT OR IGNORE INTO conversations (id, user1_id, user2_id, ward_id) VALUES (?, ?, ?, ?)').run(id, userId, recipientId, wardId);
    res.json({ id });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create conversation' });
  }
});

// Get Conversations
app.get('/api/conversations', authenticate, (req: any, res) => {
  const userId = req.user.id;
  const convs = db.prepare(`
    SELECT 
      c.*, 
      u.display_name as other_name, 
      u.id as other_id, 
      u.profile_picture as other_profile_picture,
      (
        SELECT COUNT(DISTINCT em.message_group_id) 
        FROM encrypted_messages em 
        WHERE em.conversation_id = c.id 
        AND em.recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)
        AND em.sender_id != ? 
        AND em.read = 0
        AND (em.deleted_by IS NULL OR em.deleted_by NOT LIKE ?)
      ) as unread_count,
      (
        SELECT COUNT(DISTINCT em.message_group_id)
        FROM encrypted_messages em
        WHERE em.conversation_id = c.id
        AND em.recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?)
        AND em.sender_id != ?
        AND (em.deleted_by IS NULL OR em.deleted_by NOT LIKE ?)
      ) as received_count
    FROM conversations c
    JOIN users u ON (u.id = c.user1_id OR u.id = c.user2_id) AND u.id != ?
    WHERE c.user1_id = ? OR c.user2_id = ?
  `).all(userId, userId, `%${userId}%`, userId, userId, `%${userId}%`, userId, userId, userId);
  res.json(convs);
});
// Get Users in Ward
app.get('/api/users/ward', authenticate, (req: any, res) => {
  const users = db.prepare('SELECT id, display_name, about, profile_picture, last_seen FROM users WHERE ward_id = ? AND id != ?').all(req.user.wardId, req.user.id);
  res.json(users);
});

// --- WebSocket Logic ---

const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
const onlineUsers = new Set<string>(); // Set of userIds

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  if (!token) return socket.disconnect();

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userId = decoded.id;
    
    // Add to socket map
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);
    
    // Mark as online and broadcast
    if (!onlineUsers.has(userId)) {
      onlineUsers.add(userId);
      io.emit('user_status', { userId, status: 'online' });
    }

    socket.join(`user:${userId}`);
    socket.join(`ward:${decoded.wardId}`);
    
    console.log(`User connected: ${userId}`);

    // Send current online users to the newly connected user
    socket.emit('online_users', Array.from(onlineUsers));

    // Deliver offline messages
    const offlineMessages = db.prepare('SELECT * FROM encrypted_messages WHERE recipient_device_id IN (SELECT id FROM devices WHERE user_id = ?) AND delivered = 0').all(userId) as any[];
    for (const msg of offlineMessages) {
      socket.emit('message', msg);
      db.prepare('UPDATE encrypted_messages SET delivered = 1 WHERE id = ?').run(msg.id);
      // Notify the sender that the message was delivered
      io.to(`user:${msg.sender_id}`).emit('message_delivered', { messageId: msg.id, conversationId: msg.conversation_id });
    }

    socket.on('send_message', (data) => {
      const { conversationId, payloads, messageGroupId: clientMessageGroupId } = data;
      
      const conv = db.prepare('SELECT user1_id, user2_id, ward_id FROM conversations WHERE id = ?').get(conversationId) as any;
      if (!conv || conv.ward_id !== decoded.wardId) return;

      const messageGroupId = clientMessageGroupId || uuidv4();
      const recipientId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;

      for (const [deviceId, payload] of Object.entries(payloads)) {
        const msgId = uuidv4();
        db.prepare(`
          INSERT INTO encrypted_messages (id, message_group_id, conversation_id, sender_id, recipient_device_id, payload)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(msgId, messageGroupId, conversationId, userId, deviceId, JSON.stringify(payload));

        // Find who this device belongs to
        const device = db.prepare('SELECT user_id FROM devices WHERE id = ?').get(deviceId) as any;
        if (device) {
          // Emit to the target user (could be recipient or sender's other device for sync)
          io.to(`user:${device.user_id}`).emit('message', {
            id: msgId,
            messageGroupId,
            conversationId,
            senderId: userId,
            sender_id: userId,
            recipientDeviceId: deviceId,
            payload: JSON.stringify(payload),
            created_at: new Date().toISOString()
          });
        }
      }
    });

    socket.on('edit_message', (data) => {
      const { messageGroupId, payloads } = data;
      
      const now = new Date().toISOString();
      for (const [deviceId, payload] of Object.entries(payloads)) {
        db.prepare(`
          UPDATE encrypted_messages 
          SET payload = ?, edited_at = ? 
          WHERE message_group_id = ? AND recipient_device_id = ? AND sender_id = ?
        `).run(JSON.stringify(payload), now, messageGroupId, deviceId, userId);

        const device = db.prepare('SELECT user_id FROM devices WHERE id = ?').get(deviceId) as any;
        if (device) {
          io.to(`user:${device.user_id}`).emit('message_edited', {
            messageGroupId,
            recipientDeviceId: deviceId,
            payload: JSON.stringify(payload),
            editedAt: now
          });
        }
      }
    });

    socket.on('delete_message', (data) => {
      const { messageGroupId, mode } = data; // mode: 'everyone' or 'me'
      
      const now = new Date().toISOString();
      if (mode === 'everyone') {
        const msg = db.prepare('SELECT sender_id, conversation_id FROM encrypted_messages WHERE message_group_id = ? LIMIT 1').get(messageGroupId) as any;
        if (msg) {
          const conv = db.prepare('SELECT user1_id, user2_id FROM conversations WHERE id = ?').get(msg.conversation_id) as any;
          if (conv && (conv.user1_id === userId || conv.user2_id === userId)) {
            // Mark as deleted for everyone but keep data for restoration
            db.prepare('UPDATE encrypted_messages SET deleted_at = ? WHERE message_group_id = ?').run(now, messageGroupId);
            io.to(`user:${conv.user1_id}`).to(`user:${conv.user2_id}`).emit('message_deleted', { messageGroupId, mode: 'everyone', deletedAt: now });
          }
        }
      } else {
        // Delete for me
        const msgs = db.prepare('SELECT id, deleted_by FROM encrypted_messages WHERE message_group_id = ?').all(messageGroupId) as any[];
        for (const m of msgs) {
          let deletedBy = JSON.parse(m.deleted_by || '[]');
          if (!deletedBy.includes(userId)) {
            deletedBy.push(userId);
            db.prepare('UPDATE encrypted_messages SET deleted_by = ? WHERE id = ?').run(JSON.stringify(deletedBy), m.id);
          }
        }
        socket.emit('message_deleted', { messageGroupId, mode: 'me' });
      }
    });

    socket.on('restore_message', (data) => {
      const { messageGroupId } = data;
      const msg = db.prepare('SELECT conversation_id, sender_id FROM encrypted_messages WHERE message_group_id = ? LIMIT 1').get(messageGroupId) as any;
      if (msg) {
        const conv = db.prepare('SELECT user1_id, user2_id FROM conversations WHERE id = ?').get(msg.conversation_id) as any;
        if (conv && (conv.user1_id === userId || conv.user2_id === userId)) {
          db.prepare('UPDATE encrypted_messages SET deleted_at = NULL WHERE message_group_id = ?').run(messageGroupId);
          // Also remove from individual deleted_by lists if it was deleted for 'me'
          const allMsgs = db.prepare('SELECT id, deleted_by FROM encrypted_messages WHERE message_group_id = ?').all(messageGroupId) as any[];
          for (const m of allMsgs) {
            let deletedBy = JSON.parse(m.deleted_by || '[]');
            deletedBy = deletedBy.filter((id: string) => id !== userId);
            db.prepare('UPDATE encrypted_messages SET deleted_by = ? WHERE id = ?').run(JSON.stringify(deletedBy), m.id);
          }
          io.to(`user:${conv.user1_id}`).to(`user:${conv.user2_id}`).emit('message_restored', { messageGroupId });
        }
      }
    });

    socket.on('typing', (data) => {
      const { recipientId, conversationId, isTyping } = data;
      io.to(`user:${recipientId}`).emit('typing', {
        senderId: userId,
        conversationId,
        isTyping
      });
    });

    socket.on('message_reaction', (data) => {
      const { messageGroupId, emoji } = data;
      const msg = db.prepare('SELECT conversation_id, sender_id FROM encrypted_messages WHERE message_group_id = ? LIMIT 1').get(messageGroupId) as any;
      if (msg) {
        const conv = db.prepare('SELECT user1_id, user2_id FROM conversations WHERE id = ?').get(msg.conversation_id) as any;
        if (conv) {
          const targetId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
          io.to(`user:${targetId}`).emit('message_reaction', { messageGroupId, emoji });
        }
      }
    });

    // Call Signaling
    socket.on('call_request', (data) => {
      const { recipientId, callerName, type } = data; // type: 'audio' | 'video'
      const callId = uuidv4();
      
      const caller = db.prepare('SELECT profile_picture FROM users WHERE id = ?').get(userId) as any;

      // Log attempt as 'missed' initially, update if accepted
      db.prepare(`
        INSERT INTO calls (id, caller_id, recipient_id, type, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(callId, userId, recipientId, type, 'missed');

      io.to(`user:${recipientId}`).emit('call_incoming', {
        callId,
        callerId: userId,
        callerName,
        callerImage: caller?.profile_picture,
        type
      });
    });

    socket.on('call_accepted', (data) => {
      const { callId, callerId } = data;
      db.prepare('UPDATE calls SET status = ? WHERE id = ?').run('accepted', callId);
      io.to(`user:${callerId}`).emit('call_accepted', {
        callId,
        recipientId: userId
      });
    });

    socket.on('call_rejected', (data) => {
      const { callId, callerId } = data;
      db.prepare('UPDATE calls SET status = ? WHERE id = ?').run('rejected', callId);
      io.to(`user:${callerId}`).emit('call_rejected', {
        callId,
        recipientId: userId
      });
    });

    socket.on('call_timeout', (data) => {
      const { callId, recipientId } = data;
      db.prepare('UPDATE calls SET status = ? WHERE id = ?').run('missed', callId);
      io.to(`user:${recipientId}`).emit('call_ended', { callId });
    });

    socket.on('call_ended', (data) => {
      const { otherId } = data;
      io.to(`user:${otherId}`).emit('call_ended');
    });

    socket.on('ice_candidate', (data) => {
      const { otherId, candidate } = data;
      io.to(`user:${otherId}`).emit('ice_candidate', {
        candidate,
        senderId: userId
      });
    });

    socket.on('offer', (data) => {
      const { otherId, offer } = data;
      io.to(`user:${otherId}`).emit('offer', {
        offer,
        senderId: userId
      });
    });

    socket.on('answer', (data) => {
      const { otherId, answer } = data;
      io.to(`user:${otherId}`).emit('answer', {
        answer,
        senderId: userId
      });
    });

    socket.on('disconnect', () => {
      const userSocks = userSockets.get(userId);
      if (userSocks) {
        userSocks.delete(socket.id);
        if (userSocks.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          const now = new Date().toISOString();
          db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, userId);
          io.emit('user_status', { userId, status: 'offline', lastSeen: now });
        }
      }
      console.log(`User disconnected: ${userId}`);
    });
  } catch (err) {
    socket.disconnect();
  }
});

// --- Vite Integration ---
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
