import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import twilio from "twilio";
import path from "path";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { db } from "./db.js";
import {
  users,
  trees,
  people,
  relationships,
  auditLogs,
  editHistory,
  deletions,
  authIdentities,
} from "../shared/schema.js";
import { eq, and, or, ilike, desc, lt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the hosting platform's reverse proxy (Replit, Render, Railway, etc.)
// Required for express-rate-limit to read X-Forwarded-For and for secure cookies.
app.set("trust proxy", 1);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("CRITICAL: JWT_SECRET environment variable is required");
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";

// Verbose request-tracing logs only emit when DEBUG_LOGS=true (keeps prod logs clean, avoids logging user identifiers by default).
const debugLog = (...args) => {
  if (process.env.DEBUG_LOGS === "true") console.log(...args);
};

// Phase 1: JWT secret strength validation
if (JWT_SECRET.length < 32) {
  console.warn(
    "WARNING: JWT_SECRET should be at least 32 characters for security",
  );
  if (isProduction) {
    console.error(
      "CRITICAL: JWT_SECRET must be at least 32 characters in production",
    );
    process.exit(1);
  }
}

// ENCRYPTION_KEY must be set explicitly in production; no silent fallback to JWT_SECRET (key reuse weakens both).
if (isProduction && !process.env.ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY environment variable is required in production.");
}
// Phase 1: ENCRYPTION_KEY validation with backward compatibility
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || JWT_SECRET;
const usingDedicatedEncryptionKey = !!process.env.ENCRYPTION_KEY;

if (!usingDedicatedEncryptionKey) {
  console.warn(
    "WARNING: ENCRYPTION_KEY not set, falling back to JWT_SECRET. Set a dedicated ENCRYPTION_KEY for better security.",
  );
  if (isProduction) {
    console.warn(
      "PRODUCTION WARNING: Consider setting a dedicated ENCRYPTION_KEY environment variable.",
    );
  }
}

// Validate ENCRYPTION_KEY and JWT_SECRET are different (if dedicated key is set)
if (usingDedicatedEncryptionKey && ENCRYPTION_KEY === JWT_SECRET) {
  console.error(
    "CRITICAL: ENCRYPTION_KEY must be different from JWT_SECRET for security separation.",
  );
  process.exit(1);
}

// Derive a 32-byte key for AES-256-GCM from the encryption key string
const deriveEncryptionKey = (keyString) => {
  return crypto.createHash("sha256").update(keyString).digest();
};

const DERIVED_KEY = deriveEncryptionKey(ENCRYPTION_KEY);

// New AES-256-GCM encryption (more secure with IV and auth tag)
const encryptPII = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", DERIVED_KEY, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
};

// AES-256-GCM decryption (v2 format only - legacy CryptoJS fallback removed after data migration)
const decryptPII = (encrypted) => {
  if (!encrypted) return null;
  try {
    // Only v2 format supported: v2:<iv>:<tag>:<ciphertext>
    if (!encrypted.startsWith("v2:")) {
      console.error("Rejected legacy encryption format - data migration required");
      return "[ENCRYPTED DATA - MIGRATION REQUIRED]";
    }
    const parts = encrypted.split(":");
    if (parts.length !== 4) {
      console.error("Invalid v2 encryption format");
      return null;
    }
    const [, ivHex, tagHex, data] = parts;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      DERIVED_KEY,
      Buffer.from(ivHex, "hex"),
      { authTagLength: 16 },
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    let decrypted = decipher.update(data, "hex", "utf8");
    return decrypted + decipher.final("utf8");
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return null;
  }
};

// Escape special characters for SQL LIKE/ILIKE patterns
const escapeLikePattern = (str) => {
  if (!str) return str;
  // Escape all special LIKE characters: %, _, and backslash
  // Order matters: escape backslashes first to avoid double-escaping
  return str
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
};

// Normalize photo URL (photo upload removed, pass through as-is or null)
const normalizePhotoUrl = (url) => {
  if (!url) return null;
  return url;
};

// XSS sanitization - escapes HTML special characters to prevent script injection
const sanitizeText = (text) => {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
};

// Sanitize object fields that contain user-generated text
const sanitizeUserInput = (obj, fieldsToSanitize) => {
  if (!obj || typeof obj !== "object") return obj;
  const sanitized = { ...obj };
  for (const field of fieldsToSanitize) {
    if (sanitized[field] && typeof sanitized[field] === "string") {
      sanitized[field] = sanitizeText(sanitized[field]);
    }
  }
  return sanitized;
};

const developmentOrigins = [
  "http://localhost:5000",
  "http://localhost:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:3000",
];

const productionOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [
      "https://uaeroots.com",
      "https://www.uaeroots.com",
    ];

const allowedOrigins = isProduction
  ? productionOrigins
  : [...developmentOrigins, ...productionOrigins];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed instanceof RegExp) return allowed.test(origin);
        if (typeof allowed === "string" && allowed.includes("*")) {
          const pattern = new RegExp("^" + allowed.replace(/\*/g, ".*") + "$");
          return pattern.test(origin);
        }
        return allowed === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://*.firebaseapp.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://www.googleapis.com",
          "https://firebaseinstallations.googleapis.com",
          "https://oauth2.googleapis.com",
          "wss:",
          "ws:",
        ],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://login.microsoftonline.com",
          "https://*.firebaseapp.com",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);

app.use(express.json({ limit: "1mb" }));

// Request ID middleware for log correlation and debugging
app.use((req, res, next) => {
  req.requestId = uuidv4().substring(0, 8);
  res.setHeader("X-Request-ID", req.requestId);
  next();
});


// Helper to extract userId from JWT cookie for rate limiting (before auth middleware runs)
const extractUserIdFromCookie = (req) => {
  try {
    const token = req.cookies?.auth_token;
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || null;
  } catch {
    return null;
  }
};

// Phase 1: Adjusted rate limiting (100 → 50 req/min for better security)
// Enhanced with user ID + IP combination for authenticated endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: { error: "تم تجاوز الحد الأقصى للطلبات. حاول مرة أخرى لاحقاً" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    // Extract user ID from cookie (runs before auth middleware)
    const userId = extractUserIdFromCookie(req) || "anonymous";
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    return `${userId}:${ip}`;
  },
});

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: "تم تجاوز الحد الأقصى لإرسال الرسائل. حاول مرة أخرى بعد 15 دقيقة",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});

// Login rate limiting to prevent brute force attacks
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per IP per 15 minutes
  message: {
    error: "تم تجاوز عدد محاولات تسجيل الدخول. حاول مرة أخرى بعد 15 دقيقة",
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  skipSuccessfulRequests: true, // Don't count successful logins
});

const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{10,15}$/, "Invalid phone number format");
const codeSchema = z
  .string()
  .regex(/^[0-9]{4,8}$/, "Invalid verification code");

const personSchema = z.object({
  treeId: z.number().int().positive(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().max(100).trim().optional().nullable(),
  gender: z.enum(["male", "female"]),
  birthDate: z.string().max(20).optional().nullable(),
  birthPlace: z.string().max(200).optional().nullable(),
  deathDate: z.string().max(20).optional().nullable(),
  isLiving: z.boolean().optional().default(true),
  isBreastfed: z.boolean().optional().default(false),
  milkFatherName: z.string().max(100).optional().nullable().or(z.literal("")),
  milkMotherName: z.string().max(100).optional().nullable().or(z.literal("")),
  phone: z.string().max(20).optional().nullable(),
  email: z
    .string()
    .email()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(""))
    .or(z.null()),
  identificationNumber: z.string().max(50).optional().nullable(),
  profession: z.string().max(100).optional().nullable(),
  birthOrder: z.number().int().optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
});

const treeSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).trim().optional().nullable(),
  createdBy: z.string().min(1).max(200),
});

const relationshipSchema = z.object({
  treeId: z.number().int().positive(),
  type: z.enum(["partner", "parent-child", "sibling"]),
  person1Id: z.number().int().positive().optional().nullable(),
  person2Id: z.number().int().positive().optional().nullable(),
  childId: z.number().int().positive().optional().nullable(),
  parentId: z.number().int().positive().optional().nullable(),
  isBreastfeeding: z.boolean().optional().default(false),
  isDotted: z.boolean().optional().default(false),
});

const relationshipStatusSchema = z.object({
  status: z.enum(["married", "divorced"]),
});

const userUpdateSchema = z.object({
  email: z
    .string()
    .email()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(""))
    .or(z.null()),
  phoneNumber: z.string().max(20).optional().nullable(),
  displayName: z.string().max(200).trim().optional().nullable(),
});

const userCreateSchema = z.object({
  id: z.string().min(1).max(200),
  email: z
    .string()
    .email()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(""))
    .or(z.null()),
  displayName: z.string().max(200).trim().optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  provider: z
    .enum([
      "google.com",
      "microsoft.com",
      "phone",
      "email",
      "password",
      "unknown",
    ])
    .optional(),
});

const personUpdateSchema = z.object({
  treeId: z.number().int().positive().optional(),
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().max(100).trim().optional().nullable(),
  gender: z.enum(["male", "female"]).optional(),
  birthDate: z.string().max(20).optional().nullable(),
  birthPlace: z.string().max(200).optional().nullable(),
  deathDate: z.string().max(20).optional().nullable(),
  isLiving: z.boolean().optional(),
  isBreastfed: z.boolean().optional(),
  milkFatherName: z.string().max(100).optional().nullable().or(z.literal("")),
  milkMotherName: z.string().max(100).optional().nullable().or(z.literal("")),
  phone: z.string().max(20).optional().nullable(),
  profession: z.string().max(100).optional().nullable(),
  email: z
    .string()
    .email()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(""))
    .or(z.null()),
  identificationNumber: z.string().max(50).optional().nullable(),
  birthOrder: z.number().int().optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
});

const birthOrderSchema = z.object({
  birthOrder: z.number().int().nullable().optional(),
});

// Phase 2: Relaxed schema for undo operations (allows encrypted PII fields)
const batchDeleteSchema = z
  .object({
    treeId: z.number().int().positive(),
    // May be EMPTY: removing a marriage deletes a relationship row and often no
    // people at all. At least one of ids / relationshipIds must be populated.
    ids: z.array(z.number().int().positive()).max(500),
    relationshipIds: z.array(z.number().int().positive()).max(500).optional(),
    label: z.string().max(300).optional().nullable(),
  })
  .refine((v) => v.ids.length > 0 || (v.relationshipIds || []).length > 0, {
    message: "Nothing to delete: provide ids or relationshipIds",
  });

const personUndoSchema = z
  .object({
    treeId: z.number().int().positive().optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional().nullable(),
    gender: z.enum(["male", "female"]).optional(),
    birthDate: z.string().max(20).optional().nullable(),
    deathDate: z.string().max(20).optional().nullable(),
    isLiving: z.boolean().optional(),
    isBreastfed: z.boolean().optional(),
    phone: z.string().optional().nullable(), // Allow encrypted strings (any length)
    email: z.string().optional().nullable(), // Allow encrypted strings (any length)
    identificationNumber: z.string().optional().nullable(), // Allow encrypted strings
    birthOrder: z.number().int().optional().nullable(),
    birthPlace: z.string().max(200).optional().nullable(),
    profession: z.string().max(200).optional().nullable(),
    company: z.string().max(200).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    photoUrl: z.string().max(500).optional().nullable(),
  })
  .passthrough(); // Allow additional unknown fields

const relationshipUndoSchema = relationshipSchema.partial().passthrough();

const searchSchema = z.object({
  query: z.string().min(1).max(100).trim(),
  treeId: z.number().int().positive(),
});

// One undo stack. Every mutation writes here, not just deletes.
//
//   kind='delete'  before=[rows]  after=[]        -> undo re-inserts them
//   kind='create'  before=[]      after=[rows]    -> undo removes them
//   kind='update'  before=[old]   after=[new]     -> undo writes old back
//
// So undo is a single rule regardless of kind: remove anything in `after` whose
// id is absent from `before`, then write every `before` row back at its own id.
// Ids are preserved on purpose — editHistory stripped them on restore, which
// left every reference to the old id dangling.
const recordUndo = async ({
  treeId,
  userId,
  kind,
  groupId = null,
  label = null,
  peopleBefore = [],
  relationshipsBefore = [],
  peopleAfter = [],
  relationshipsAfter = [],
}) => {
  try {
    const [row] = await db
      .insert(deletions)
      .values({
        treeId,
        deletedBy: userId,
        kind,
        groupId,
        label,
        people: peopleBefore,
        relationships: relationshipsBefore,
        peopleAfter,
        relationshipsAfter,
      })
      .returning();
    return row;
  } catch (error) {
    // Recording must never break the operation it is recording.
    console.error("recordUndo failed:", error);
    return null;
  }
};

const logAudit = async (
  userId,
  action,
  resourceType,
  resourceId,
  details,
  req,
) => {
  const requestId = req.requestId || "unknown";
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId: resourceId?.toString() || null,
      details: details ? { ...details, requestId } : { requestId },
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
    });
  } catch (error) {
    console.error(`[${requestId}] Audit log error:`, error);
  }
};

const recordEdit = async (
  userId,
  treeId,
  action,
  resourceType,
  resourceId,
  previousData,
  newData,
) => {
  try {
    await db.insert(editHistory).values({
      userId,
      treeId,
      action,
      resourceType,
      resourceId,
      previousData: previousData || null,
      newData: newData || null,
    });
  } catch (error) {
    console.error("Edit history error:", error);
  }
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Always use secure cookies (H1: prevents cookie interception)
  sameSite: isProduction ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};

const authenticateUser = async (req, res, next) => {
  const rid = req.requestId || "";
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split("Bearer ")[1];
      debugLog(`[${rid}][Auth] Using Bearer token from header`);
    }
  }

  if (!token) {
    debugLog(`[${rid}][Auth] No token found - returning 401`);
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userType = decoded.type;
    debugLog(`[${rid}][Auth] Token valid - userId: ${req.userId}`);
    next();
  } catch (jwtError) {
    debugLog(`[${rid}][Auth] Token invalid or expired:`, jwtError.message);
    res.clearCookie("auth_token", COOKIE_OPTIONS);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const optionalAuth = async (req, res, next) => {
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split("Bearer ")[1];
    }
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      req.userType = decoded.type;
    } catch (error) {
      res.clearCookie("auth_token", COOKIE_OPTIONS);
    }
  }
  next();
};

const verifyTreeOwnership = async (treeId, userId) => {
  const [tree] = await db.select().from(trees).where(eq(trees.id, treeId));
  if (!tree) return { valid: false, error: "Tree not found" };
  if (tree.createdBy !== userId)
    return { valid: false, error: "Unauthorized access to tree" };
  return { valid: true, tree };
};

const handleError = (res, error, context = "Operation", req = null) => {
  const rid = req?.requestId || "";
  console.error(`[${rid}] ${context} error:`, error);

  if (isProduction) {
    res.status(500).json({ error: "حدث خطأ. يرجى المحاولة مرة أخرى" });
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

  if (formatted.startsWith("00971")) {
    formatted = "+971" + formatted.slice(5);
  } else if (formatted.startsWith("971") && !formatted.startsWith("+")) {
    formatted = "+" + formatted;
  } else if (!formatted.startsWith("+")) {
    formatted = "+971" + formatted.replace(/^0/, "");
  }

  return formatted;
};

const findUserByIdentity = async (identityType, identityValue) => {
  if (!identityValue) return null;

  const normalized =
    identityType === "phone"
      ? normalizePhone(identityValue)
      : normalizeEmail(identityValue);

  if (!normalized) return null;

  const [identity] = await db
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.identityType, identityType),
        eq(authIdentities.identityValue, normalized),
        eq(authIdentities.isVerified, true),
      ),
    );

  if (identity) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, identity.userId));
    return user || null;
  }

  return null;
};

const findUserByEmailOrPhone = async (email, phone) => {
  if (email) {
    const user = await findUserByIdentity("email", email);
    if (user) return user;
  }

  if (phone) {
    const user = await findUserByIdentity("phone", phone);
    if (user) return user;
  }

  return null;
};

const linkIdentityToUser = async (
  userId,
  identityType,
  identityValue,
  providerUserId = null,
  isVerified = true,
) => {
  if (!identityValue) return null;

  const normalized =
    identityType === "phone"
      ? normalizePhone(identityValue)
      : normalizeEmail(identityValue);

  if (!normalized) return null;

  const existingIdentity = await db
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.identityType, identityType),
        eq(authIdentities.identityValue, normalized),
      ),
    );

  if (existingIdentity.length > 0) {
    if (existingIdentity[0].userId === userId) {
      return existingIdentity[0];
    }
    return null;
  }

  const [newIdentity] = await db
    .insert(authIdentities)
    .values({
      userId,
      identityType,
      identityValue: normalized,
      providerUserId,
      isVerified,
    })
    .returning();

  return newIdentity;
};

const createUserWithIdentities = async (
  userId,
  email,
  phone,
  displayName,
  provider,
) => {
  const [user] = await db
    .insert(users)
    .values({
      id: userId,
      email: email || null,
      displayName: displayName || null,
      phoneNumber: phone || null,
      provider: provider || "unknown",
    })
    .returning();

  if (email) {
    await linkIdentityToUser(userId, "email", email, null, true);
  }

  if (phone) {
    await linkIdentityToUser(userId, "phone", phone, null, true);
  }

  if (provider && provider !== "phone") {
    await linkIdentityToUser(userId, provider, email || userId, userId, true);
  }

  return user;
};

async function getTwilioCredentials() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio not connected");
  }

  return { accountSid, authToken };
}

app.post("/api/sms/send-code", smsLimiter, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith("00971")) {
      formattedPhone = "+971" + formattedPhone.slice(5);
    } else if (
      formattedPhone.startsWith("971") &&
      !formattedPhone.startsWith("+")
    ) {
      formattedPhone = "+" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+971" + formattedPhone.replace(/^0/, "");
    }

    try {
      phoneSchema.parse(formattedPhone);
    } catch (validationError) {
      return res.status(400).json({ error: "رقم الهاتف غير صالح" });
    }

    const { accountSid, authToken } = await getTwilioCredentials();
    const client = twilio(accountSid, authToken);

    const verifySid = process.env.TWILIO_VERIFY_SID;
    if (!verifySid) {
      throw new Error("Twilio Verify Service not configured");
    }

    await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: formattedPhone, channel: "sms" });

    await logAudit(
      formattedPhone,
      "sms_sent",
      "auth",
      null,
      { phone: formattedPhone },
      req,
    );

    res.json({ success: true, message: "Verification code sent" });
  } catch (error) {
    console.error("SMS send error:", error);
    let userMessage = "فشل إرسال رمز التحقق";
    if (error.code === 60200) {
      userMessage = "رقم الهاتف غير صالح. تأكد من إدخال رقم صحيح";
    } else if (error.code === 60203) {
      userMessage = "تم تجاوز الحد الأقصى للمحاولات. حاول مرة أخرى لاحقاً";
    } else if (error.code === 60205) {
      userMessage = "تعذر إرسال الرسالة. حاول مرة أخرى";
    } else if (error.message?.includes("Twilio not connected")) {
      userMessage = "خدمة الرسائل غير متصلة. يرجى التواصل مع الدعم";
    } else if (error.message?.includes("Verify Service not configured")) {
      userMessage = "خدمة التحقق غير مهيأة. يرجى التواصل مع الدعم";
    }
    res.status(500).json({ error: userMessage });
  }
});

app.post("/api/sms/verify-code", smsLimiter, async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res
        .status(400)
        .json({ error: "Phone number and code are required" });
    }

    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith("00971")) {
      formattedPhone = "+971" + formattedPhone.slice(5);
    } else if (
      formattedPhone.startsWith("971") &&
      !formattedPhone.startsWith("+")
    ) {
      formattedPhone = "+" + formattedPhone;
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+971" + formattedPhone.replace(/^0/, "");
    }

    try {
      phoneSchema.parse(formattedPhone);
      codeSchema.parse(code);
    } catch (validationError) {
      return res.status(400).json({ error: "بيانات غير صالحة" });
    }

    const { accountSid, authToken } = await getTwilioCredentials();
    const client = twilio(accountSid, authToken);

    const verifySid = process.env.TWILIO_VERIFY_SID;
    if (!verifySid) {
      throw new Error("Twilio Verify Service not configured");
    }

    const verification = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: formattedPhone, code: code });

    if (verification.status !== "approved") {
      await logAudit(
        formattedPhone,
        "login_failed",
        "auth",
        null,
        { reason: "invalid_code" },
        req,
      );
      return res.status(400).json({ error: "رمز التحقق غير صحيح" });
    }

    let existingUser = await findUserByIdentity("phone", formattedPhone);

    if (!existingUser) {
      const [directUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, formattedPhone));
      if (directUser) {
        existingUser = directUser;
        await linkIdentityToUser(
          directUser.id,
          "phone",
          formattedPhone,
          null,
          true,
        );
      }
    }

    const userId = existingUser ? existingUser.id : formattedPhone;

    const token = jwt.sign({ userId: userId, type: "phone" }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.cookie("auth_token", token, COOKIE_OPTIONS);

    await logAudit(
      userId,
      "login",
      "auth",
      null,
      { provider: "phone", linkedAccount: !!existingUser },
      req,
    );

    res.json({
      success: true,
      verified: true,
      phoneNumber: formattedPhone,
      userId: userId,
      isLinkedAccount: !!existingUser,
      token,
    });
  } catch (error) {
    console.error("SMS verify error:", error);
    handleError(res, error, "SMS verification");
  }
});

app.post("/api/auth/token", loginLimiter, async (req, res) => {
  try {
    const { userId, provider, firebaseIdToken, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!firebaseIdToken) {
      return res
        .status(401)
        .json({ error: "Firebase ID token required for authentication" });
    }

    let decodedToken;
    try {
      const admin = (await import("firebase-admin")).default;

      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        });
      }

      decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);

      if (decodedToken.uid !== userId) {
        await logAudit(
          userId,
          "login_failed",
          "auth",
          null,
          { reason: "token_mismatch" },
          req,
        );
        return res.status(401).json({ error: "Token does not match user ID" });
      }
    } catch (firebaseError) {
      console.error("Firebase token verification failed:", firebaseError);
      await logAudit(
        userId,
        "login_failed",
        "auth",
        null,
        { reason: "invalid_firebase_token" },
        req,
      );
      return res.status(401).json({ error: "Invalid Firebase token" });
    }

    const userEmail = email || decodedToken?.email;
    const existingUser = userEmail
      ? await findUserByIdentity("email", userEmail)
      : null;
    const resolvedUserId = existingUser ? existingUser.id : userId;

    const token = jwt.sign(
      { userId: resolvedUserId, type: provider || "firebase" },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.cookie("auth_token", token, COOKIE_OPTIONS);

    await logAudit(
      resolvedUserId,
      "login",
      "auth",
      null,
      { provider, linkedAccount: !!existingUser },
      req,
    );

    res.json({
      token,
      userId: resolvedUserId,
      isLinkedAccount: !!existingUser,
    });
  } catch (error) {
    handleError(res, error, "Token generation");
  }
});

// ---------------------------------------------------------------------------
// Account linking. One person, several ways in.
//
// Resolution already worked before this existed: the phone path looks up a
// `phone` identity, the Firebase path an `email` one, and each falls back to
// creating a new user. What was missing is anything that records that a given
// phone and a given email are the SAME person — nothing can infer it, so it has
// to be proved by the user while signed in.
//
// Proof comes from Google itself: the client runs the popup and sends the
// resulting Firebase ID token, which the server verifies. A typed email would be
// a claim, not a proof, and would let anyone attach someone else's address.
// ---------------------------------------------------------------------------
app.get("/api/auth/identities", authenticateUser, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.userId, req.userId))
      .orderBy(authIdentities.id);
    res.json(rows);
  } catch (error) {
    handleError(res, error, "List identities", req);
  }
});

app.post("/api/auth/link/google", authenticateUser, async (req, res) => {
  try {
    const { firebaseIdToken } = req.body;
    if (!firebaseIdToken) {
      return res.status(400).json({ error: "Firebase ID token required" });
    }

    let decoded;
    try {
      const admin = (await import("firebase-admin")).default;
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        });
      }
      decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    } catch (firebaseError) {
      console.error("Link: Firebase token verification failed:", firebaseError);
      return res.status(401).json({ error: "تعذّر التحقق من حساب Google" });
    }

    const email = decoded?.email;
    if (!email) {
      return res
        .status(400)
        .json({ error: "لا يوجد بريد إلكتروني في حساب Google" });
    }

    // Collision: refuse and name it. NEVER merge — moving a tree between accounts
    // on the strength of a matching address is not something to do silently.
    const normalized = normalizeEmail(email);
    const [claimed] = await db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.identityType, "email"),
          eq(authIdentities.identityValue, normalized),
        ),
      );
    if (claimed && claimed.userId !== req.userId) {
      await logAudit(
        req.userId,
        "link_failed",
        "auth",
        null,
        { reason: "identity_belongs_to_another_user", email: normalized },
        req,
      );
      return res.status(409).json({
        error:
          "هذا البريد الإلكتروني مرتبط بحساب آخر. سجّل الدخول به أولاً أو استخدم بريداً غيره.",
      });
    }
    if (claimed) {
      return res.json({ success: true, alreadyLinked: true });
    }

    await linkIdentityToUser(req.userId, "email", email, decoded.uid, true);
    await linkIdentityToUser(req.userId, "google.com", email, decoded.uid, true);

    await logAudit(
      req.userId,
      "link",
      "auth",
      null,
      { provider: "google.com", email: normalized },
      req,
    );

    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Link Google", req);
  }
});

app.delete("/api/auth/identities/:id", authenticateUser, async (req, res) => {
  try {
    const identityId = validateId(req.params.id);
    if (!identityId) {
      return res.status(400).json({ error: "Invalid identity ID" });
    }

    const [identity] = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.id, identityId));
    if (!identity || identity.userId !== req.userId) {
      return res.status(404).json({ error: "Identity not found" });
    }

    // A person must always keep a way in. Removing the last identity would lock
    // them out of their own tree with no way back and no support channel.
    const own = await db
      .select()
      .from(authIdentities)
      .where(eq(authIdentities.userId, req.userId));

    // One login method writes SEVERAL rows — a Google link writes both `email`
    // and `google.com`, a Microsoft one `email` and `microsoft.com`, and they
    // share the same identityValue. So group by value, not by type: counting
    // rows would let someone remove the `google.com` row and keep an orphan
    // `email` row that no longer corresponds to any way in.
    const methods = new Set(own.map((r) => r.identityValue));
    if (methods.size <= 1) {
      return res.status(400).json({
        error: "لا يمكن إزالة طريقة تسجيل الدخول الوحيدة.",
      });
    }

    const toRemove = own.filter((r) => r.identityValue === identity.identityValue);
    await db.delete(authIdentities).where(
      inArray(
        authIdentities.id,
        toRemove.map((r) => r.id),
      ),
    );

    await logAudit(
      req.userId,
      "unlink",
      "auth",
      null,
      { method: identity.identityValue, rows: toRemove.length },
      req,
    );

    res.json({ success: true, removed: toRemove.length });
  } catch (error) {
    handleError(res, error, "Unlink identity", req);
  }
});

// Send a verification code FOR LINKING. Deliberately separate from
// /api/sms/send-code, which is the login path and knows nothing about who is
// asking — it will happily message a number that already belongs to someone
// else, and the refusal then arrives after Twilio has been paid. Checking here
// means a number that cannot be linked never costs a message.
app.post(
  "/api/auth/link/phone/send",
  authenticateUser,
  smsLimiter,
  async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      const formattedPhone = normalizePhone(phoneNumber);
      if (!formattedPhone) {
        return res.status(400).json({ error: "رقم هاتف غير صالح" });
      }

      const [claimed] = await db
        .select()
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.identityType, "phone"),
            eq(authIdentities.identityValue, formattedPhone),
          ),
        );
      if (claimed && claimed.userId !== req.userId) {
        await logAudit(
          req.userId,
          "link_failed",
          "auth",
          null,
          { reason: "identity_belongs_to_another_user", phone: formattedPhone },
          req,
        );
        return res.status(409).json({
          error:
            "رقم الهاتف هذا مرتبط بحساب آخر. سجّل الدخول به أولاً أو استخدم رقماً غيره.",
        });
      }
      if (claimed) {
        return res.status(400).json({ error: "هذا الرقم مرتبط بحسابك بالفعل" });
      }

      try {
        const twilio = (await import("twilio")).default;
        // Same credentials and the same service SID as the login path. Reading
        // env vars directly here, and inventing TWILIO_VERIFY_SERVICE_SID for
        // the service, meant services(undefined) and every send failed.
        const { accountSid, authToken } = await getTwilioCredentials();
        const client = twilio(accountSid, authToken);
        const verifySid = process.env.TWILIO_VERIFY_SID;
        if (!verifySid) {
          return res.status(500).json({ error: "خدمة التحقق غير مهيأة" });
        }
        await client.verify.v2
          .services(verifySid)
          .verifications.create({ to: formattedPhone, channel: "sms" });
      } catch (twilioError) {
        console.error("Link phone: Twilio send failed:", twilioError);
        return res.status(500).json({ error: "تعذّر إرسال رمز التحقق" });
      }

      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Link phone send", req);
    }
  },
);

// Linking a phone is the mirror of linking Google, but the proof is different:
// Google's popup proves ownership by returning a signed token, a phone proves it
// by receiving an SMS code. Same Twilio verification as login — it just attaches
// the identity instead of issuing a session.
//
// The code is sent by the existing /api/sms/send-code. Only the check differs.
app.post(
  "/api/auth/link/phone",
  authenticateUser,
  smsLimiter,
  async (req, res) => {
    try {
      const { phoneNumber, code } = req.body;
      if (!phoneNumber || !code) {
        return res
          .status(400)
          .json({ error: "رقم الهاتف ورمز التحقق مطلوبان" });
      }

      const formattedPhone = normalizePhone(phoneNumber);
      if (!formattedPhone) {
        return res.status(400).json({ error: "رقم هاتف غير صالح" });
      }

      // Refuse BEFORE spending a verification: no point proving ownership of a
      // number that is already someone else's way in.
      const [claimed] = await db
        .select()
        .from(authIdentities)
        .where(
          and(
            eq(authIdentities.identityType, "phone"),
            eq(authIdentities.identityValue, formattedPhone),
          ),
        );
      if (claimed && claimed.userId !== req.userId) {
        await logAudit(
          req.userId,
          "link_failed",
          "auth",
          null,
          { reason: "identity_belongs_to_another_user", phone: formattedPhone },
          req,
        );
        return res.status(409).json({
          error:
            "رقم الهاتف هذا مرتبط بحساب آخر. سجّل الدخول به أولاً أو استخدم رقماً غيره.",
        });
      }
      if (claimed) {
        return res.json({ success: true, alreadyLinked: true });
      }

      let verification;
      try {
        const twilio = (await import("twilio")).default;
        const { accountSid, authToken } = await getTwilioCredentials();
        const client = twilio(accountSid, authToken);
        const verifySid = process.env.TWILIO_VERIFY_SID;
        if (!verifySid) {
          return res.status(500).json({ error: "خدمة التحقق غير مهيأة" });
        }
        verification = await client.verify.v2
          .services(verifySid)
          .verificationChecks.create({ to: formattedPhone, code });
      } catch (twilioError) {
        console.error("Link phone: Twilio check failed:", twilioError);
        return res.status(500).json({ error: "تعذّر التحقق من الرمز" });
      }

      if (verification.status !== "approved") {
        return res.status(400).json({ error: "رمز التحقق غير صحيح" });
      }

      await linkIdentityToUser(req.userId, "phone", formattedPhone, null, true);

      await logAudit(
        req.userId,
        "link",
        "auth",
        null,
        { provider: "phone", phone: formattedPhone },
        req,
      );

      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Link phone", req);
    }
  },
);

app.post("/api/auth/logout", authenticateUser, async (req, res) => {
  await logAudit(req.userId, "logout", "auth", null, null, req);
  res.clearCookie("auth_token", COOKIE_OPTIONS);
  res.json({ success: true });
});

app.get("/api/auth/check", optionalAuth, (req, res) => {
  if (req.userId) {
    res.json({ authenticated: true, userId: req.userId });
  } else {
    res.json({ authenticated: false });
  }
});

app.use("/api/users", apiLimiter);
app.use("/api/trees", apiLimiter);
app.use("/api/people", apiLimiter);
app.use("/api/relationships", apiLimiter);

app.post("/api/users", authenticateUser, async (req, res) => {
  const rid = req.requestId || "";
  console.log(`[${rid}][Users] POST - incoming body:`, JSON.stringify(req.body));
  console.log(`[${rid}][Users] POST - req.userId from JWT: "${req.userId}"`);
  
  try {
    const validatedData = userCreateSchema.parse(req.body);

    console.log(
      `[${rid}][Users] POST - req.userId: "${req.userId}", validatedData.id: "${validatedData.id}"`,
    );

    if (req.userId !== validatedData.id) {
      console.log(`[Users] Mismatch! req.userId !== validatedData.id`);
      return res
        .status(403)
        .json({ error: "غير مصرح: لا يمكن إنشاء أو تعديل مستخدمين آخرين" });
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, validatedData.id));

    if (existingUser.length > 0) {
      const [updatedUser] = await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          displayName: validatedData.displayName,
          email: validatedData.email,
        })
        .where(eq(users.id, validatedData.id))
        .returning();

      return res.json(updatedUser);
    }

    const [user] = await db
      .insert(users)
      .values({
        id: validatedData.id,
        email: validatedData.email || null,
        displayName: validatedData.displayName || null,
        phoneNumber: validatedData.phoneNumber || null,
        provider: validatedData.provider || "unknown",
      })
      .returning();

    if (validatedData.email) {
      await linkIdentityToUser(
        validatedData.id,
        "email",
        validatedData.email,
        null,
        true,
      );
    }
    if (validatedData.phoneNumber) {
      await linkIdentityToUser(
        validatedData.id,
        "phone",
        validatedData.phoneNumber,
        null,
        true,
      );
    }
    if (validatedData.provider && validatedData.provider !== "phone") {
      await linkIdentityToUser(
        validatedData.id,
        validatedData.provider,
        validatedData.email || validatedData.id,
        validatedData.id,
        true,
      );
    }

    await logAudit(
      validatedData.id,
      "create",
      "user",
      validatedData.id,
      null,
      req,
    );

    res.json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    }
    handleError(res, error, "User create/update");
  }
});

app.get("/api/users/:id", authenticateUser, async (req, res) => {
  try {
    const userId = req.params.id;

    if (req.userId !== userId) {
      return res.status(403).json({ error: "غير مصرح بالوصول" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    handleError(res, error, "User fetch");
  }
});

app.put("/api/users/:id", authenticateUser, async (req, res) => {
  try {
    const userId = req.params.id;

    if (req.userId !== userId) {
      return res.status(403).json({ error: "غير مصرح بالوصول" });
    }

    const validatedData = userUpdateSchema.parse(req.body);
    const [updatedUser] = await db
      .update(users)
      .set({
        email: validatedData.email || null,
        phoneNumber: validatedData.phoneNumber || null,
        displayName: validatedData.displayName || null,
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    await logAudit(userId, "update", "user", userId, null, req);

    res.json(updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    }
    handleError(res, error, "User update");
  }
});

app.delete("/api/users/:id", authenticateUser, async (req, res) => {
  try {
    const userId = req.params.id;

    if (req.userId !== userId) {
      return res.status(403).json({ error: "غير مصرح بالوصول" });
    }

    const userTrees = await db
      .select()
      .from(trees)
      .where(eq(trees.createdBy, userId));

    for (const tree of userTrees) {
      await db.delete(relationships).where(eq(relationships.treeId, tree.id));
      await db.delete(people).where(eq(people.treeId, tree.id));
      await db.delete(editHistory).where(eq(editHistory.treeId, tree.id));
      // Deletion snapshots hold full person rows (names, dates, encrypted
      // phone/email) for everyone the user ever deleted. They must go with the
      // account, or "we delete all your data" is not true.
      await db.delete(deletions).where(eq(deletions.treeId, tree.id));
      await db.delete(trees).where(eq(trees.id, tree.id));
    }

    await db.delete(users).where(eq(users.id, userId));

    await logAudit(
      userId,
      "delete",
      "user",
      userId,
      { deletedTrees: userTrees.length },
      req,
    );

    res.clearCookie("auth_token", COOKIE_OPTIONS);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    handleError(res, error, "User delete");
  }
});

app.get("/api/trees", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.query;

    console.log(
      `[Trees] GET - req.userId: "${req.userId}", query.userId: "${userId}"`,
    );

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (req.userId !== userId) {
      console.log(`[Trees] Mismatch! req.userId !== query.userId`);
      return res.status(403).json({ error: "غير مصرح بالوصول" });
    }

    const userTrees = await db
      .select()
      .from(trees)
      .where(eq(trees.createdBy, userId));
    res.json(userTrees);
  } catch (error) {
    handleError(res, error, "Trees fetch");
  }
});

app.post("/api/trees", authenticateUser, async (req, res) => {
  try {
    const validatedData = treeSchema.parse(req.body);

    if (req.userId !== validatedData.createdBy) {
      return res.status(403).json({ error: "غير مصرح بالوصول" });
    }

    // Sanitize text fields to prevent XSS
    const sanitizedData = sanitizeUserInput(validatedData, [
      "name",
      "description",
    ]);

    const [tree] = await db
      .insert(trees)
      .values({
        name: sanitizedData.name,
        description: sanitizedData.description || null,
        createdBy: sanitizedData.createdBy,
      })
      .returning();

    await logAudit(
      req.userId,
      "create",
      "tree",
      tree.id,
      { name: tree.name },
      req,
    );

    res.json(tree);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    }
    handleError(res, error, "Tree create");
  }
});

app.delete("/api/trees/:id", authenticateUser, async (req, res) => {
  try {
    const treeId = validateId(req.params.id);
    if (!treeId) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    const [tree] = await db.select().from(trees).where(eq(trees.id, treeId));
    if (!tree) {
      return res.status(404).json({ error: "Tree not found" });
    }

    if (req.userId !== tree.createdBy) {
      return res.status(403).json({ error: "غير مصرح بالوصول" });
    }

    await db.delete(relationships).where(eq(relationships.treeId, treeId));
    await db.delete(people).where(eq(people.treeId, treeId));
    await db.delete(editHistory).where(eq(editHistory.treeId, treeId));
    // Snapshots belong to the tree — remove them with it.
    await db.delete(deletions).where(eq(deletions.treeId, treeId));
    await db.delete(trees).where(eq(trees.id, treeId));

    await logAudit(
      req.userId,
      "delete",
      "tree",
      treeId,
      { name: tree.name },
      req,
    );

    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Tree delete");
  }
});

app.get("/api/people", authenticateUser, async (req, res) => {
  const rid = req.requestId || "";
  try {
    const { treeId } = req.query;
    debugLog(`[${rid}][People] GET - treeId: ${treeId}, userId: ${req.userId}`);

    if (!treeId) {
      return res.status(400).json({ error: "Tree ID is required" });
    }

    const parsedTreeId = validateId(treeId);
    if (!parsedTreeId) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    debugLog(`[${rid}][People] Verifying ownership for tree ${parsedTreeId}`);
    const ownership = await verifyTreeOwnership(parsedTreeId, req.userId);
    if (!ownership.valid) {
      debugLog(`[${rid}][People] Ownership denied: ${ownership.error}`);
      return res.status(403).json({ error: ownership.error });
    }

    debugLog(`[${rid}][People] Fetching people from database...`);
    const allPeople = await db
      .select()
      .from(people)
      .where(eq(people.treeId, parsedTreeId));
    debugLog(`[${rid}][People] Found ${allPeople.length} people`);

    const decryptedPeople = allPeople.map((person, index) => {
      try {
        return {
          ...person,
          phone: decryptPII(person.phone),
          email: decryptPII(person.email),
          identificationNumber: decryptPII(person.identificationNumber),
          photoUrl: normalizePhotoUrl(person.photoUrl),
        };
      } catch (decryptError) {
        console.error(`[${rid}][People] Decrypt error for person ${person.id}:`, decryptError.message);
        return {
          ...person,
          phone: null,
          email: null,
          identificationNumber: null,
          photoUrl: normalizePhotoUrl(person.photoUrl),
        };
      }
    });

    debugLog(`[${rid}][People] Returning ${decryptedPeople.length} people`);
    res.json(decryptedPeople);
  } catch (error) {
    console.error(`[${rid}][People] Error:`, error.message, error.stack);
    handleError(res, error, "People fetch");
  }
});

app.get("/api/people/search", authenticateUser, async (req, res) => {
  try {
    const { query, treeId } = req.query;

    if (!query || !treeId) {
      return res.status(400).json({ error: "Query and tree ID are required" });
    }

    const parsedTreeId = validateId(treeId);
    if (!parsedTreeId) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    const ownership = await verifyTreeOwnership(parsedTreeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const escapedQuery = escapeLikePattern(query);
    const searchResults = await db
      .select()
      .from(people)
      .where(
        and(
          eq(people.treeId, parsedTreeId),
          or(
            ilike(people.firstName, `%${escapedQuery}%`),
            ilike(people.lastName, `%${escapedQuery}%`),
          ),
        ),
      );

    const decryptedResults = searchResults.map((person) => ({
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber),
      photoUrl: normalizePhotoUrl(person.photoUrl),
    }));

    res.json(decryptedResults);
  } catch (error) {
    handleError(res, error, "People search");
  }
});

app.post("/api/people", authenticateUser, async (req, res) => {
  try {
    console.log("POST /api/people received data:", req.body);
    const validatedData = personSchema.parse(req.body);
    console.log("After validation:", validatedData);

    const ownership = await verifyTreeOwnership(
      validatedData.treeId,
      req.userId,
    );
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    // Sanitize text fields to prevent XSS
    const sanitizedData = sanitizeUserInput(validatedData, [
      "firstName",
      "lastName",
      "milkFatherName",
      "milkMotherName",
    ]);

    const personData = {
      treeId: sanitizedData.treeId,
      firstName: sanitizedData.firstName,
      lastName: sanitizedData.lastName || null,
      gender: sanitizedData.gender,
      birthDate: sanitizedData.birthDate || null,
      birthPlace: sanitizedData.birthPlace || null,
      deathDate: sanitizedData.deathDate || null,
      isLiving:
        sanitizedData.isLiving !== undefined ? sanitizedData.isLiving : true,
      isBreastfed:
        sanitizedData.isBreastfed !== undefined
          ? sanitizedData.isBreastfed
          : false,
      milkFatherName: sanitizedData.milkFatherName || null,
      milkMotherName: sanitizedData.milkMotherName || null,
      phone: encryptPII(sanitizedData.phone),
      email: encryptPII(sanitizedData.email),
      identificationNumber: encryptPII(sanitizedData.identificationNumber),
      profession: sanitizedData.profession || null,
      birthOrder: sanitizedData.birthOrder ?? null,
      photoUrl: sanitizedData.photoUrl || null,
    };
    console.log("Saving to DB:", personData);
    const [person] = await db.insert(people).values(personData).returning();

    await recordUndo({
      treeId: validatedData.treeId,
      userId: req.userId,
      groupId: req.headers["x-action-group"] || null,
      kind: "create",
      label: person.firstName || null,
      peopleAfter: [person],
    });

    await recordEdit(
      req.userId,
      validatedData.treeId,
      "create",
      "person",
      person.id,
      null,
      person,
    );
    await logAudit(
      req.userId,
      "create",
      "person",
      person.id,
      { name: person.firstName },
      req,
    );

    const decryptedPerson = {
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber),
    };

    res.json(decryptedPerson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    }
    handleError(res, error, "Person create");
  }
});

app.put("/api/people/:id", authenticateUser, async (req, res) => {
  try {
    console.log("PUT /api/people/:id received data:", req.body);
    const personId = validateId(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: "Invalid person ID" });
    }

    const validatedData = personUpdateSchema.parse(req.body);
    console.log("After validation:", validatedData);

    // Sanitize text fields to prevent XSS
    const sanitizedData = sanitizeUserInput(validatedData, [
      "firstName",
      "lastName",
      "birthPlace",
      "profession",
      "milkFatherName",
      "milkMotherName",
    ]);

    const [existingPerson] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId));
    if (!existingPerson) {
      return res.status(404).json({ error: "Person not found" });
    }

    const ownership = await verifyTreeOwnership(
      existingPerson.treeId,
      req.userId,
    );
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const personData = {};
    if (sanitizedData.firstName !== undefined)
      personData.firstName = sanitizedData.firstName;
    if (sanitizedData.lastName !== undefined)
      personData.lastName = sanitizedData.lastName || null;
    if (sanitizedData.gender !== undefined)
      personData.gender = sanitizedData.gender;
    if (sanitizedData.birthDate !== undefined)
      personData.birthDate = sanitizedData.birthDate || null;
    if (sanitizedData.birthPlace !== undefined)
      personData.birthPlace = sanitizedData.birthPlace || null;
    if (sanitizedData.deathDate !== undefined)
      personData.deathDate = sanitizedData.deathDate || null;
    if (sanitizedData.isLiving !== undefined)
      personData.isLiving = sanitizedData.isLiving;
    if (sanitizedData.isBreastfed !== undefined)
      personData.isBreastfed = sanitizedData.isBreastfed;
    if (sanitizedData.milkFatherName !== undefined)
      personData.milkFatherName = sanitizedData.milkFatherName || null;
    if (sanitizedData.milkMotherName !== undefined)
      personData.milkMotherName = sanitizedData.milkMotherName || null;
    if (sanitizedData.phone !== undefined)
      personData.phone = encryptPII(sanitizedData.phone);
    if (sanitizedData.email !== undefined)
      personData.email = encryptPII(sanitizedData.email);
    if (sanitizedData.identificationNumber !== undefined)
      personData.identificationNumber = encryptPII(
        sanitizedData.identificationNumber,
      );
    if (sanitizedData.profession !== undefined)
      personData.profession = sanitizedData.profession || null;
    if (sanitizedData.birthOrder !== undefined)
      personData.birthOrder = sanitizedData.birthOrder;
    if (sanitizedData.photoUrl !== undefined)
      personData.photoUrl = sanitizedData.photoUrl;

    console.log("Updating in DB with:", personData);
    const [person] = await db
      .update(people)
      .set(personData)
      .where(eq(people.id, personId))
      .returning();

    await recordUndo({
      treeId: existingPerson.treeId,
      userId: req.userId,
      groupId: req.headers["x-action-group"] || null,
      kind: "update",
      label: existingPerson.firstName || null,
      peopleBefore: [existingPerson],
      peopleAfter: [person],
    });

    await recordEdit(
      req.userId,
      existingPerson.treeId,
      "update",
      "person",
      personId,
      existingPerson,
      person,
    );
    await logAudit(req.userId, "update", "person", personId, null, req);

    const decryptedPerson = {
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
      identificationNumber: decryptPII(person.identificationNumber),
    };

    res.json(decryptedPerson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    }
    handleError(res, error, "Person update");
  }
});

app.delete("/api/people/:id", authenticateUser, async (req, res) => {
  try {
    const personId = validateId(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: "Invalid person ID" });
    }

    const [existingPerson] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId));
    if (!existingPerson) {
      return res.status(404).json({ error: "Person not found" });
    }

    const ownership = await verifyTreeOwnership(
      existingPerson.treeId,
      req.userId,
    );
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const personRelRows = await db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.treeId, existingPerson.treeId),
          or(
            eq(relationships.person1Id, personId),
            eq(relationships.person2Id, personId),
            eq(relationships.parentId, personId),
            eq(relationships.childId, personId),
          ),
        ),
      );

    await recordUndo({
      treeId: existingPerson.treeId,
      userId: req.userId,
      groupId: req.headers["x-action-group"] || null,
      kind: "delete",
      label: existingPerson.firstName || null,
      peopleBefore: [existingPerson],
      relationshipsBefore: personRelRows,
    });

    await recordEdit(
      req.userId,
      existingPerson.treeId,
      "delete",
      "person",
      personId,
      existingPerson,
      null,
    );

    await db.delete(people).where(eq(people.id, personId));

    await logAudit(
      req.userId,
      "delete",
      "person",
      personId,
      { name: existingPerson.firstName },
      req,
    );

    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Person delete");
  }
});

// List recent deletions for a tree, newest first. Payloads are omitted — only
// what is needed to show an "undo" list.
app.get("/api/deletions/:treeId", authenticateUser, async (req, res) => {
  try {
    const treeId = validateId(req.params.treeId);
    if (!treeId) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }
    const ownership = await verifyTreeOwnership(treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const rows = await db
      .select({
        id: deletions.id,
        label: deletions.label,
        deletedAt: deletions.deletedAt,
        restoredAt: deletions.restoredAt,
        peopleCount: sql`jsonb_array_length(${deletions.people})`,
        relationshipsCount: sql`jsonb_array_length(${deletions.relationships})`,
      })
      .from(deletions)
      .where(eq(deletions.treeId, treeId))
      .orderBy(desc(deletions.id))
      .limit(50);

    res.json(rows);
  } catch (error) {
    handleError(res, error, "Deletions list", req);
  }
});

// Undo one deletion: re-insert the snapshotted people, then the relationships
// between them, keeping their ORIGINAL ids so the saved relationship rows still
// point at the right people. Postgres never reuses sequence values, so those ids
// cannot have been handed to anyone else; the sequences are nudged forward
// afterwards in case a restored id sits above the current maximum.
// `onConflictDoNothing` makes this safe to re-run and tolerant of a snapshot
// that is a superset of what was actually removed.
app.post("/api/deletions/:id/restore", authenticateUser, async (req, res) => {
  try {
    const deletionId = validateId(req.params.id);
    if (!deletionId) {
      return res.status(400).json({ error: "Invalid deletion ID" });
    }

    const [snapshot] = await db
      .select()
      .from(deletions)
      .where(eq(deletions.id, deletionId));
    if (!snapshot) {
      return res.status(404).json({ error: "Deletion not found" });
    }

    const ownership = await verifyTreeOwnership(snapshot.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    if (snapshot.restoredAt) {
      return res
        .status(409)
        .json({ error: "This deletion has already been restored" });
    }

    // Restores must run newest-first, like an undo stack. If two people who were
    // related got deleted in SEPARATE actions, the relationship row was captured
    // only by the FIRST snapshot — by the time the second delete ran it was
    // already gone. Restoring the older one first would try to re-insert that
    // relationship while the other person does not exist yet, the foreign key
    // would reject it, and both people would come back connected to nobody.
    // Reverse order guarantees the referenced person is always present first.
    // Compared by ID, not by timestamp. `deleted_at` is microsecond precision in
    // Postgres but only millisecond precision once it becomes a JS Date, so a
    // timestamp comparison made a row look NEWER THAN ITSELF (.166202 > .166)
    // and every undo of the latest deletion was rejected. `id` is a serial:
    // exact, strictly increasing, no precision to lose.
    // ONE user action can be several rows — adding a person with two parents
    // writes three. They share a groupId, and the whole group is reversed in one
    // press. Rows written before groupId existed have NULL and undo alone, which
    // is exactly how they behaved before.
    const groupRows = snapshot.groupId
      ? await db
          .select()
          .from(deletions)
          .where(
            and(
              eq(deletions.treeId, snapshot.treeId),
              eq(deletions.groupId, snapshot.groupId),
              sql`${deletions.restoredAt} is null`,
            ),
          )
          .orderBy(desc(deletions.id))
      : [snapshot];

    const groupIds = groupRows.map((r) => r.id);
    const groupTop = Math.max(...groupIds);

    // Newest-first, but measured against the GROUP rather than the row: the
    // other entries of this same action are not "newer work".
    const [newer] = await db
      .select({ id: deletions.id })
      .from(deletions)
      .where(
        and(
          eq(deletions.treeId, snapshot.treeId),
          sql`${deletions.restoredAt} is null`,
          sql`${deletions.id} > ${groupTop}`,
        ),
      )
      .limit(1);
    if (newer) {
      return res.status(409).json({
        error: "يجب التراجع عن العملية الأحدث أولاً",
      });
    }

    const revive = (row) => ({
      ...row,
      createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
    });

    // Merge the whole group into one before/after set, then apply the single
    // rule once. Order within the group stops mattering after the merge — a row
    // created and then referenced by a later row in the SAME action ends up in
    // *_after either way, so both are removed together.
    const flat = (key) => groupRows.flatMap((r) => r[key] || []).map(revive);
    const peopleRows = flat("people");
    const relRows = flat("relationships");
    const peopleAfterRows = flat("peopleAfter");
    const relAfterRows = flat("relationshipsAfter");

    // ONE rule for all three kinds:
    //   remove anything the action ADDED (present in *_after, absent from
    //   *_before), then write every *_before row back at its own id.
    //
    //   delete  before=[rows] after=[]     -> nothing removed, rows re-inserted
    //   create  before=[]     after=[rows] -> rows removed, nothing restored
    //   update  before=[old]  after=[new]  -> same id in both, so nothing is
    //                                         removed and the row is written
    //                                         back to its old values
    //
    // Order matters both ways round the foreign keys: relationships are removed
    // BEFORE the people they point at, and restored AFTER them.
    const beforePeopleIds = new Set(peopleRows.map((r) => r.id));
    const beforeRelIds = new Set(relRows.map((r) => r.id));
    const relIdsToRemove = relAfterRows
      .map((r) => r.id)
      .filter((id) => id != null && !beforeRelIds.has(id));
    const peopleIdsToRemove = peopleAfterRows
      .map((r) => r.id)
      .filter((id) => id != null && !beforePeopleIds.has(id));

    if (relIdsToRemove.length > 0) {
      await db
        .delete(relationships)
        .where(inArray(relationships.id, relIdsToRemove));
    }
    if (peopleIdsToRemove.length > 0) {
      await db.delete(people).where(inArray(people.id, peopleIdsToRemove));
    }

    // Upsert, not insert-or-skip: for an update the row still exists, and
    // onConflictDoNothing would silently leave the new values in place. Done one
    // row at a time so each row's own values are used in the DO UPDATE clause.
    let peopleRestored = [];
    for (const row of peopleRows) {
      const { id, ...rest } = row;
      const [out] = await db
        .insert(people)
        .values(row)
        .onConflictDoUpdate({ target: people.id, set: rest })
        .returning({ id: people.id });
      if (out) peopleRestored.push(out);
    }

    let relRestored = [];
    for (const row of relRows) {
      const { id, ...rest } = row;
      const [out] = await db
        .insert(relationships)
        .values(row)
        .onConflictDoUpdate({ target: relationships.id, set: rest })
        .returning({ id: relationships.id });
      if (out) relRestored.push(out);
    }

    // Keep the serial sequences ahead of any id we just re-inserted.
    await db.execute(
      sql`SELECT setval(pg_get_serial_sequence('people','id'), GREATEST(COALESCE((SELECT MAX(id) FROM people), 1), 1))`,
    );
    await db.execute(
      sql`SELECT setval(pg_get_serial_sequence('relationships','id'), GREATEST(COALESCE((SELECT MAX(id) FROM relationships), 1), 1))`,
    );

    await db
      .update(deletions)
      .set({ restoredAt: new Date() })
      .where(inArray(deletions.id, groupIds));

    await logAudit(
      req.userId,
      "create",
      "person",
      peopleRows[0]?.id ?? null,
      {
        restore: true,
        deletionId,
        peopleRestored: peopleRestored.length,
        relationshipsRestored: relRestored.length,
      },
      req,
    );

    res.json({
      success: true,
      peopleRestored: peopleRestored.length,
      relationshipsRestored: relRestored.length,
      restoredPeopleIds: peopleRestored.map((r) => r.id),
    });
  } catch (error) {
    handleError(res, error, "Deletion restore", req);
  }
});

// Delete several people as ONE action, snapshotting everything first so the
// whole action can be undone. This replaces firing N parallel DELETE calls:
// deleting one person cascades away relationship rows that also touch the
// others, so a per-person snapshot taken afterwards would silently miss them.
app.post("/api/people/batch-delete", authenticateUser, async (req, res) => {
  try {
    const { treeId, ids, relationshipIds, label } = batchDeleteSchema.parse(
      req.body,
    );
    const relIds = relationshipIds || [];

    const ownership = await verifyTreeOwnership(treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    // Only ever touch people that belong to THIS tree.
    const peopleRows = ids.length
      ? await db
          .select()
          .from(people)
          .where(and(eq(people.treeId, treeId), inArray(people.id, ids)))
      : [];

    const foundIds = peopleRows.map((p) => p.id);

    // Every relationship touching any of those people, in any role, PLUS any
    // relationship named directly by the caller. Removing a marriage names the
    // partner row even when nobody is deleted alongside it.
    const relFilters = [];
    if (foundIds.length) {
      relFilters.push(
        or(
          inArray(relationships.person1Id, foundIds),
          inArray(relationships.person2Id, foundIds),
          inArray(relationships.parentId, foundIds),
          inArray(relationships.childId, foundIds),
        ),
      );
    }
    if (relIds.length) {
      relFilters.push(inArray(relationships.id, relIds));
    }

    const relRows = await db
      .select()
      .from(relationships)
      .where(and(eq(relationships.treeId, treeId), or(...relFilters)));

    if (peopleRows.length === 0 && relRows.length === 0) {
      return res.status(404).json({ error: "No matching records found" });
    }

    // Snapshot BEFORE deleting. If this insert fails the delete never runs.
    const [snapshot] = await db
      .insert(deletions)
      .values({
        treeId,
        deletedBy: req.userId,
        kind: "delete",
        groupId: req.headers["x-action-group"] || null,
        label: label || null,
        people: peopleRows,
        relationships: relRows,
      })
      .returning();

    // Named relationships first: a marriage removal deletes ONLY the partner
    // row, and it must go whether or not anyone is deleted alongside it.
    if (relIds.length) {
      await db
        .delete(relationships)
        .where(
          and(
            eq(relationships.treeId, treeId),
            inArray(relationships.id, relIds),
          ),
        );
    }

    // Then the people. FK cascade removes the rest of their relationship rows.
    if (foundIds.length) {
      await db
        .delete(people)
        .where(and(eq(people.treeId, treeId), inArray(people.id, foundIds)));
    }

    await logAudit(
      req.userId,
      "delete",
      "person",
      foundIds[0],
      {
        batch: true,
        count: foundIds.length,
        relationships: relRows.length,
        deletionId: snapshot.id,
      },
      req,
    );

    res.json({
      success: true,
      deletionId: snapshot.id,
      peopleDeleted: peopleRows.length,
      relationshipsDeleted: relRows.length,
    });
  } catch (error) {
    handleError(res, error, "Batch delete", req);
  }
});

app.patch("/api/people/:id/birthOrder", authenticateUser, async (req, res) => {
  try {
    const personId = validateId(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: "Invalid person ID" });
    }

    const validatedData = birthOrderSchema.parse(req.body);

    const [existingPerson] = await db
      .select()
      .from(people)
      .where(eq(people.id, personId));
    if (!existingPerson) {
      return res.status(404).json({ error: "Person not found" });
    }

    const ownership = await verifyTreeOwnership(
      existingPerson.treeId,
      req.userId,
    );
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const [person] = await db
      .update(people)
      .set({ birthOrder: validatedData.birthOrder })
      .where(eq(people.id, personId))
      .returning();
    // Reordering siblings is a mutation like any other. Without this the stack
    // is not a complete log, and a birth-order change silently cannot be undone.
    await recordUndo({
      treeId: existingPerson.treeId,
      userId: req.userId,
      groupId: req.headers["x-action-group"] || null,
      kind: "update",
      label: existingPerson.firstName || null,
      peopleBefore: [existingPerson],
      peopleAfter: [person],
    });

    res.json(person);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    }
    handleError(res, error, "Birth order update");
  }
});

app.get("/api/relationships", authenticateUser, async (req, res) => {
  try {
    const { treeId } = req.query;

    if (!treeId) {
      return res.status(400).json({ error: "Tree ID is required" });
    }

    const parsedTreeId = validateId(treeId);
    if (!parsedTreeId) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    const ownership = await verifyTreeOwnership(parsedTreeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const allRelationships = await db
      .select()
      .from(relationships)
      .where(eq(relationships.treeId, parsedTreeId));
    res.json(allRelationships);
  } catch (error) {
    handleError(res, error, "Relationships fetch");
  }
});

// ---------------------------------------------------------------------------
// Marriage and parentage rules, enforced HERE rather than in the browser.
//
// The same rules exist in src/App.jsx and gate the buttons, but a rule that
// lives only in the UI binds only the paths that remember to call it. Everything
// else — restore, a direct API call, a flow nobody thought of — writes straight
// to the table. A woman ended up recorded as both her husband's wife and his
// daughter on staging through a path that could not be identified from the
// frontend code, which is the case this exists to make impossible.
//
// Mirrors src/App.jsx: spouseLimitFor, countActiveSpouses, mahramReason.
// Rules validated against sql/mahram_audit.sql and the tree-65 fixture.
// ---------------------------------------------------------------------------
const spouseLimitForGender = (gender) => (gender === "male" ? 4 : 1);

const buildKin = (rels, ppl) => {
  const personOf = (id) => ppl.find((p) => p.id === id);

  const bloodParentsOf = (id) =>
    rels
      .filter((r) => r.type === "parent-child" && r.childId === id)
      .map((r) => r.parentId);
  const bloodChildrenOf = (id) =>
    rels
      .filter((r) => r.type === "parent-child" && r.parentId === id)
      .map((r) => r.childId);

  const milkRows = rels.filter(
    (r) => r.type === "sibling" && r.isBreastfeeding,
  );
  // person1Id is the existing anchor, person2Id the newly added milk-sibling,
  // so person2 nursed from person1's mother and inherits person1's parents as
  // milk-parents. Modelling that as a parent edge makes every rule below produce
  // the full رضاعة mirror without separate milk rules.
  const milkParentsOf = (id) =>
    milkRows
      .filter((r) => r.person2Id === id)
      .flatMap((r) => bloodParentsOf(r.person1Id));
  const milkChildrenOf = (id) =>
    milkRows
      .filter((r) => bloodParentsOf(r.person1Id).includes(id))
      .map((r) => r.person2Id);

  const parentsOf = (id) => [...bloodParentsOf(id), ...milkParentsOf(id)];
  const childrenOf = (id) => [...bloodChildrenOf(id), ...milkChildrenOf(id)];

  const walk = (startId, step) => {
    const seen = new Set();
    const stack = [startId];
    while (stack.length) {
      const cur = stack.pop();
      for (const next of step(cur)) {
        if (next != null && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return seen;
  };
  const ancestorsOf = (id) => walk(id, parentsOf);
  const descendantsOf = (id) => walk(id, childrenOf);

  const bloodSiblingsOf = (id) => {
    const out = new Set();
    for (const par of bloodParentsOf(id))
      for (const c of bloodChildrenOf(par)) if (c !== id) out.add(c);
    return out;
  };
  const milkSiblingsOf = (id) =>
    new Set(
      milkRows
        .filter((r) => r.person1Id === id || r.person2Id === id)
        .map((r) => (r.person1Id === id ? r.person2Id : r.person1Id)),
    );
  const marriagesOf = (id) =>
    rels
      .filter(
        (r) =>
          r.type === "partner" && (r.person1Id === id || r.person2Id === id),
      )
      .map((r) => ({
        other: r.person1Id === id ? r.person2Id : r.person1Id,
        status: r.status,
      }));

  return {
    personOf,
    parentsOf,
    childrenOf,
    ancestorsOf,
    descendantsOf,
    bloodSiblingsOf,
    milkSiblingsOf,
    marriagesOf,
  };
};

const mahramReason = (rels, ppl, aId, bId, extraRels = []) => {
  if (!aId || !bId || aId === bId) return null;
  const k = buildKin([...rels, ...extraRels], ppl);

  if (k.ancestorsOf(aId).has(bId) || k.descendantsOf(aId).has(bId))
    return "قرابة مباشرة (أصل أو فرع)";
  if (k.bloodSiblingsOf(aId).has(bId)) return "أخ أو أخت";
  if (k.milkSiblingsOf(aId).has(bId)) return "أخ أو أخت بالرضاعة";

  const nieceLine = (x, y) =>
    k.parentsOf(x).some((par) => k.descendantsOf(par).has(y));
  const auntLine = (x, y) =>
    [...k.ancestorsOf(x)].some((anc) => k.childrenOf(anc).includes(y));
  if (nieceLine(aId, bId) || auntLine(bId, aId))
    return "ابن أو بنت الأخ أو الأخت";
  if (auntLine(aId, bId) || nieceLine(bId, aId))
    return "عمّ أو عمّة أو خال أو خالة";

  const inLawLineal = (x, y) =>
    k
      .marriagesOf(x)
      .some(
        (m) => k.ancestorsOf(m.other).has(y) || k.descendantsOf(m.other).has(y),
      );
  if (inLawLineal(aId, bId)) return "أم الزوجة أو بنت الزوجة";
  if (inLawLineal(bId, aId)) return "زوجة الأب أو زوجة الابن";

  // Temporal — lifts when the other marriage ends by divorce or death.
  const ongoing = (m) => {
    if (m.status === "divorced") return false;
    const sp = k.personOf(m.other);
    return !sp || sp.isLiving !== false;
  };
  const sibsOf = (id) =>
    new Set([...k.bloodSiblingsOf(id), ...k.milkSiblingsOf(id)]);
  const bSibs = sibsOf(bId);
  if (k.marriagesOf(aId).filter(ongoing).some((m) => bSibs.has(m.other)))
    return "الجمع بين الأختين";
  const aSibs = sibsOf(aId);
  if (k.marriagesOf(bId).filter(ongoing).some((m) => aSibs.has(m.other)))
    return "الجمع بين الأختين";

  const auntPair = (x, y) => auntLine(x, y) || auntLine(y, x);
  if (
    k
      .marriagesOf(aId)
      .filter(ongoing)
      .some((m) => m.other !== bId && auntPair(bId, m.other))
  )
    return "الجمع بين المرأة وعمتها أو خالتها";
  if (
    k
      .marriagesOf(bId)
      .filter(ongoing)
      .some((m) => m.other !== aId && auntPair(aId, m.other))
  )
    return "الجمع بين المرأة وعمتها أو خالتها";

  return null;
};

const validatePartner = (rels, ppl, aId, bId) => {
  const a = ppl.find((p) => p.id === aId);
  const b = ppl.find((p) => p.id === bId);
  if (!a || !b) return "شخص غير موجود في هذه الشجرة";
  if (aId === bId) return "لا يمكن ربط الشخص بنفسه";

  if (a.gender && b.gender && a.gender === b.gender)
    return "لا يمكن تسجيل زواج بين شخصين من نفس الجنس";

  const already = rels.some(
    (r) =>
      r.type === "partner" &&
      ((r.person1Id === aId && r.person2Id === bId) ||
        (r.person1Id === bId && r.person2Id === aId)),
  );
  if (already) return "هذا الزواج مسجّل بالفعل";

  const activeSpouses = (id) =>
    rels
      .filter(
        (r) =>
          r.type === "partner" &&
          r.status !== "divorced" &&
          (r.person1Id === id || r.person2Id === id),
      )
      .reduce((n, r) => {
        const sid = r.person1Id === id ? r.person2Id : r.person1Id;
        const sp = ppl.find((p) => p.id === sid);
        return sp && sp.isLiving !== false ? n + 1 : n;
      }, 0);

  // Mahram BEFORE the spouse limit. Telling someone their sister "already has a
  // husband" implies the marriage would be fine once she divorces, which is the
  // opposite of true. The permanent reason has to be the one reported.
  const reason = mahramReason(rels, ppl, aId, bId);
  if (reason) return `لا يجوز الزواج: ${reason}`;

  for (const [self, other] of [
    [a, b],
    [b, a],
  ]) {
    if (other.isLiving === false) continue;
    const limit = spouseLimitForGender(self.gender);
    if (activeSpouses(self.id) >= limit)
      return `${self.firstName} بلغ الحد المسموح من الأزواج (${limit})`;
  }

  return null;
};

// A parent-child link can make an ALREADY-married couple mahram — marry
// someone, then record a parent link that makes them your sister. Simulate the
// new row and re-check every marriage of everyone whose parentage would change.
const validateParentChild = (rels, ppl, parentId, childId) => {
  if (!parentId || !childId) return "الرابط غير مكتمل";
  if (parentId === childId) return "لا يمكن ربط الشخص بنفسه";

  // One father and one mother — the rule the data model assumes but nothing
  // checked. A child gained a SECOND father when add-parents ran on a child who
  // already had one.
  const parentPerson = ppl.find((p) => p.id === parentId);
  if (parentPerson?.gender) {
    const clash = rels
      .filter((r) => r.type === "parent-child" && r.childId === childId)
      .map((r) => ppl.find((p) => p.id === r.parentId))
      .find((p) => p && p.id !== parentId && p.gender === parentPerson.gender);
    if (clash)
      return `${clash.firstName} مسجّل بالفعل كـ${
        parentPerson.gender === "male" ? "أب" : "أم"
      } لهذا الشخص`;
  }

  const extra = [{ type: "parent-child", parentId, childId }];
  const affected = new Set([
    childId,
    parentId,
    ...rels
      .filter((r) => r.type === "parent-child" && r.parentId === parentId)
      .map((r) => r.childId),
  ]);

  for (const pid of affected) {
    const spouses = rels
      .filter(
        (r) =>
          r.type === "partner" && (r.person1Id === pid || r.person2Id === pid),
      )
      .map((r) => (r.person1Id === pid ? r.person2Id : r.person1Id));
    for (const sp of spouses) {
      const reason = mahramReason(rels, ppl, pid, sp, extra);
      if (reason) {
        const x = ppl.find((p) => p.id === pid);
        const y = ppl.find((p) => p.id === sp);
        return `${x?.firstName} و ${y?.firstName} متزوجان، وهذا الرابط يجعل بينهما: ${reason}. احذف الزواج أولاً.`;
      }
    }
  }
  return null;
};

const loadTreeGraph = async (treeId) => {
  const [rels, ppl] = await Promise.all([
    db.select().from(relationships).where(eq(relationships.treeId, treeId)),
    db.select().from(people).where(eq(people.treeId, treeId)),
  ]);
  return { rels, ppl };
};

app.post("/api/relationships", authenticateUser, async (req, res) => {
  try {
    const validatedData = relationshipSchema.parse(req.body);

    const ownership = await verifyTreeOwnership(
      validatedData.treeId,
      req.userId,
    );
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    // Hardening: every referenced person must belong to this same tree,
    // so a relationship can't reference people from another user's tree.
    const referencedIds = [
      validatedData.person1Id,
      validatedData.person2Id,
      validatedData.childId,
      validatedData.parentId,
    ].filter((id) => id != null);

    let referencedPeople = [];
    if (referencedIds.length > 0) {
      const referenced = await db
        .select()
        .from(people)
        .where(inArray(people.id, referencedIds));
      referencedPeople = referenced;
      const allInTree =
        referenced.length === referencedIds.length &&
        referenced.every((p) => p.treeId === validatedData.treeId);
      if (!allInTree) {
        return res.status(400).json({
          error: "All referenced people must belong to this tree",
        });
      }
    }

    // Rules that used to live only in the browser. Applied to EVERY create,
    // whatever produced it.
    if (validatedData.type === "partner" || validatedData.type === "parent-child") {
      const { rels, ppl } = await loadTreeGraph(validatedData.treeId);
      const problem =
        validatedData.type === "partner"
          ? validatePartner(
              rels,
              ppl,
              validatedData.person1Id,
              validatedData.person2Id,
            )
          : validateParentChild(
              rels,
              ppl,
              validatedData.parentId,
              validatedData.childId,
            );
      if (problem) {
        return res.status(400).json({ error: problem });
      }
    }

    const relationshipData = {
      treeId: validatedData.treeId,
      type: validatedData.type,
      person1Id: validatedData.person1Id || null,
      person2Id: validatedData.person2Id || null,
      childId: validatedData.childId || null,
      parentId: validatedData.parentId || null,
      isBreastfeeding: validatedData.isBreastfeeding || false,
      isDotted: validatedData.isDotted || false,
    };
    const [relationship] = await db
      .insert(relationships)
      .values(relationshipData)
      .returning();

    const nameOfId = (id) =>
      referencedPeople.find((p) => p.id === id)?.firstName || "";
    const relLabel = (() => {
      if (relationship.type === "partner")
        return `زواج: ${[nameOfId(relationship.person1Id), nameOfId(relationship.person2Id)]
          .filter(Boolean)
          .join(" — ")}`.slice(0, 300);
      if (relationship.type === "parent-child")
        return `نسب: ${[nameOfId(relationship.parentId), nameOfId(relationship.childId)]
          .filter(Boolean)
          .join(" — ")}`.slice(0, 300);
      return `${relationship.type}: ${[nameOfId(relationship.person1Id), nameOfId(relationship.person2Id)]
        .filter(Boolean)
        .join(" — ")}`.slice(0, 300);
    })();

    await recordUndo({
      treeId: validatedData.treeId,
      userId: req.userId,
      groupId: req.headers["x-action-group"] || null,
      kind: "create",
      label: relLabel,
      relationshipsAfter: [relationship],
    });

    await recordEdit(
      req.userId,
      validatedData.treeId,
      "create",
      "relationship",
      relationship.id,
      null,
      relationship,
    );
    await logAudit(
      req.userId,
      "create",
      "relationship",
      relationship.id,
      { type: relationship.type },
      req,
    );

    res.json(relationship);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Invalid input", details: error.errors });
    }
    handleError(res, error, "Relationship create");
  }
});

// Set the marital status of a partner relationship.
// Deliberately changes NOTHING else: children keep their parent-child rows, both
// people stay in the tree, and no other relationship is touched. Divorce is a
// fact about one marriage, not an instruction to rearrange the tree.
// Before this column existed the app inferred "still married" from isLiving,
// which is why reviving a dead husband silently revived the marriage.
app.patch(
  "/api/relationships/:id/status",
  authenticateUser,
  async (req, res) => {
    try {
      const relId = validateId(req.params.id);
      if (!relId) {
        return res.status(400).json({ error: "Invalid relationship ID" });
      }

      const { status } = relationshipStatusSchema.parse(req.body);

      const [existingRel] = await db
        .select()
        .from(relationships)
        .where(eq(relationships.id, relId));
      if (!existingRel) {
        return res.status(404).json({ error: "Relationship not found" });
      }

      // Only a marriage has a marital status.
      if (existingRel.type !== "partner") {
        return res
          .status(400)
          .json({ error: "Only a partner relationship has a status" });
      }

      const ownership = await verifyTreeOwnership(
        existingRel.treeId,
        req.userId,
      );
      if (!ownership.valid) {
        return res.status(403).json({ error: ownership.error });
      }

      await recordEdit(
        req.userId,
        existingRel.treeId,
        "update",
        "relationship",
        relId,
        existingRel,
        { ...existingRel, status },
      );

      const [updated] = await db
        .update(relationships)
        .set({ status })
        .where(eq(relationships.id, relId))
        .returning();

      await recordUndo({
        treeId: existingRel.treeId,
        userId: req.userId,
        groupId: req.headers["x-action-group"] || null,
        kind: "update",
        label: existingRel.type,
        relationshipsBefore: [existingRel],
        relationshipsAfter: [updated],
      });

      await logAudit(
        req.userId,
        "update",
        "relationship",
        relId,
        { status, previous: existingRel.status ?? "married" },
        req,
      );

      res.json(updated);
    } catch (error) {
      handleError(res, error, "Relationship status update", req);
    }
  },
);

app.delete("/api/relationships/:id", authenticateUser, async (req, res) => {
  try {
    const relId = validateId(req.params.id);
    if (!relId) {
      return res.status(400).json({ error: "Invalid relationship ID" });
    }

    const [existingRel] = await db
      .select()
      .from(relationships)
      .where(eq(relationships.id, relId));
    if (!existingRel) {
      return res.status(404).json({ error: "Relationship not found" });
    }

    const ownership = await verifyTreeOwnership(existingRel.treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    await recordUndo({
      treeId: existingRel.treeId,
      userId: req.userId,
      groupId: req.headers["x-action-group"] || null,
      kind: "delete",
      label: existingRel.type,
      relationshipsBefore: [existingRel],
    });

    await recordEdit(
      req.userId,
      existingRel.treeId,
      "delete",
      "relationship",
      relId,
      existingRel,
      null,
    );

    await db.delete(relationships).where(eq(relationships.id, relId));

    await logAudit(
      req.userId,
      "delete",
      "relationship",
      relId,
      { type: existingRel.type },
      req,
    );

    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Relationship delete");
  }
});

app.get("/api/history/:treeId", authenticateUser, async (req, res) => {
  try {
    const treeId = validateId(req.params.treeId);
    if (!treeId) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    const ownership = await verifyTreeOwnership(treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const history = await db
      .select()
      .from(editHistory)
      .where(eq(editHistory.treeId, treeId))
      .orderBy(desc(editHistory.createdAt))
      .limit(100);

    res.json(history);
  } catch (error) {
    handleError(res, error, "History fetch");
  }
});

// Phase 2: Undo handler with Zod validation for previousData
// REMOVED: POST /api/history/undo/:id
//
// The old editHistory undo. Deleted rather than wired up, because it was tested
// and found unusable AND it was the last write path with no validation and no
// recording:
//   - undoing a relationship create matched no branch and returned success anyway
//   - restoring a deleted person gave it a NEW id, leaving every reference dangling
//   - the cascade was never captured, so a restored person came back unconnected
//   - nothing marked an entry as undone, so pressing twice inserted twice
//   - no ordering, and no validation — it could restore a gender that makes an
//     existing marriage same-sex, or push someone past their spouse limit
//
// `deletions` replaces it: ids preserved, cascade captured, restored_at tracked,
// strict newest-first, grouped by user action. GET /api/history/:treeId is left
// in place — reading the edit log is harmless and it is still written.


app.get("/api/export/:treeId", authenticateUser, async (req, res) => {
  try {
    const treeId = validateId(req.params.treeId);
    const format = req.query.format || "json";

    if (!treeId) {
      return res.status(400).json({ error: "Invalid tree ID" });
    }

    const ownership = await verifyTreeOwnership(treeId, req.userId);
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const [tree] = await db.select().from(trees).where(eq(trees.id, treeId));
    const allPeople = await db
      .select()
      .from(people)
      .where(eq(people.treeId, treeId));
    const allRelationships = await db
      .select()
      .from(relationships)
      .where(eq(relationships.treeId, treeId));

    const decryptedPeople = allPeople.map((p) => ({
      ...p,
      phone: decryptPII(p.phone),
      email: decryptPII(p.email),
      identificationNumber: decryptPII(p.identificationNumber),
      photoUrl: normalizePhotoUrl(p.photoUrl),
    }));

    await logAudit(req.userId, "export", "tree", treeId, { format }, req);

    if (format === "gedcom") {
      let gedcom =
        "0 HEAD\n1 SOUR UAE Roots\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n";

      decryptedPeople.forEach((p) => {
        gedcom += `0 @I${p.id}@ INDI\n`;
        gedcom += `1 NAME ${p.firstName} /${p.lastName || ""}/\n`;
        gedcom += `1 SEX ${p.gender === "male" ? "M" : "F"}\n`;
        if (p.birthDate) gedcom += `1 BIRT\n2 DATE ${p.birthDate}\n`;
        if (p.deathDate) gedcom += `1 DEAT\n2 DATE ${p.deathDate}\n`;
      });

      let famId = 1;
      const partnerRels = allRelationships.filter((r) => r.type === "partner");
      partnerRels.forEach((r) => {
        gedcom += `0 @F${famId}@ FAM\n`;
        if (r.person1Id) gedcom += `1 HUSB @I${r.person1Id}@\n`;
        if (r.person2Id) gedcom += `1 WIFE @I${r.person2Id}@\n`;
        famId++;
      });

      gedcom += "0 TRLR\n";

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${tree.name}.ged"`,
      );
      return res.send(gedcom);
    }

    if (format === "csv") {
      let csv =
        "الاسم الأول,اسم العائلة,الجنس,تاريخ الميلاد,تاريخ الوفاة,على قيد الحياة,الهاتف,البريد الإلكتروني\n";

      decryptedPeople.forEach((p) => {
        csv += `"${p.firstName}","${p.lastName || ""}","${p.gender === "male" ? "ذكر" : "أنثى"}","${p.birthDate || ""}","${p.deathDate || ""}","${p.isLiving ? "نعم" : "لا"}","${p.phone || ""}","${p.email || ""}"\n`;
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${tree.name}.csv"`,
      );
      return res.send("\uFEFF" + csv);
    }

    if (format === "html") {
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
  <p style="text-align:center">${tree.description || ""}</p>
  <div style="display: flex; flex-wrap: wrap; justify-content: center;">`;

      decryptedPeople.forEach((p) => {
        html += `
    <div class="person ${p.gender}">
      <div class="name">${p.firstName} ${p.lastName || ""}</div>
      <div class="info">${p.gender === "male" ? "ذكر" : "أنثى"}</div>
      ${p.birthDate ? `<div class="info">الميلاد: ${p.birthDate}</div>` : ""}
      ${p.deathDate ? `<div class="info">الوفاة: ${p.deathDate}</div>` : ""}
    </div>`;
      });

      html += `
  </div>
  <p style="text-align:center; margin-top: 40px; color: #888;">تم التصدير من جذور الإمارات</p>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${tree.name}.html"`,
      );
      return res.send(html);
    }

    if (format === "text") {
      let text = `${tree.name}\n${"=".repeat(tree.name.length)}\n\n`;
      if (tree.description) text += `${tree.description}\n\n`;

      text += `أفراد العائلة (${decryptedPeople.length}):\n${"─".repeat(30)}\n\n`;

      decryptedPeople.forEach((p, i) => {
        text += `${i + 1}. ${p.firstName} ${p.lastName || ""}\n`;
        text += `   الجنس: ${p.gender === "male" ? "ذكر" : "أنثى"}\n`;
        if (p.birthDate) text += `   تاريخ الميلاد: ${p.birthDate}\n`;
        if (p.deathDate) text += `   تاريخ الوفاة: ${p.deathDate}\n`;
        text += `   الحالة: ${p.isLiving ? "على قيد الحياة" : "متوفى"}\n\n`;
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${tree.name}.txt"`,
      );
      return res.send(text);
    }

    res.json({
      tree,
      people: decryptedPeople,
      relationships: allRelationships,
    });
  } catch (error) {
    handleError(res, error, "Export");
  }
});

// Audit log cleanup - removes logs older than 90 days
const AUDIT_LOG_RETENTION_DAYS = 90;
const cleanupAuditLogs = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AUDIT_LOG_RETENTION_DAYS);

    const result = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, cutoffDate));
    console.log(
      `[Audit Cleanup] Removed audit logs older than ${AUDIT_LOG_RETENTION_DAYS} days`,
    );
  } catch (error) {
    console.error("[Audit Cleanup] Error:", error.message);
  }
};

// Run cleanup once on startup and then every 24 hours
cleanupAuditLogs();
setInterval(cleanupAuditLogs, 24 * 60 * 60 * 1000);

// Health check endpoint for monitoring and load balancers
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

if (isProduction) {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));

  // SPA fallback: any non-API path serves index.html so deep links like
  // /privacy or /tree/842 survive a reload. Unknown API paths previously fell
  // through with NO response, leaving the request hanging until it timed out —
  // they now get a 404.
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend server running on port ${PORT}`);
});
