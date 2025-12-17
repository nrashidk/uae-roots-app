import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import twilio from 'twilio';
import path from 'path';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { users, trees, people, relationships } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : [
      'https://*.replit.dev',
      'https://*.repl.co',
      /\.replit\.dev$/,
      /\.repl\.co$/
    ];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      if (allowed.includes('*')) {
        const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return pattern.test(origin);
      }
      return allowed === origin;
    });
    
    if (isAllowed || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
  birthOrder: z.number().int().optional().nullable()
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
  birthOrder: z.number().int().optional().nullable()
});

const birthOrderSchema = z.object({
  birthOrder: z.number().int().nullable().optional()
});

const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userType = decoded.type;
    next();
  } catch (jwtError) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      req.userType = decoded.type;
    } catch (error) {
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
  
  if (process.env.NODE_ENV === 'production') {
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
      return res.status(400).json({ error: 'رمز التحقق غير صحيح' });
    }
    
    const token = jwt.sign(
      { userId: formattedPhone, type: 'phone' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
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
        return res.status(401).json({ error: 'Token does not match user ID' });
      }
    } catch (firebaseError) {
      console.error('Firebase token verification failed:', firebaseError);
      return res.status(401).json({ error: 'Invalid Firebase token' });
    }
    
    const token = jwt.sign(
      { userId, type: provider || 'firebase' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    res.json({ token });
  } catch (error) {
    handleError(res, error, 'Token generation');
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
      return res.status(403).json({ error: 'Access denied: Cannot create/update other users' });
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
      return res.status(403).json({ error: 'Access denied' });
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
      return res.status(403).json({ error: 'Access denied' });
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
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const userTrees = await db.select().from(trees).where(eq(trees.createdBy, userId));
    
    for (const tree of userTrees) {
      await db.delete(relationships).where(eq(relationships.treeId, tree.id));
      await db.delete(people).where(eq(people.treeId, tree.id));
      await db.delete(trees).where(eq(trees.id, tree.id));
    }
    
    await db.delete(users).where(eq(users.id, userId));
    
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
      return res.status(403).json({ error: 'Access denied' });
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
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [tree] = await db.insert(trees).values({
      name: validatedData.name,
      description: validatedData.description || null,
      createdBy: validatedData.createdBy
    }).returning();
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
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await db.delete(relationships).where(eq(relationships.treeId, treeId));
    await db.delete(people).where(eq(people.treeId, treeId));
    await db.delete(trees).where(eq(trees.id, treeId));
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
    res.json(allPeople);
  } catch (error) {
    handleError(res, error, 'People fetch');
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
      phone: validatedData.phone || null,
      email: validatedData.email || null,
      identificationNumber: validatedData.identificationNumber || null,
      birthOrder: validatedData.birthOrder || null
    };
    const [person] = await db.insert(people).values(personData).returning();
    res.json(person);
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
    if (validatedData.phone !== undefined) personData.phone = validatedData.phone || null;
    if (validatedData.email !== undefined) personData.email = validatedData.email || null;
    if (validatedData.identificationNumber !== undefined) personData.identificationNumber = validatedData.identificationNumber || null;
    if (validatedData.birthOrder !== undefined) personData.birthOrder = validatedData.birthOrder;
    
    const [person] = await db.update(people)
      .set(personData)
      .where(eq(people.id, personId))
      .returning();
    res.json(person);
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
    
    await db.delete(people).where(eq(people.id, personId));
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
    
    await db.delete(relationships).where(eq(relationships.id, relId));
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, 'Relationship delete');
  }
});

if (process.env.NODE_ENV === 'production') {
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
