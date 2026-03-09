import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const dbPath = path.join(dataDir, 'auth.json');
const distDir = path.join(rootDir, 'dist');
const port = Number(process.env.PORT || 8080);
const jwtSecret = process.env.JWT_SECRET || 'change-this-secret-in-production';
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const isProduction = process.env.NODE_ENV === 'production';

await fs.mkdir(dataDir, { recursive: true });

const adapter = new JSONFile(dbPath);
const db = new Low(adapter, {
  users: [],
  verificationTokens: []
});

await db.read();
db.data ||= { users: [], verificationTokens: [] };
await db.write();

const app = express();

app.use(express.json());
app.use(cookieParser());

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  email_verified: Boolean(user.email_verified),
  dashboard_layout: user.dashboard_layout ?? null,
  dashboard_market: user.dashboard_market ?? 'saudi',
  alpaca_api_key: user.alpaca_api_key ?? '',
  alpaca_secret_key: user.alpaca_secret_key ?? '',
  alpaca_base_url: user.alpaca_base_url ?? ''
});

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const createSessionToken = (userId) => jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '30d' });

const setSessionCookie = (res, token) => {
  res.cookie('dfa_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 30,
    path: '/'
  });
};

const clearSessionCookie = (res) => {
  res.clearCookie('dfa_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  });
};

const getSessionUser = async (req) => {
  const token = req.cookies?.dfa_session;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, jwtSecret);
    return db.data.users.find((user) => user.id === payload.sub) || null;
  } catch {
    return null;
  }
};

const authRequired = async (req, res, next) => {
  const user = await getSessionUser(req);
  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  req.user = user;
  next();
};

const createVerificationRecord = async (userId) => {
  const token = nanoid(40);
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
  db.data.verificationTokens = db.data.verificationTokens.filter((item) => item.userId !== userId);
  db.data.verificationTokens.push({ token, userId, expiresAt, createdAt: new Date().toISOString() });
  await db.write();
  return token;
};

const getTransporter = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`Verification link for ${user.email}: ${verifyUrl}`);
    return { previewUrl: verifyUrl, sent: false };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Verify your email address',
    html: `<div style="font-family: Arial, sans-serif; direction: ltr; line-height:1.6"><h2>Verify your email</h2><p>Hello ${user.name},</p><p>Click the link below to activate your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>This link expires in 24 hours.</p></div>`
  });

  return { previewUrl: null, sent: true };
};

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({ message: 'Invalid registration data' });
  }

  const exists = db.data.users.find((user) => user.email === email);
  if (exists) {
    return res.status(409).json({ message: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    name,
    email,
    passwordHash,
    email_verified: false,
    dashboard_layout: null,
    dashboard_market: 'saudi',
    created_at: new Date().toISOString(),
    alpaca_api_key: '',
    alpaca_secret_key: '',
    alpaca_base_url: ''
  };

  db.data.users.push(user);
  await db.write();

  const token = await createVerificationRecord(user.id);
  const delivery = await sendVerificationEmail(user, token);

  res.status(201).json({
    message: 'Account created. Please verify your email.',
    previewUrl: delivery.previewUrl,
    user: publicUser(user)
  });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const user = db.data.users.find((item) => item.email === email);

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.email_verified) {
    return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', message: 'Please verify your email before logging in' });
  }

  const token = createSessionToken(user.id);
  setSessionCookie(res, token);
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (_, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const user = db.data.users.find((item) => item.email === email);

  if (!user) {
    return res.json({ success: true });
  }

  if (user.email_verified) {
    return res.json({ success: true, message: 'Email already verified' });
  }

  const token = await createVerificationRecord(user.id);
  const delivery = await sendVerificationEmail(user, token);
  res.json({ success: true, previewUrl: delivery.previewUrl });
});

app.post('/api/auth/verify-email', async (req, res) => {
  const token = String(req.body?.token || '');
  const record = db.data.verificationTokens.find((item) => item.token === token);

  if (!record) {
    return res.status(400).json({ message: 'Invalid verification token' });
  }

  if (record.expiresAt < Date.now()) {
    db.data.verificationTokens = db.data.verificationTokens.filter((item) => item.token !== token);
    await db.write();
    return res.status(400).json({ message: 'Verification token has expired' });
  }

  const user = db.data.users.find((item) => item.id === record.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  user.email_verified = true;
  user.verified_at = new Date().toISOString();
  db.data.verificationTokens = db.data.verificationTokens.filter((item) => item.userId !== user.id);
  await db.write();

  const sessionToken = createSessionToken(user.id);
  setSessionCookie(res, sessionToken);
  res.json({ success: true, user: publicUser(user) });
});

app.patch('/api/auth/me', authRequired, async (req, res) => {
  const allowedFields = [
    'name',
    'dashboard_layout',
    'dashboard_market',
    'alpaca_api_key',
    'alpaca_secret_key',
    'alpaca_base_url'
  ];

  for (const field of allowedFields) {
    if (field in req.body) {
      req.user[field] = req.body[field];
    }
  }

  await db.write();
  res.json({ user: publicUser(req.user) });
});

app.use(express.static(distDir));

app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on ${port}`);
});
