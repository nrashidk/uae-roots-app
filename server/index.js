import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import twilio from 'twilio';
import path from 'path';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { users, trees, people, relationships, auditLogs, editHistory } from '../shared/schema.js';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { z } from 'zod';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || JWT_SECRET;
const isProduction = process.env.NODE_ENV === 'production';

const encryptPII = (text) => {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
};

const decryptPII = (encrypted) => {
  if (!encrypted) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return encrypted;
  }
};

const developmentOrigins = [
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000'
];

const productionOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      'https://uaeroots.com',
      'https://www.uaeroots.com',
      /\.replit\.dev$/,
      /\.repl\.co$/
    ];

const allowedOrigins = isProduction ? productionOrigins : [...developmentOrigins, ...productionOrigins];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      if (typeof allowed === 'string' && allowed.includes('*')) {
        const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return pattern.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookieParser());

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://apis.google.com", "https://*.firebaseapp.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://www.googleapis.com", "https://firebaseinstallations.googleapis.com", "https://oauth2.googleapis.com", "wss:", "ws:"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://login.microsoftonline.com", "https://*.firebaseapp.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

app.use(express.json({ limit: '1mb' }));

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مدعوم. يرجى استخدام JPEG أو PNG أو GIF أو WebP'));
    }
  }
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: { error: 'تم تجاوز الحد الأقصى للطلبات. حاول مرة أخرى لاحقاً' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'تم تجاوز الحد الأقصى لإرسال الرسائل. حاول مرة أخرى بعد 15 دقيقة' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false }
});

const phoneSchema = z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number format');
const codeSchema = z.string().regex(/^[0-9]{4,8}$/, 'Invalid verification code');

const personSchema = z.object({
  treeId: z.number().int().positive(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().max(100).trim().optional().nullable(),
  gender: z.enum(['male', 'female']),
  birthDate: z.string().max(20).optional().nullable(),
  deathDate: z.string().max(20).optional().nullable(),
  isLiving: z.boolean().optional().default(true),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(100).optional().nullable().or(z.literal('')).or(z.null()),
  identificationNumber: z.string().max(50).optional().nullable(),
  birthOrder: z.number().int().optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable()
});

const treeSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional().nullable(),
  createdBy: z.string().min(1).max(200)
});

const relationshipSchema = z.object({
  treeId: z.number().int().positive(),
  type: z.enum(['partner', 'parent-child', 'sibling']),
  person1Id: z.number().int().positive().optional().nullable(),
  person2Id: z.number().int().positive().optional().nullable(),
  childId: z.number().int().positive().optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  isBreastfeeding: z.boolean().optional().default(false),
  isDotted: z.boolean().optional().default(false)
});

const userUpdateSchema = z.object({
  email: z.string().email().max(100).optional().nullable().or(z.literal('')).or(z.null()),
  phoneNumber: z.string().max(20).optional().nullable(),
  displayName: z.string().max(200).trim().optional().nullable()
});

const userCreateSchema = z.object({
  id: z.string().min(1).max(200),
  email: z.string().email().max(100).optional().nullable().or(z.literal('')).or(z.null()),
  displayName: z.string().max(200).trim().optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  provider: z.enum(['google.com', 'microsoft.com', 'phone', 'email', 'password', 'unknown']).optional()
});

const personUpdateSchema = z.object({
  treeId: z.number().int().positive().optional(),
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().max(100).trim().optional().nullable(),
  gender: z.enum(['male', 'female']).optional(),
  birthDate: z.string().max(20).optional().nullable(),
  deathDate: z.string().max(20).optional().nullable(),
  isLiving: z.boolean().optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(100).optional().nullable().or(z.literal('')).or(z.null()),
  identificationNumber: z.string().max(50).optional().nullable(),
  birthOrder: z.number().int().optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable()
});

const birthOrderSchema = z.object({
  birthOrder: z.number().int().nullable().optional()
});

const searchSchema = z.object({
  query: z.string().min(1).max(100).trim(),
  treeId: z.number().int().positive()
});

const logAudit = async (userId, action, resourceType, resourceId, details, req) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId: resourceId?.toString() || null,
      details: details || null,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

const recordEdit = async (userId, treeId, action, resourceType, resourceId, previousData, newData) => {
  try {
    await db.insert(editHistory).values({
      userId,
      treeId,
      action,
      resourceType,
      resourceId,
      previousData: previousData || null,
      newData: newData || null
    });
  } catch (error) {
    console.error('Edit history error:', error);
  }
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/'
};

const authenticateUser = async (req, res, next) => {
  let token = req.cookies?.auth_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    }
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userType = decoded.type;
    next();
  } catch (jwtError) {
    res.clearCookie('auth_token', COOKIE_OPTIONS);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  let token = req.cookies?.auth_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
    }
  }
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      req.userType = decoded.type;
    } catch (error) {
      res.clearCookie('auth_token', COOKIE_OPTIONS);
    }
  }
  next();
};

const verifyTreeOwnership = async (treeId, userId) => {
  const [tree] = await db.select().from(trees).where(eq(trees.id, treeId));
  if (!tree) return { valid: false, error: 'Tree not found' };
  if (tree.createdBy !== userId) return { valid: false, error: 'Unauthorized access to tree' };
  return { valid: true, tree };
};

const handleError = (res, error, context = 'Operation') => {
  console.error(`${context} error:`, error);
  
  if (isProduction) {
    res.status(500).json({ error: 'حدث خطأ. يرجى المحاولة مرة أخرى' });
  } else {
    res.status(500).json({ error: error.message });
  }
};

const validateId = (id) => {
  const parsed = parseInt(id, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
};

async function getTwilioCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Twilio connector response:', text);
    throw new Error('Failed to get Twilio credentials: ' + response.status);
  }
  
  const text = await response.text();
  if (!text) {
    throw new Error('Empty response from Twilio connector');
  }
  
  const data = JSON.parse(text);
  const connectionSettings = data.items?.[0];

  if (!connectionSettings || !connectionSettings.settings.account_sid) {
    throw new Error('Twilio not connected');
  }
  return {
    accountSid: connectionSettings.settings.account_sid,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

app.use('/uploads', express.static(uploadsDir));

app.post('/api/sms/send-code', smsLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+971' + phoneNumber.replace(/^0/, '');
    
    try {
      phoneSchema.parse(formattedPhone);
    } catch (validationError) {
      return res.status(400).json({ error: 'رقم الهاتف غير صالح' });
    }
    
    const { accountSid, apiKey, apiKeySecret } = await getTwilioCredentials();
    const client = twilio(apiKey, apiKeySecret, { accountSid });
    
    const verifySid = process.env.TWILIO_VERIFY_SID;
    if (!verifySid) {
      throw new Error('Twilio Verify Service not configured');
    }

    await client.verify.v2.services(verifySid)
      .verifications
      .create({ to: formattedPhone, channel: 'sms' });

    await logAudit(formattedPhone, 'sms_sent', 'auth', null, { phone: formattedPhone }, req);

    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    console.error('SMS send error:', error);
    let userMessage = 'فشل إرسال رمز التحقق';
    if (error.code === 60200) {
      userMessage = 'رقم الهاتف غير صالح. تأكد من إدخال رقم صحيح';
    } else if (error.code === 60203) {
      userMessage = 'تم تجاوز الحد الأقصى للمحاولات. حاول مرة أخرى لاحقاً';
    } else if (error.code === 60205) {
      userMessage = 'تعذر إرسال الرسالة. حاول مرة أخرى';
    } else if (error.message?.includes('Twilio not connected')) {
      userMessage = 'خدمة الرسائل غير متصلة. يرجى التواصل مع الدعم';
    } else if (error.message?.includes('Verify Service not configured')) {
      userMessage = 'خدمة التحقق غير مهيأة. يرجى التواصل مع الدعم';
    }
    res.status(500).json({ error: userMessage });
  }
});

app.post('/api/sms/verify-code', smsLimiter, async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    
    if (!phoneNumber || !code) {
      return res.status(400).json({ error: 'Phone number and code are required' });
    }

    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+971' + phoneNumber.replace(/^0/, '');
    
    try {
      phoneSchema.parse(formattedPhone);
      codeSchema.parse(code);
    } catch (validationError) {
      return res.status(400).json({ error: 'بيانات غير صالحة' });
    }
    
    const { accountSid, apiKey, apiKeySecret } = await getTwilioCredentials();
    const client = twilio(apiKey, apiKeySecret, { accountSid });
    
    const verifySid = process.env.TWILIO_VERIFY_SID;
    if (!verifySid) {
      throw new Error('Twilio Verify Service not configured');
    }

    const verification = await client.verify.v2.services(verifySid)
      .verificationChecks
      .create({ to: formattedPhone, code: code });
    
    if (verification.status !== 'approved') {
      await logAudit(formattedPhone, 'login_failed', 'auth', null, { reason: 'invalid_code' }, req);
      return res.status(400).json({ error: 'رمز التحقق غير صحيح' });
    }
    
    const token = jwt.sign(
      { userId: formattedPhone, type: 'phone' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    
    await logAudit(formattedPhone, 'login', 'auth', null, { provider: 'phone' }, req);
    
    res.json({ 
      success: true, 
      verified: true,
      phoneNumber: formattedPhone,
      token
    });
  } catch (error) {
    console.error('SMS verify error:', error);
    handleError(res, error, 'SMS verification');
  }
});

app.post('/api/auth/token', async (req, res) => {
  try {
    const { userId, provider, firebaseIdToken } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!firebaseIdToken) {
      return res.status(401).json({ error: 'Firebase ID token required for authentication' });
    }
    
    try {
      const admin = (await import('firebase-admin')).default;
      
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID
        });
      }
      
      const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
      
      if (decodedToken.uid !== userId) {
        await logAudit(userId, 'login_failed', 'auth', null, { reason: 'token_mismatch' }, req);
        return res.status(401).json({ error: 'Token does not match user ID' });
      }
    } catch (firebaseError) {
      console.error('Firebase token verification failed:', firebaseError);
      await logAudit(userId, 'login_failed', 'auth', null, { reason: 'invalid_firebase_token' }, req);
      return res.status(401).json({ error: 'Invalid Firebase token' });
    }
    
    const token = jwt.sign(
      { userId, type: provider || 'firebase' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    
    await logAudit(userId, 'login', 'auth', null, { provider }, req);
    
    res.json({ token });
  } catch (error) {
    handleError(res, error, 'Token generation');
  }
});

app.post('/api/auth/logout', authenticateUser, async (req, res) => {
  await logAudit(req.userId, 'logout', 'auth', null, null, req);
  res.clearCookie('auth_token', COOKIE_OPTIONS);
  res.json({ success: true });
});

app.get('/api/auth/check', optionalAuth, (req, res) => {
  if (req.userId) {
    res.json({ authenticated: true, userId: req.userId });
  } else {
    res.json({ authenticated: false });
  }
});

app.use('/api/users', apiLimiter);
app.use('/api/trees', apiLimiter);
app.use('/api/people', apiLimiter);
app.use('/api/relationships', apiLimiter);

app.post('/api/users', authenticateUser, async (req, res) => {
  try {
    const validatedData = userCreateSchema.parse(req.body);
    
    if (req.userId !== validatedData.id) {
      return res.status(403).json({ error: 'غير مصرح: لا يمكن إنشاء أو تعديل مستخدمين آخرين' });
    }
    
    const existingUser = await db.select().from(users).where(eq(users.id, validatedData.id));
    
    if (existingUser.length > 0) {
      const [updatedUser] = await db.update(users)
        .set({ lastLoginAt: new Date(), displayName: validatedData.displayName, email: validatedData.email })
        .where(eq(users.id, validatedData.id))
        .returning();
      return res.json(updatedUser);
    }
    
    const [user] = await db.insert(users).values({
      id: validatedData.id,
      email: validatedData.email || null,
      displayName: validatedData.displayName || null,
      phoneNumber: validatedData.phoneNumber || null,
      provider: validatedData.provider || 'unknown'
    }).returning();
    
    await logAudit(validatedData.id, 'create', 'user', validatedData.id, null, req);
    
    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    handleError(res, error, 'User create/update');
  }
});

app.get('/api/users/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    handleError(res, error, 'User fetch');
  }
});

app.put('/api/users/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }
    
    const validatedData = userUpdateSchema.parse(req.body);
    const [updatedUser] = await db.update(users)
      .set({ 
        email: validatedData.email || null,
        phoneNumber: validatedData.phoneNumber || null,
        displayName: validatedData.displayName || null
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await logAudit(userId, 'update', 'user', userId, null, req);
    
    res.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    handleError(res, error, 'User update');
  }
});

app.delete('/api/users/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }
    
    const userTrees = await db.select().from(trees).where(eq(trees.createdBy, userId));
    
    for (const tree of userTrees) {
      await db.delete(relationships).where(eq(relationships.treeId, tree.id));
      await db.delete(people).where(eq(people.treeId, tree.id));
      await db.delete(editHistory).where(eq(editHistory.treeId, tree.id));
      await db.delete(trees).where(eq(trees.id, tree.id));
    }
    
    await db.delete(users).where(eq(users.id, userId));
    
    await logAudit(userId, 'delete', 'user', userId, { deletedTrees: userTrees.length }, req);
    
    res.clearCookie('auth_token', COOKIE_OPTIONS);
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    handleError(res, error, 'User delete');
  }
});

app.get('/api/trees', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (req.userId !== userId) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }
    
    const userTrees = await db.select().from(trees).where(eq(trees.createdBy, userId));
    res.json(userTrees);
  } catch (error) {
    handleError(res, error, 'Trees fetch');
  }
});

app.post('/api/trees', authenticateUser, async (req, res) => {
  try {
    const validatedData = treeSchema.parse(req.body);
    
    if (req.userId !== validatedData.createdBy) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }
    
    const [tree] = await db.insert(trees).values({
      name: validatedData.name,
      description: validatedData.description || null,
      createdBy: validatedData.createdBy
    }).returning();
    
    await logAudit(req.userId, 'create', 'tree', tree.id, { name: tree.name }, req);
    
    res.json(tree);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    handleError(res, error, 'Tree create');
  }
});

app.delete('/api/trees/:id', authenticateUser, async (req, res) => {
  try {
    const treeId = validateId(req.params.id);
    if (!treeId) {
      return res.status(400).json({ error: 'Invalid tree ID' });
    }
    
    const [tree] = await db.select().from(trees).where(eq(trees.id, treeId));
    if (!tree) {
      return res.status(404).json({ error: 'Tree not found' });
    }
    
    if (req.userId !== tree.createdBy) {
      return res.status(403).json({ error: 'غير مصرح بالوصول' });
    }
    
    await db.delete(relationships).where(eq(relationships.treeId, treeId));
    await db.delete(people).where(eq(people.treeId, treeId));
    await db.delete(editHistory).where(eq(editHistory.treeId, treeId));
    await db.delete(trees).where(eq(trees.id, treeId));
    
    await logAudit(req.userId, 'delete', 'tree', treeId, { name: tree.name }, req);
    
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Tree delete');
  }
});

app.get('/api/people', authenticateUser, async (req, res) => {
  try {
    const { treeId } = req.query;
    
    if (!treeId) {
      return res.status(400).json({ error: 'Tree ID is required' });
    }
    
    const parsedTreeId = validateId(treeId);
    if (!parsedTreeId) {
      return res.status(400).json({ error: 'Invalid tree ID' });
    }
    
    const ownership = await verifyTreeOwnership(parsedTreeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const allPeople = await db.select().from(people).where(eq(people.treeId, parsedTreeId));
    
    const decryptedPeople = allPeople.map(person => ({
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber)
    }));
    
    res.json(decryptedPeople);
  } catch (error) {
    handleError(res, error, 'People fetch');
  }
});

app.get('/api/people/search', authenticateUser, async (req, res) => {
  try {
    const { query, treeId } = req.query;
    
    if (!query || !treeId) {
      return res.status(400).json({ error: 'Query and tree ID are required' });
    }
    
    const parsedTreeId = validateId(treeId);
    if (!parsedTreeId) {
      return res.status(400).json({ error: 'Invalid tree ID' });
    }
    
    const ownership = await verifyTreeOwnership(parsedTreeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const searchResults = await db.select().from(people).where(
      and(
        eq(people.treeId, parsedTreeId),
        or(
          ilike(people.firstName, `%${query}%`),
          ilike(people.lastName, `%${query}%`)
        )
      )
    );
    
    const decryptedResults = searchResults.map(person => ({
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber)
    }));
    
    res.json(decryptedResults);
  } catch (error) {
    handleError(res, error, 'People search');
  }
});

app.post('/api/people', authenticateUser, async (req, res) => {
  try {
    const validatedData = personSchema.parse(req.body);
    
    const ownership = await verifyTreeOwnership(validatedData.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const personData = {
      treeId: validatedData.treeId,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName || null,
      gender: validatedData.gender,
      birthDate: validatedData.birthDate || null,
      deathDate: validatedData.deathDate || null,
      isLiving: validatedData.isLiving !== undefined ? validatedData.isLiving : true,
      phone: encryptPII(validatedData.phone),
      email: encryptPII(validatedData.email),
      identificationNumber: encryptPII(validatedData.identificationNumber),
      birthOrder: validatedData.birthOrder || null,
      photoUrl: validatedData.photoUrl || null
    };
    const [person] = await db.insert(people).values(personData).returning();
    
    await recordEdit(req.userId, validatedData.treeId, 'create', 'person', person.id, null, person);
    await logAudit(req.userId, 'create', 'person', person.id, { name: person.firstName }, req);
    
    const decryptedPerson = {
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber)
    };
    
    res.json(decryptedPerson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    handleError(res, error, 'Person create');
  }
});

app.put('/api/people/:id', authenticateUser, async (req, res) => {
  try {
    const personId = validateId(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: 'Invalid person ID' });
    }
    
    const validatedData = personUpdateSchema.parse(req.body);
    
    const [existingPerson] = await db.select().from(people).where(eq(people.id, personId));
    if (!existingPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    const ownership = await verifyTreeOwnership(existingPerson.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const personData = {};
    if (validatedData.firstName !== undefined) personData.firstName = validatedData.firstName;
    if (validatedData.lastName !== undefined) personData.lastName = validatedData.lastName || null;
    if (validatedData.gender !== undefined) personData.gender = validatedData.gender;
    if (validatedData.birthDate !== undefined) personData.birthDate = validatedData.birthDate || null;
    if (validatedData.deathDate !== undefined) personData.deathDate = validatedData.deathDate || null;
    if (validatedData.isLiving !== undefined) personData.isLiving = validatedData.isLiving;
    if (validatedData.phone !== undefined) personData.phone = encryptPII(validatedData.phone);
    if (validatedData.email !== undefined) personData.email = encryptPII(validatedData.email);
    if (validatedData.identificationNumber !== undefined) personData.identificationNumber = encryptPII(validatedData.identificationNumber);
    if (validatedData.birthOrder !== undefined) personData.birthOrder = validatedData.birthOrder;
    if (validatedData.photoUrl !== undefined) personData.photoUrl = validatedData.photoUrl;
    
    const [person] = await db.update(people)
      .set(personData)
      .where(eq(people.id, personId))
      .returning();
    
    await recordEdit(req.userId, existingPerson.treeId, 'update', 'person', personId, existingPerson, person);
    await logAudit(req.userId, 'update', 'person', personId, null, req);
    
    const decryptedPerson = {
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber)
    };
    
    res.json(decryptedPerson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    handleError(res, error, 'Person update');
  }
});

app.delete('/api/people/:id', authenticateUser, async (req, res) => {
  try {
    const personId = validateId(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: 'Invalid person ID' });
    }
    
    const [existingPerson] = await db.select().from(people).where(eq(people.id, personId));
    if (!existingPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    const ownership = await verifyTreeOwnership(existingPerson.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    await recordEdit(req.userId, existingPerson.treeId, 'delete', 'person', personId, existingPerson, null);
    
    await db.delete(people).where(eq(people.id, personId));
    
    await logAudit(req.userId, 'delete', 'person', personId, { name: existingPerson.firstName }, req);
    
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Person delete');
  }
});

app.patch('/api/people/:id/birthOrder', authenticateUser, async (req, res) => {
  try {
    const personId = validateId(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: 'Invalid person ID' });
    }
    
    const validatedData = birthOrderSchema.parse(req.body);
    
    const [existingPerson] = await db.select().from(people).where(eq(people.id, personId));
    if (!existingPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    const ownership = await verifyTreeOwnership(existingPerson.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const [person] = await db.update(people)
      .set({ birthOrder: validatedData.birthOrder })
      .where(eq(people.id, personId))
      .returning();
    res.json(person);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    handleError(res, error, 'Birth order update');
  }
});

app.post('/api/upload/photo', authenticateUser, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const photoUrl = `/uploads/${req.file.filename}`;
    
    await logAudit(req.userId, 'upload', 'photo', req.file.filename, { size: req.file.size }, req);
    
    res.json({ success: true, photoUrl });
  } catch (error) {
    handleError(res, error, 'Photo upload');
  }
});

app.get('/api/relationships', authenticateUser, async (req, res) => {
  try {
    const { treeId } = req.query;
    
    if (!treeId) {
      return res.status(400).json({ error: 'Tree ID is required' });
    }
    
    const parsedTreeId = validateId(treeId);
    if (!parsedTreeId) {
      return res.status(400).json({ error: 'Invalid tree ID' });
    }
    
    const ownership = await verifyTreeOwnership(parsedTreeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const allRelationships = await db.select().from(relationships).where(eq(relationships.treeId, parsedTreeId));
    res.json(allRelationships);
  } catch (error) {
    handleError(res, error, 'Relationships fetch');
  }
});

app.post('/api/relationships', authenticateUser, async (req, res) => {
  try {
    const validatedData = relationshipSchema.parse(req.body);
    
    const ownership = await verifyTreeOwnership(validatedData.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const relationshipData = {
      treeId: validatedData.treeId,
      type: validatedData.type,
      person1Id: validatedData.person1Id || null,
      person2Id: validatedData.person2Id || null,
      childId: validatedData.childId || null,
      parentId: validatedData.parentId || null,
      isBreastfeeding: validatedData.isBreastfeeding || false,
      isDotted: validatedData.isDotted || false
    };
    const [relationship] = await db.insert(relationships).values(relationshipData).returning();
    
    await recordEdit(req.userId, validatedData.treeId, 'create', 'relationship', relationship.id, null, relationship);
    await logAudit(req.userId, 'create', 'relationship', relationship.id, { type: relationship.type }, req);
    
    res.json(relationship);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    handleError(res, error, 'Relationship create');
  }
});

app.delete('/api/relationships/:id', authenticateUser, async (req, res) => {
  try {
    const relId = validateId(req.params.id);
    if (!relId) {
      return res.status(400).json({ error: 'Invalid relationship ID' });
    }
    
    const [existingRel] = await db.select().from(relationships).where(eq(relationships.id, relId));
    if (!existingRel) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    
    const ownership = await verifyTreeOwnership(existingRel.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    await recordEdit(req.userId, existingRel.treeId, 'delete', 'relationship', relId, existingRel, null);
    
    await db.delete(relationships).where(eq(relationships.id, relId));
    
    await logAudit(req.userId, 'delete', 'relationship', relId, { type: existingRel.type }, req);
    
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Relationship delete');
  }
});

app.get('/api/history/:treeId', authenticateUser, async (req, res) => {
  try {
    const treeId = validateId(req.params.treeId);
    if (!treeId) {
      return res.status(400).json({ error: 'Invalid tree ID' });
    }
    
    const ownership = await verifyTreeOwnership(treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const history = await db.select().from(editHistory)
      .where(eq(editHistory.treeId, treeId))
      .orderBy(desc(editHistory.createdAt))
      .limit(100);
    
    res.json(history);
  } catch (error) {
    handleError(res, error, 'History fetch');
  }
});

app.post('/api/history/undo/:id', authenticateUser, async (req, res) => {
  try {
    const historyId = validateId(req.params.id);
    if (!historyId) {
      return res.status(400).json({ error: 'Invalid history ID' });
    }
    
    const [historyEntry] = await db.select().from(editHistory).where(eq(editHistory.id, historyId));
    if (!historyEntry) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    
    const ownership = await verifyTreeOwnership(historyEntry.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    if (historyEntry.action === 'create' && historyEntry.resourceType === 'person') {
      await db.delete(people).where(eq(people.id, historyEntry.resourceId));
    } else if (historyEntry.action === 'update' && historyEntry.previousData) {
      if (historyEntry.resourceType === 'person') {
        await db.update(people).set(historyEntry.previousData).where(eq(people.id, historyEntry.resourceId));
      } else if (historyEntry.resourceType === 'relationship') {
        await db.update(relationships).set(historyEntry.previousData).where(eq(relationships.id, historyEntry.resourceId));
      }
    } else if (historyEntry.action === 'delete' && historyEntry.previousData) {
      if (historyEntry.resourceType === 'person') {
        const { id, ...personData } = historyEntry.previousData;
        await db.insert(people).values(personData);
      } else if (historyEntry.resourceType === 'relationship') {
        const { id, ...relData } = historyEntry.previousData;
        await db.insert(relationships).values(relData);
      }
    }
    
    await logAudit(req.userId, 'undo', historyEntry.resourceType, historyEntry.resourceId, { action: historyEntry.action }, req);
    
    res.json({ success: true, message: 'تم التراجع بنجاح' });
  } catch (error) {
    handleError(res, error, 'Undo operation');
  }
});

app.get('/api/export/:treeId', authenticateUser, async (req, res) => {
  try {
    const treeId = validateId(req.params.treeId);
    const format = req.query.format || 'json';
    
    if (!treeId) {
      return res.status(400).json({ error: 'Invalid tree ID' });
    }
    
    const ownership = await verifyTreeOwnership(treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const [tree] = await db.select().from(trees).where(eq(trees.id, treeId));
    const allPeople = await db.select().from(people).where(eq(people.treeId, treeId));
    const allRelationships = await db.select().from(relationships).where(eq(relationships.treeId, treeId));
    
    const decryptedPeople = allPeople.map(p => ({
      ...p,
      phone: decryptPII(p.phone),
      email: decryptPII(p.email),
      identificationNumber: decryptPII(p.identificationNumber)
    }));
    
    await logAudit(req.userId, 'export', 'tree', treeId, { format }, req);
    
    if (format === 'gedcom') {
      let gedcom = '0 HEAD\n1 SOUR UAE Roots\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n';
      
      decryptedPeople.forEach(p => {
        gedcom += `0 @I${p.id}@ INDI\n`;
        gedcom += `1 NAME ${p.firstName} /${p.lastName || ''}/\n`;
        gedcom += `1 SEX ${p.gender === 'male' ? 'M' : 'F'}\n`;
        if (p.birthDate) gedcom += `1 BIRT\n2 DATE ${p.birthDate}\n`;
        if (p.deathDate) gedcom += `1 DEAT\n2 DATE ${p.deathDate}\n`;
      });
      
      let famId = 1;
      const partnerRels = allRelationships.filter(r => r.type === 'partner');
      partnerRels.forEach(r => {
        gedcom += `0 @F${famId}@ FAM\n`;
        if (r.person1Id) gedcom += `1 HUSB @I${r.person1Id}@\n`;
        if (r.person2Id) gedcom += `1 WIFE @I${r.person2Id}@\n`;
        famId++;
      });
      
      gedcom += '0 TRLR\n';
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tree.name}.ged"`);
      return res.send(gedcom);
    }
    
    if (format === 'csv') {
      let csv = 'الاسم الأول,اسم العائلة,الجنس,تاريخ الميلاد,تاريخ الوفاة,على قيد الحياة,الهاتف,البريد الإلكتروني\n';
      
      decryptedPeople.forEach(p => {
        csv += `"${p.firstName}","${p.lastName || ''}","${p.gender === 'male' ? 'ذكر' : 'أنثى'}","${p.birthDate || ''}","${p.deathDate || ''}","${p.isLiving ? 'نعم' : 'لا'}","${p.phone || ''}","${p.email || ''}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tree.name}.csv"`);
      return res.send('\uFEFF' + csv);
    }
    
    if (format === 'html') {
      let html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${tree.name} - شجرة العائلة</title>
  <style>
    body { font-family: 'Sakkal Majalla', Arial, sans-serif; padding: 20px; background: #f5f5f5; }
    h1 { color: #7c3aed; text-align: center; }
    .person { background: white; border-radius: 8px; padding: 15px; margin: 10px; display: inline-block; min-width: 200px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .male { border-right: 4px solid #3b82f6; }
    .female { border-right: 4px solid #ec4899; }
    .name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
    .info { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${tree.name}</h1>
  <p style="text-align:center">${tree.description || ''}</p>
  <div style="display: flex; flex-wrap: wrap; justify-content: center;">`;
      
      decryptedPeople.forEach(p => {
        html += `
    <div class="person ${p.gender}">
      <div class="name">${p.firstName} ${p.lastName || ''}</div>
      <div class="info">${p.gender === 'male' ? 'ذكر' : 'أنثى'}</div>
      ${p.birthDate ? `<div class="info">الميلاد: ${p.birthDate}</div>` : ''}
      ${p.deathDate ? `<div class="info">الوفاة: ${p.deathDate}</div>` : ''}
    </div>`;
      });
      
      html += `
  </div>
  <p style="text-align:center; margin-top: 40px; color: #888;">تم التصدير من جذور الإمارات</p>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tree.name}.html"`);
      return res.send(html);
    }
    
    if (format === 'text') {
      let text = `${tree.name}\n${'='.repeat(tree.name.length)}\n\n`;
      if (tree.description) text += `${tree.description}\n\n`;
      
      text += `أفراد العائلة (${decryptedPeople.length}):\n${'─'.repeat(30)}\n\n`;
      
      decryptedPeople.forEach((p, i) => {
        text += `${i + 1}. ${p.firstName} ${p.lastName || ''}\n`;
        text += `   الجنس: ${p.gender === 'male' ? 'ذكر' : 'أنثى'}\n`;
        if (p.birthDate) text += `   تاريخ الميلاد: ${p.birthDate}\n`;
        if (p.deathDate) text += `   تاريخ الوفاة: ${p.deathDate}\n`;
        text += `   الحالة: ${p.isLiving ? 'على قيد الحياة' : 'متوفى'}\n\n`;
      });
      
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tree.name}.txt"`);
      return res.send(text);
    }
    
    res.json({ tree, people: decryptedPeople, relationships: allRelationships });
  } catch (error) {
    handleError(res, error, 'Export');
  }
});

if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  
  app.get('/{*path}', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
