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
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { users, trees, people, relationships, auditLogs, editHistory, authIdentities } from '../shared/schema.js';
import { eq, and, or, ilike, desc, lt } from 'drizzle-orm';
import { z } from 'zod';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const isReplitPreview = process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN;
if (isReplitPreview) {
  app.set('trust proxy', 1);
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

// Phase 1: JWT secret strength validation
if (JWT_SECRET.length < 32) {
  console.warn('WARNING: JWT_SECRET should be at least 32 characters for security');
  if (isProduction) {
    console.error('CRITICAL: JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

// Phase 1: ENCRYPTION_KEY validation with backward compatibility
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || JWT_SECRET;
const usingDedicatedEncryptionKey = !!process.env.ENCRYPTION_KEY;

if (!usingDedicatedEncryptionKey) {
  console.warn('WARNING: ENCRYPTION_KEY not set, falling back to JWT_SECRET. Set a dedicated ENCRYPTION_KEY for better security.');
  if (isProduction) {
    console.warn('PRODUCTION WARNING: Consider setting a dedicated ENCRYPTION_KEY environment variable.');
  }
}

// Derive a 32-byte key for AES-256-GCM from the encryption key string
const deriveEncryptionKey = (keyString) => {
  return crypto.createHash('sha256').update(keyString).digest();
};

const DERIVED_KEY = deriveEncryptionKey(ENCRYPTION_KEY);

// New AES-256-GCM encryption (more secure with IV and auth tag)
const encryptPII = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
};

// Dual-format decryption: supports new v2 format and legacy CryptoJS format
const decryptPII = (encrypted) => {
  if (!encrypted) return null;
  try {
    // New v2 format: v2:<iv>:<tag>:<ciphertext>
    if (encrypted.startsWith('v2:')) {
      const parts = encrypted.split(':');
      if (parts.length !== 4) return encrypted;
      const [, ivHex, tagHex, data] = parts;
      const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(data, 'hex', 'utf8');
      return decrypted + decipher.final('utf8');
    }
    // Legacy CryptoJS format (for backward compatibility with existing data)
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return encrypted;
  }
};

// Escape special characters for SQL LIKE/ILIKE patterns
const escapeLikePattern = (str) => {
  if (!str) return str;
  return str.replace(/[%_\\]/g, '\\$&');
};

// Normalize photo URLs from legacy /uploads/ to secure /api/photos/
const normalizePhotoUrl = (url) => {
  if (!url) return url;
  if (url.startsWith('/uploads/')) {
    return url.replace('/uploads/', '/api/photos/');
  }
  return url;
};

// XSS sanitization - escapes HTML special characters to prevent script injection
const sanitizeText = (text) => {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Sanitize object fields that contain user-generated text
const sanitizeUserInput = (obj, fieldsToSanitize) => {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = { ...obj };
  for (const field of fieldsToSanitize) {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeText(sanitized[field]);
    }
  }
  return sanitized;
};

// Magic byte signatures for allowed image types
const IMAGE_SIGNATURES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]]
};

// Verify file magic bytes match claimed MIME type
const verifyImageMagicBytes = (buffer, mimeType) => {
  // Special handling for WebP: RIFF header at 0-3, "WEBP" at bytes 8-11
  if (mimeType === 'image/webp') {
    if (buffer.length < 12) return false;
    const riffHeader = buffer.slice(0, 4);
    const webpMarker = buffer.slice(8, 12);
    return riffHeader[0] === 0x52 && riffHeader[1] === 0x49 && 
           riffHeader[2] === 0x46 && riffHeader[3] === 0x46 &&
           webpMarker[0] === 0x57 && webpMarker[1] === 0x45 && 
           webpMarker[2] === 0x42 && webpMarker[3] === 0x50; // "WEBP"
  }
  
  const signatures = IMAGE_SIGNATURES[mimeType];
  if (!signatures) return false;
  
  return signatures.some(sig => {
    if (buffer.length < sig.length) return false;
    return sig.every((byte, i) => buffer[i] === byte);
  });
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

// Request ID middleware for log correlation and debugging
app.use((req, res, next) => {
  req.requestId = uuidv4().substring(0, 8);
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

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

// Phase 1: Adjusted rate limiting (100 → 50 req/min for better security)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
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
  birthPlace: z.string().max(200).optional().nullable(),
  profession: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  email: z.string().email().max(100).optional().nullable().or(z.literal('')).or(z.null()),
  identificationNumber: z.string().max(50).optional().nullable(),
  birthOrder: z.number().int().optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable()
});

const birthOrderSchema = z.object({
  birthOrder: z.number().int().nullable().optional()
});

// Phase 2: Relaxed schema for undo operations (allows encrypted PII fields)
const personUndoSchema = z.object({
  treeId: z.number().int().positive().optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional().nullable(),
  gender: z.enum(['male', 'female']).optional(),
  birthDate: z.string().max(20).optional().nullable(),
  deathDate: z.string().max(20).optional().nullable(),
  isLiving: z.boolean().optional(),
  phone: z.string().optional().nullable(),  // Allow encrypted strings (any length)
  email: z.string().optional().nullable(),   // Allow encrypted strings (any length)
  identificationNumber: z.string().optional().nullable(),  // Allow encrypted strings
  birthOrder: z.number().int().optional().nullable(),
  birthPlace: z.string().max(200).optional().nullable(),
  profession: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable()
}).passthrough();  // Allow additional unknown fields

const relationshipUndoSchema = relationshipSchema.partial().passthrough();

const searchSchema = z.object({
  query: z.string().min(1).max(100).trim(),
  treeId: z.number().int().positive()
});

const logAudit = async (userId, action, resourceType, resourceId, details, req) => {
  const requestId = req.requestId || 'unknown';
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId: resourceId?.toString() || null,
      details: details ? { ...details, requestId } : { requestId },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });
  } catch (error) {
    console.error(`[${requestId}] Audit log error:`, error);
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
  secure: isProduction || isReplitPreview,
  sameSite: isReplitPreview ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};

const authenticateUser = async (req, res, next) => {
  const rid = req.requestId || '';
  let token = req.cookies?.auth_token;
  
  console.log(`[${rid}][Auth] ${req.method} ${req.path} - Cookie token: ${token ? 'present' : 'missing'}`);
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split('Bearer ')[1];
      console.log(`[${rid}][Auth] Using Bearer token from header`);
    }
  }
  
  if (!token) {
    console.log(`[${rid}][Auth] No token found - returning 401`);
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userType = decoded.type;
    console.log(`[${rid}][Auth] Token valid - userId: ${req.userId}`);
    next();
  } catch (jwtError) {
    console.log(`[${rid}][Auth] Token invalid or expired:`, jwtError.message);
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

const handleError = (res, error, context = 'Operation', req = null) => {
  const rid = req?.requestId || '';
  console.error(`[${rid}] ${context} error:`, error);
  
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

const normalizeEmail = (email) => {
  if (!email) return null;
  return email.toLowerCase().trim();
};

const normalizePhone = (phone) => {
  if (!phone) return null;
  let formatted = phone.trim();
  
  if (formatted.startsWith('00971')) {
    formatted = '+971' + formatted.slice(5);
  } else if (formatted.startsWith('971') && !formatted.startsWith('+')) {
    formatted = '+' + formatted;
  } else if (!formatted.startsWith('+')) {
    formatted = '+971' + formatted.replace(/^0/, '');
  }
  
  return formatted;
};

const findUserByIdentity = async (identityType, identityValue) => {
  if (!identityValue) return null;
  
  const normalized = identityType === 'phone' 
    ? normalizePhone(identityValue) 
    : normalizeEmail(identityValue);
  
  if (!normalized) return null;
  
  const [identity] = await db.select()
    .from(authIdentities)
    .where(and(
      eq(authIdentities.identityType, identityType),
      eq(authIdentities.identityValue, normalized),
      eq(authIdentities.isVerified, true)
    ));
  
  if (identity) {
    const [user] = await db.select().from(users).where(eq(users.id, identity.userId));
    return user || null;
  }
  
  return null;
};

const findUserByEmailOrPhone = async (email, phone) => {
  if (email) {
    const user = await findUserByIdentity('email', email);
    if (user) return user;
  }
  
  if (phone) {
    const user = await findUserByIdentity('phone', phone);
    if (user) return user;
  }
  
  return null;
};

const linkIdentityToUser = async (userId, identityType, identityValue, providerUserId = null, isVerified = true) => {
  if (!identityValue) return null;
  
  const normalized = identityType === 'phone' 
    ? normalizePhone(identityValue) 
    : normalizeEmail(identityValue);
  
  if (!normalized) return null;
  
  const existingIdentity = await db.select()
    .from(authIdentities)
    .where(and(
      eq(authIdentities.identityType, identityType),
      eq(authIdentities.identityValue, normalized)
    ));
  
  if (existingIdentity.length > 0) {
    if (existingIdentity[0].userId === userId) {
      return existingIdentity[0];
    }
    return null;
  }
  
  const [newIdentity] = await db.insert(authIdentities).values({
    userId,
    identityType,
    identityValue: normalized,
    providerUserId,
    isVerified
  }).returning();
  
  return newIdentity;
};

const createUserWithIdentities = async (userId, email, phone, displayName, provider) => {
  const [user] = await db.insert(users).values({
    id: userId,
    email: email || null,
    displayName: displayName || null,
    phoneNumber: phone || null,
    provider: provider || 'unknown'
  }).returning();
  
  if (email) {
    await linkIdentityToUser(userId, 'email', email, null, true);
  }
  
  if (phone) {
    await linkIdentityToUser(userId, 'phone', phone, null, true);
  }
  
  if (provider && provider !== 'phone') {
    await linkIdentityToUser(userId, provider, email || userId, userId, true);
  }
  
  return user;
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

// Authenticated photo access endpoint (secure - no public static serving)
app.get('/api/photos/:filename', authenticateUser, async (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Prevent directory traversal attacks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'اسم ملف غير صالح' });
    }
    
    const filePath = path.join(uploadsDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'الصورة غير موجودة' });
    }
    
    // Find person with this photo to verify ownership
    const personWithPhoto = await db.select().from(people)
      .where(or(
        eq(people.photoUrl, `/uploads/${filename}`),
        eq(people.photoUrl, `/api/photos/${filename}`)
      ))
      .limit(1);
    
    if (personWithPhoto.length === 0) {
      // Photo exists but not linked to any person - allow access if user is authenticated
      // This handles edge cases like recently deleted persons
      return res.sendFile(filePath);
    }
    
    // Verify tree ownership
    const ownership = await verifyTreeOwnership(personWithPhoto[0].treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: 'غير مصرح بالوصول إلى هذه الصورة' });
    }
    
    res.sendFile(filePath);
  } catch (error) {
    handleError(res, error, 'Photo access');
  }
});

app.post('/api/sms/send-code', smsLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith('00971')) {
      formattedPhone = '+971' + formattedPhone.slice(5);
    } else if (formattedPhone.startsWith('971') && !formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+971' + formattedPhone.replace(/^0/, '');
    }
    
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

    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith('00971')) {
      formattedPhone = '+971' + formattedPhone.slice(5);
    } else if (formattedPhone.startsWith('971') && !formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+971' + formattedPhone.replace(/^0/, '');
    }
    
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
    
    let existingUser = await findUserByIdentity('phone', formattedPhone);
    
    if (!existingUser) {
      const [directUser] = await db.select().from(users).where(eq(users.id, formattedPhone));
      if (directUser) {
        existingUser = directUser;
        await linkIdentityToUser(directUser.id, 'phone', formattedPhone, null, true);
      }
    }
    
    const userId = existingUser ? existingUser.id : formattedPhone;
    
    const token = jwt.sign(
      { userId: userId, type: 'phone' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    
    await logAudit(userId, 'login', 'auth', null, { provider: 'phone', linkedAccount: !!existingUser }, req);
    
    res.json({ 
      success: true, 
      verified: true,
      phoneNumber: formattedPhone,
      userId: userId,
      isLinkedAccount: !!existingUser,
      token
    });
  } catch (error) {
    console.error('SMS verify error:', error);
    handleError(res, error, 'SMS verification');
  }
});

app.post('/api/auth/token', async (req, res) => {
  try {
    const { userId, provider, firebaseIdToken, email } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!firebaseIdToken) {
      return res.status(401).json({ error: 'Firebase ID token required for authentication' });
    }
    
    let decodedToken;
    try {
      const admin = (await import('firebase-admin')).default;
      
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID
        });
      }
      
      decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
      
      if (decodedToken.uid !== userId) {
        await logAudit(userId, 'login_failed', 'auth', null, { reason: 'token_mismatch' }, req);
        return res.status(401).json({ error: 'Token does not match user ID' });
      }
    } catch (firebaseError) {
      console.error('Firebase token verification failed:', firebaseError);
      await logAudit(userId, 'login_failed', 'auth', null, { reason: 'invalid_firebase_token' }, req);
      return res.status(401).json({ error: 'Invalid Firebase token' });
    }
    
    const userEmail = email || decodedToken?.email;
    const existingUser = userEmail ? await findUserByIdentity('email', userEmail) : null;
    const resolvedUserId = existingUser ? existingUser.id : userId;
    
    const token = jwt.sign(
      { userId: resolvedUserId, type: provider || 'firebase' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.cookie('auth_token', token, COOKIE_OPTIONS);
    
    await logAudit(resolvedUserId, 'login', 'auth', null, { provider, linkedAccount: !!existingUser }, req);
    
    res.json({ token, userId: resolvedUserId, isLinkedAccount: !!existingUser });
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

app.get('/api/debug/session', optionalAuth, async (req, res) => {
  try {
    const cookiePresent = !!req.cookies?.auth_token;
    const jwtUser = req.userId || null;
    
    let treesCount = 0;
    if (jwtUser) {
      const userTrees = await db.select().from(trees).where(eq(trees.createdBy, jwtUser));
      treesCount = userTrees.length;
    }
    
    res.json({
      cookiePresent,
      authenticated: !!jwtUser,
      jwtUserId: jwtUser,
      treesForUser: treesCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.use('/api/users', apiLimiter);
app.use('/api/trees', apiLimiter);
app.use('/api/people', apiLimiter);
app.use('/api/relationships', apiLimiter);

app.post('/api/users', authenticateUser, async (req, res) => {
  try {
    const validatedData = userCreateSchema.parse(req.body);
    
    console.log(`[Users] POST - req.userId: "${req.userId}", validatedData.id: "${validatedData.id}"`);
    
    if (req.userId !== validatedData.id) {
      console.log(`[Users] Mismatch! req.userId !== validatedData.id`);
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
    
    if (validatedData.email) {
      await linkIdentityToUser(validatedData.id, 'email', validatedData.email, null, true);
    }
    if (validatedData.phoneNumber) {
      await linkIdentityToUser(validatedData.id, 'phone', validatedData.phoneNumber, null, true);
    }
    if (validatedData.provider && validatedData.provider !== 'phone') {
      await linkIdentityToUser(validatedData.id, validatedData.provider, validatedData.email || validatedData.id, validatedData.id, true);
    }
    
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
    
    console.log(`[Trees] GET - req.userId: "${req.userId}", query.userId: "${userId}"`);
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (req.userId !== userId) {
      console.log(`[Trees] Mismatch! req.userId !== query.userId`);
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
    
    // Sanitize text fields to prevent XSS
    const sanitizedData = sanitizeUserInput(validatedData, ['name', 'description']);
    
    const [tree] = await db.insert(trees).values({
      name: sanitizedData.name,
      description: sanitizedData.description || null,
      createdBy: sanitizedData.createdBy
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
      identificationNumber: decryptPII(person.identificationNumber),
      photoUrl: normalizePhotoUrl(person.photoUrl)
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
    
    const escapedQuery = escapeLikePattern(query);
    const searchResults = await db.select().from(people).where(
      and(
        eq(people.treeId, parsedTreeId),
        or(
          ilike(people.firstName, `%${escapedQuery}%`),
          ilike(people.lastName, `%${escapedQuery}%`)
        )
      )
    );
    
    const decryptedResults = searchResults.map(person => ({
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber),
      photoUrl: normalizePhotoUrl(person.photoUrl)
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
    
    // Sanitize text fields to prevent XSS
    const sanitizedData = sanitizeUserInput(validatedData, ['firstName', 'lastName']);
    
    const personData = {
      treeId: sanitizedData.treeId,
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName || null,
      gender: sanitizedData.gender,
      birthDate: sanitizedData.birthDate || null,
      deathDate: sanitizedData.deathDate || null,
      isLiving: sanitizedData.isLiving !== undefined ? sanitizedData.isLiving : true,
      phone: encryptPII(sanitizedData.phone),
      email: encryptPII(sanitizedData.email),
      identificationNumber: encryptPII(sanitizedData.identificationNumber),
      birthOrder: sanitizedData.birthOrder || null,
      photoUrl: sanitizedData.photoUrl || null
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
    
    // Sanitize text fields to prevent XSS
    const sanitizedData = sanitizeUserInput(validatedData, ['firstName', 'lastName', 'birthPlace', 'profession', 'company', 'address']);
    
    const [existingPerson] = await db.select().from(people).where(eq(people.id, personId));
    if (!existingPerson) {
      return res.status(404).json({ error: 'Person not found' });
    }
    
    const ownership = await verifyTreeOwnership(existingPerson.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }
    
    const personData = {};
    if (sanitizedData.firstName !== undefined) personData.firstName = sanitizedData.firstName;
    if (sanitizedData.lastName !== undefined) personData.lastName = sanitizedData.lastName || null;
    if (sanitizedData.gender !== undefined) personData.gender = sanitizedData.gender;
    if (sanitizedData.birthDate !== undefined) personData.birthDate = sanitizedData.birthDate || null;
    if (sanitizedData.deathDate !== undefined) personData.deathDate = sanitizedData.deathDate || null;
    if (sanitizedData.isLiving !== undefined) personData.isLiving = sanitizedData.isLiving;
    if (sanitizedData.phone !== undefined) personData.phone = encryptPII(sanitizedData.phone);
    if (sanitizedData.email !== undefined) personData.email = encryptPII(sanitizedData.email);
    if (sanitizedData.identificationNumber !== undefined) personData.identificationNumber = encryptPII(sanitizedData.identificationNumber);
    if (sanitizedData.birthOrder !== undefined) personData.birthOrder = sanitizedData.birthOrder;
    if (sanitizedData.photoUrl !== undefined) personData.photoUrl = sanitizedData.photoUrl;
    if (sanitizedData.birthPlace !== undefined) personData.birthPlace = sanitizedData.birthPlace || null;
    if (sanitizedData.profession !== undefined) personData.profession = sanitizedData.profession || null;
    if (sanitizedData.company !== undefined) personData.company = sanitizedData.company || null;
    if (sanitizedData.address !== undefined) personData.address = sanitizedData.address || null;
    
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
    
    // Verify magic bytes match claimed MIME type
    const filePath = path.join(uploadsDir, req.file.filename);
    const fileBuffer = fs.readFileSync(filePath);
    const headerBytes = fileBuffer.slice(0, 12);
    
    if (!verifyImageMagicBytes(headerBytes, req.file.mimetype)) {
      // Delete the invalid file
      fs.unlinkSync(filePath);
      console.warn(`[${req.requestId}] Rejected file with mismatched magic bytes: ${req.file.mimetype}`);
      return res.status(400).json({ error: 'نوع الملف غير صالح. تأكد من أن الملف صورة حقيقية' });
    }
    
    const photoUrl = `/api/photos/${req.file.filename}`;
    
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

// Phase 2: Undo handler with Zod validation for previousData
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
        // Phase 2: Validate previousData before restoring (uses relaxed schema for encrypted fields)
        const validatedData = personUndoSchema.parse(historyEntry.previousData);
        await db.update(people).set(validatedData).where(eq(people.id, historyEntry.resourceId));
      } else if (historyEntry.resourceType === 'relationship') {
        // Phase 2: Validate relationship data before restoring
        const { id, createdAt, ...relData } = historyEntry.previousData;
        const validatedData = relationshipUndoSchema.parse(relData);
        await db.update(relationships).set(validatedData).where(eq(relationships.id, historyEntry.resourceId));
      }
    } else if (historyEntry.action === 'delete' && historyEntry.previousData) {
      if (historyEntry.resourceType === 'person') {
        // Phase 2: Validate person data before restoring (uses relaxed schema for encrypted fields)
        const { id, createdAt, ...personData } = historyEntry.previousData;
        const validatedData = personUndoSchema.parse({ ...personData, treeId: historyEntry.treeId });
        await db.insert(people).values(validatedData);
      } else if (historyEntry.resourceType === 'relationship') {
        // Phase 2: Validate relationship data before restoring
        const { id, createdAt, ...relData } = historyEntry.previousData;
        const validatedData = relationshipUndoSchema.parse({ ...relData, treeId: historyEntry.treeId });
        await db.insert(relationships).values(validatedData);
      }
    }
    
    await logAudit(req.userId, 'undo', historyEntry.resourceType, historyEntry.resourceId, { action: historyEntry.action }, req);
    
    res.json({ success: true, message: 'تم التراجع بنجاح' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'لا يمكن التراجع: بيانات غير صالحة', details: error.errors });
    }
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
      identificationNumber: decryptPII(p.identificationNumber),
      photoUrl: normalizePhotoUrl(p.photoUrl)
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

// Audit log cleanup - removes logs older than 90 days
const AUDIT_LOG_RETENTION_DAYS = 90;
const cleanupAuditLogs = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AUDIT_LOG_RETENTION_DAYS);
    
    const result = await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoffDate));
    console.log(`[Audit Cleanup] Removed audit logs older than ${AUDIT_LOG_RETENTION_DAYS} days`);
  } catch (error) {
    console.error('[Audit Cleanup] Error:', error.message);
  }
};

// Run cleanup once on startup and then every 24 hours
cleanupAuditLogs();
setInterval(cleanupAuditLogs, 24 * 60 * 60 * 1000);

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
