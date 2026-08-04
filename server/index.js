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

// Set ONLY while rotating ENCRYPTION_KEY, then removed.
//
// Rotation is otherwise impossible: every phone, email and ID number in `people`
// is sealed under the current key, and changing it without a fallback makes all
// of them permanently unreadable. There is no way back, because the plaintext
// exists nowhere else.
//
// With this set, reads accept EITHER key while writes always use the new one, so
// rows re-encrypt themselves as they are edited and nothing breaks in between.
// Anything not edited still needs a deliberate re-encryption pass before the old
// key is dropped — see the rotation runbook.
//
// Leave it unset in normal operation. Unset, the behaviour below is identical to
// having no fallback at all.
const PREVIOUS_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY_PREVIOUS;
const PREVIOUS_DERIVED_KEY = PREVIOUS_ENCRYPTION_KEY
  ? deriveEncryptionKey(PREVIOUS_ENCRYPTION_KEY)
  : null;

if (PREVIOUS_DERIVED_KEY && PREVIOUS_ENCRYPTION_KEY === ENCRYPTION_KEY) {
  console.error(
    "ENCRYPTION_KEY_PREVIOUS is identical to ENCRYPTION_KEY - rotation has not happened",
  );
  process.exit(1);
}

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

    // GCM authenticates, so the wrong key throws rather than returning rubbish.
    // That makes "try the current key, fall back to the previous one" safe: a
    // successful decrypt is proof the key was right, never a coincidence.
    const attempt = (key) => {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(ivHex, "hex"),
        { authTagLength: 16 },
      );
      decipher.setAuthTag(Buffer.from(tagHex, "hex"));
      const out = decipher.update(data, "hex", "utf8");
      return out + decipher.final("utf8");
    };

    try {
      return attempt(DERIVED_KEY);
    } catch (currentKeyError) {
      if (!PREVIOUS_DERIVED_KEY) throw currentKeyError;
      // Written under the old key and not yet re-encrypted. Logged without the
      // value or the row, so a rotation can be watched to completion: when this
      // stops appearing, every row that gets read has been migrated.
      const value = attempt(PREVIOUS_DERIVED_KEY);
      debugLog("Decrypted with PREVIOUS encryption key - re-encryption pending");
      return value;
    }
  } catch (error) {
    console.error("Decryption failed:", error.message);
    return null;
  }
};

// Normalize photo URL (photo upload removed, pass through as-is or null)
const normalizePhotoUrl = (url) => {
  if (!url) return null;
  return url;
};

// sanitizeText and sanitizeUserInput removed. They escaped & < > " ' on the way
// INTO the database. React escapes on render, so stored values were encoded twice
// and a name containing & displayed as &amp;. Their only genuine consumer was the
// HTML export, which is gone. Encode at output, never at input.


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
        // No 'unsafe-inline'. With it, an injected <script> executes and the
        // policy stops being a defence against XSS at all — which matters here
        // because the app renders names typed by one family member and read by
        // another.
        //
        // Nothing in this app needs it: index.html carries exactly one script
        // tag, external and type=module, and there is not a single inline
        // handler anywhere in the source. It was almost certainly added for the
        // Firebase auth popup rather than for our own markup.
        //
        // If a login path breaks, the fix is a per-response nonce — generate one
        // per request, put it in the CSP header and on the tag that needs it.
        // Restoring the wildcard would undo the whole point.
        scriptSrc: [
          "'self'",
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://*.firebaseapp.com",
        ],
        // styleSrc KEEPS 'unsafe-inline'. React writes inline style attributes
        // and Tailwind emits them too; removing it here would need a nonce on
        // every style the framework generates, which is a different and much
        // larger problem than the script case. Inline STYLE is also a far weaker
        // vector than inline SCRIPT — it cannot execute.
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

  // Every API response carries family members' names and relationships. Without
  // this a shared or corporate proxy may hold a full tree, and the browser cache
  // keeps it after logout. Applied to /api only — the static bundle SHOULD be
  // cached, and caching it is how the app loads quickly.
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});


// Audit every refusal, in ONE place.
//
// The trail recorded what happened, not what was ATTEMPTED. 73 refusal points
// existed and 18 wrote an entry — so a 403 on someone else's tree, a rejected
// maḥram marriage, an expired token and a validation failure were all invisible.
// The log could not show somebody probing.
//
// Intercepting the response rather than editing 55 call sites: it cannot miss a
// site, and it covers refusals added later. Fire-and-forget so a slow audit write
// never delays the response the user is waiting for.
// Both health paths: a monitor hitting one of these every minute would
// otherwise bury every real event in the audit log.
const AUDIT_SKIP_PATHS = ["/health", "/health/ready"];
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode;
    if (
      status >= 400 &&
      status < 500 &&
      req.path.startsWith("/api") &&
      !AUDIT_SKIP_PATHS.includes(req.path)
    ) {
      // The identity is whoever the request CLAIMED to be. On a 401 there is no
      // verified user, so fall back to the cookie's own claim — which is exactly
      // what you want to see when someone is probing with a stale token.
      const who = req.userId || extractUserIdFromCookie(req) || "anonymous";
      const action =
        status === 401
          ? "auth_refused"
          : status === 403
            ? "access_refused"
            : status === 429
              ? "rate_limited"
              : "request_refused";

      // The message, not the request body: bodies carry names, dates and phone
      // numbers, and this table already holds an IP and a user agent.
      logAudit(
        who,
        action,
        "request",
        null,
        {
          status,
          method: req.method,
          path: req.path,
          reason:
            typeof body?.error === "string" ? body.error.slice(0, 200) : null,
        },
        req,
      ).catch(() => {});
    }
    return originalJson(body);
  };
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
// Reads the app itself polls. Generous, because loadRestorableDeletion fires on
// every mutation and a user editing quickly must not be blocked.
const readLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: "عمليات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const userId = extractUserIdFromCookie(req) || "anonymous";
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    return `${userId}:${ip}`;
  },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: { error: "عمليات كثيرة خلال وقت قصير. انتظر قليلاً ثم أعد المحاولة" },
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
  phone: z.string().max(20).optional().nullable(),
  email: z
    .string()
    .email()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal(""))
    .or(z.null()),
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

// Invalidate every existing session for a user. Any token signed before this
// bump fails the version check on its next request.
//
// NOTE what this does and does not do. A phone session ends outright. A Google
// session ends until the person actively signs in again — their Firebase
// credential lives in browser storage, so a reload mints them a new app token.
// That is correct for "sign out my other devices"; it is not a lockout, and
// stopping a compromised Google ACCOUNT is Google's control, not ours.
// Returns the version actually stored, so a caller can mint a token that matches
// the database rather than one it assumes matches. The failure used to be
// swallowed here while versionForNewSession returned `existing + 1` regardless,
// so a failed UPDATE produced a token one ahead of the row — refused on the very
// next request, with nothing in the response to explain why.
const bumpTokenVersion = async (userId, reason, req) => {
  try {
    const [row] = await db
      .update(users)
      .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
      .where(eq(users.id, userId))
      .returning({ tokenVersion: users.tokenVersion });
    await logAudit(userId, "sessions_terminated", "auth", null, { reason }, req);
    return row?.tokenVersion ?? null;
  } catch (error) {
    console.error("Token version bump failed:", error);
    return null;
  }
};

// The version a new session should carry. With SINGLE_SESSION on, logging in
// bumps first, so the token just issued is the ONLY valid one and every other
// device is signed out — OWASP item 68 taken literally.
//
// If the bump fails, the honest answer is the version still on the row: the other
// devices were NOT signed out, and minting `existing + 1` would only add a second
// broken session to the first problem.
const versionForNewSession = async (userId, existingVersion, req) => {
  if (!SINGLE_SESSION) return existingVersion ?? 0;
  const stored = await bumpTokenVersion(userId, "single_session_login", req);
  return stored ?? existingVersion ?? 0;
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

// recordEdit REMOVED, and with it every write to edit_history.
//
// It duplicated what `deletions` already stores — full before/after person rows,
// names, dates, birth places, professions and encrypted phone/email — for every
// create, update and delete. The difference is that `deletions` is READ: it is
// the undo stack, it marks rows restored, and the list endpoint caps at 50.
// edit_history was read by exactly one endpoint, GET /api/history/:treeId, which
// no client code has ever called.
//
// So it was a growing store of family PII with no reader and no retention.
// audit_logs prunes at 90 days; this kept everything since January 2026 — 1,034
// rows on production, 1,781 on staging. Account deletion removed it, but nothing
// else ever did.
//
// The table itself stays in shared/schema.js and in both databases. Nothing
// writes or reads it now.

// ONE window for both the cookie and the JWT. They disagreed — cookie 7 days,
// token 24 hours — so after a day the browser held a cookie the server would not
// accept, and the app could not tell that apart from having no session at all.
// Every user was silently logged out daily.
// 48 hours: long enough to survive a weekend, short enough that a shared or
// unattended laptop is not signed in all week. The bug being fixed was the
// MISMATCH — cookie 7 days, token 24 hours — not the length, and the slide below
// means an active user is never logged out mid-session regardless of the window.
// OWASP item 68: do not allow concurrent logins with the same user id. ON, so
// signing in anywhere ends every other session for that account — sign in on your
// phone and your laptop is signed out.
//
// That is a real daily cost, and it is the literal reading of the item. Set
// SINGLE_SESSION=false to turn it off if it proves more annoying than it is worth;
// the rest of the revocation machinery — unlink ends the sessions it created —
// works either way.
const SINGLE_SESSION = process.env.SINGLE_SESSION !== "false";

// The only endpoints a session with no `users` row may reach. Creating the row
// is the whole point of the first; the second is how cancelling gets out again.
// Everything else needs a real account. Paths are matched exactly.
const SIGNUP_ONLY_PATHS = new Set(["/api/users", "/api/auth/logout"]);

const SESSION_HOURS = 48;
const SESSION_MS = SESSION_HOURS * 60 * 60 * 1000;
const SESSION_EXPIRES_IN = `${SESSION_HOURS}h`;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Always use secure cookies (H1: prevents cookie interception)
  sameSite: isProduction ? "strict" : "lax",
  maxAge: SESSION_MS,
  path: "/",
};

// The session-id cookie. Deliberately OUTLIVES the JWT — that is the whole point.
// `auth_token` dies with the token it carries, so by the time a browser comes
// back to re-mint there is nothing left to prove it was ever here. This survives,
// and answers one question at /auth/token: was this browser the last to log in?
//
// It is NOT a credential. Presenting it alone authenticates nothing; Firebase or
// the SMS code is still required. The worst a stolen one does is let its holder
// re-mint without evicting the real holder — and re-minting already needs the
// real Firebase credential.
const SID_COOKIE_NAME = "session_id";
const SID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const SID_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: isProduction ? "strict" : "lax",
  maxAge: SID_MAX_AGE_MS,
  path: "/",
};

const newSessionId = () => crypto.randomBytes(32).toString("hex");

// Record a NEW holder: fresh id, stored on the row, handed to this browser.
// Rotated on every deliberate login — OWASP item 67, a new session identifier on
// re-authentication.
const startSession = async (res, userId) => {
  const sid = newSessionId();
  try {
    await db
      .update(users)
      .set({ currentSessionId: sid })
      .where(eq(users.id, userId));
    res.cookie(SID_COOKIE_NAME, sid, SID_COOKIE_OPTIONS);
  } catch (error) {
    // Not fatal. Without a stored sid the next return simply reads as a fresh
    // login and bumps — the behaviour that existed before this column.
    console.error("Failed to store session id:", error.message);
  }
};

// Does this browser hold the CURRENT session? Both sides must be present: a null
// column must never match a missing cookie and silently count as a restore.
const isCurrentHolder = (req, account) =>
  Boolean(
    account?.currentSessionId &&
      req.cookies?.[SID_COOKIE_NAME] &&
      req.cookies[SID_COOKIE_NAME] === account.currentSessionId,
  );

// Slide the session forward for anyone still using the app. Without this a
// 7-day window is a hard cut-off: someone active on day 7 is logged out mid-task.
// Re-issued only past the halfway mark, so most requests set no cookie.
const slideSession = (req, res, decoded, tokenVersion = 0) => {
  try {
    if (!decoded?.exp) return;
    const remainingMs = decoded.exp * 1000 - Date.now();
    if (remainingMs > SESSION_MS / 2) return;

    // Carry the CURRENT version, not the one in the old token — otherwise a slide
    // would quietly re-issue a token that a bump had just invalidated.
    const token = jwt.sign(
      {
        userId: decoded.userId,
        type: decoded.type,
        tv: tokenVersion,
        // Carried forward unchanged. Dropping it would turn a sign-up session
        // into one that looks like a DELETED account, and the next request
        // would refuse it mid-signup.
        ...(decoded.na ? { na: true } : {}),
      },
      JWT_SECRET,
      { expiresIn: SESSION_EXPIRES_IN },
    );
    res.cookie("auth_token", token, COOKIE_OPTIONS);
  } catch (error) {
    // A failed refresh must never break the request it was riding on — the
    // existing token is still valid for whatever is left of its life.
    console.error("Session slide failed:", error);
  }
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
    // NO sessionEnded flag. Nothing was terminated — there was never a cookie on
    // this request. That flag drives a HARD logout on the client: Firebase
    // sign-out, session restore blocked, amber eviction banner. Raising it here
    // told someone whose request merely arrived without a cookie that another
    // device had signed them out. Version mismatch and expiry are real endings;
    // this is not one.
    debugLog(`[${rid}][Auth] No token found - returning 401`);
    return res.status(401).json({ error: "الجلسة غير موجودة" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Is this token still current for its user? A valid signature only proves the
    // token was issued by us — not that it should still work. Bumping
    // users.token_version invalidates every token signed before the bump, which
    // is what makes "sign out everywhere" and unlink-terminates-sessions real.
    //
    // Tokens issued before this column existed carry no version. They are treated
    // as 0, matching the default, so deploying this does not sign everyone out.
    const [account] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, decoded.userId));

    // The account does not exist. Two very different situations look identical
    // here — a valid token with no matching row — and only the token tells them
    // apart:
    //
    //   `na` present -> issued BEFORE the row existed. That is the sign-up gate:
    //                   the server hands out a session, the person confirms, and
    //                   only then is the row written. Allowed, but ONLY on the
    //                   endpoints that gate actually needs.
    //   `na` absent  -> issued while the row DID exist, and it is gone now, so
    //                   the account was deleted. This check used to read
    //                   `if (account && ...)`, so a missing row skipped it
    //                   entirely and the token kept working for up to 48h on
    //                   every other device. Bumping token_version cannot fix
    //                   that: the row it lives on has been deleted.
    if (!account) {
      if (!decoded.na || !SIGNUP_ONLY_PATHS.has(req.path)) {
        res.clearCookie("auth_token", COOKIE_OPTIONS);
        return res
          .status(401)
          .json({ error: "الجلسة غير صالحة", sessionEnded: true });
      }
      // Pre-account session on a sign-up path. No version check: there is no row
      // to carry a version, and no slide either.
      req.userId = decoded.userId;
      req.userType = decoded.type;
      // POST /api/users needs to know this session was pre-account, so it can
      // replace it with a real one the moment the row is written.
      req.tokenClaims = decoded;
      debugLog(`[${rid}][Auth] Pre-account session on ${req.path}`);
      return next();
    }

    if ((decoded.tv ?? 0) !== (account.tokenVersion ?? 0)) {
      // A version mismatch is not an expiry. The session was ENDED — by a sign-in
      // elsewhere, or by unlinking the method it came in through. Saying "expired"
      // sends the user looking for a timeout that never happened.
      //
      // The cookie is deliberately LEFT IN PLACE. Clearing it here made this
      // message fire exactly ONCE: the next request then carried no cookie at all
      // and took the branch above, which correctly does NOT claim a session
      // ended. If that single evicted request was one the user never saw, the
      // signal was gone for good — the app went on looking signed in, navigation
      // kept working because it is client-side, and every write failed with
      // "الجلسة غير موجودة" and no explanation.
      //
      // Keeping it costs nothing. The token is refused on every request that
      // presents it, so it grants no access; it only ensures this branch keeps
      // being reached, so the banner appears the moment the user does anything.
      // It is also safe in a way it was not before `session_id` existed: whether
      // a returning browser is the current holder is now decided by the sid,
      // never by the presence of a stale auth_token.
      return res.status(401).json({
        error: "تم إنهاء هذه الجلسة لتسجيل الدخول من جهاز آخر",
        sessionEnded: true,
      });
    }

    req.userId = decoded.userId;
    req.userType = decoded.type;
    req.tokenClaims = decoded;
    slideSession(req, res, decoded, account?.tokenVersion ?? 0);
    debugLog(`[${rid}][Auth] Token valid - userId: ${req.userId}`);
    next();
  } catch (jwtError) {
    debugLog(`[${rid}][Auth] Token invalid or expired:`, jwtError.message);
    res.clearCookie("auth_token", COOKIE_OPTIONS);
    return res
      .status(401)
      .json({ error: "انتهت صلاحية الجلسة", sessionEnded: true });
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

      // The same version check as authenticateUser. Without it /api/auth/check
      // would answer authenticated:true for a token that every other route
      // rejects — the app would restore a session it cannot use.
      const [account] = await db
        .select({ tokenVersion: users.tokenVersion })
        .from(users)
        .where(eq(users.id, decoded.userId));

      // Deleted account: no row and no `na`. This middleware never refuses, it
      // REPORTS — so the answer has to be "signed out", or /api/auth/check would
      // claim a live session for an account that no longer exists. A pre-account
      // (`na`) session is left alone: hasAccount:false is what reopens the gate.
      if (!account && !decoded.na) {
        res.clearCookie("auth_token", COOKIE_OPTIONS);
        return next();
      }

      if (account && (decoded.tv ?? 0) !== (account.tokenVersion ?? 0)) {
        res.clearCookie("auth_token", COOKIE_OPTIONS);
        return next();
      }

      req.userId = decoded.userId;
      req.userType = decoded.type;
      // /api/auth/check runs through here, and it is the FIRST request a
      // returning user makes — the natural place to renew a session that is
      // most of the way through its life.
      slideSession(req, res, decoded, account?.tokenVersion ?? 0);
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

    // One lookup, two answers: whether an account exists yet (so the client can
    // ask before creating one) and its current token version.
    const [existingAccount] = await db
      .select({ id: users.id, tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, userId));

    const token = jwt.sign(
      {
        userId: userId,
        type: "phone",
        tv: existingAccount
          ? await versionForNewSession(
              userId,
              existingAccount.tokenVersion,
              req,
            )
          : 0,
        // No account row yet — the sign-up gate is about to ask. Recorded IN the
        // token so a later request can tell "not created yet" from "deleted".
        ...(existingAccount ? {} : { na: true }),
      },
      JWT_SECRET,
      { expiresIn: SESSION_EXPIRES_IN },
    );

    res.cookie("auth_token", token, COOKIE_OPTIONS);

    // Always a new session id: entering an SMS code is never a silent restore.
    // There is no equivalent of the Firebase path's automatic re-mint here.
    if (existingAccount) {
      await startSession(res, userId);
    }

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
      isNewUser: !existingAccount,
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

    // Does this id already have an account? The client needs to know BEFORE it
    // creates one — pressing "login" with an unrecognised Google address used to
    // make a new account silently, with no confirmation and no terms. The same
    // lookup yields the token version the new session must carry.
    const [existingAccount] = await db
      .select({
        id: users.id,
        tokenVersion: users.tokenVersion,
        currentSessionId: users.currentSessionId,
      })
      .from(users)
      .where(eq(users.id, resolvedUserId));

    // This endpoint is called by two different things and could not tell them
    // apart: a person pressing sign-in, and the app silently re-minting because
    // its cookie expired while the Firebase credential is still good. Both bumped
    // token_version, so an expired cookie on device A evicted device B with
    // nobody having logged in anywhere.
    const restoring = isCurrentHolder(req, existingAccount);

    const token = jwt.sign(
      {
        userId: resolvedUserId,
        type: provider || "firebase",
        tv: existingAccount
          ? restoring
            ? // The rightful holder returning. Re-issue at the SAME version and
              // evict nobody — nothing about who holds the account has changed.
              existingAccount.tokenVersion ?? 0
            : await versionForNewSession(
                resolvedUserId,
                existingAccount.tokenVersion,
                req,
              )
          : 0,
        // See the phone path: marks a session issued BEFORE any account existed.
        ...(existingAccount ? {} : { na: true }),
      },
      JWT_SECRET,
      { expiresIn: SESSION_EXPIRES_IN },
    );

    res.cookie("auth_token", token, COOKIE_OPTIONS);

    // Recorded distinctly. A silent restore used to appear in the trail as a
    // `login`, so the log showed sign-ins nobody performed — and that log is the
    // only reliable evidence when a session bug is being diagnosed.
    await logAudit(
      resolvedUserId,
      restoring ? "session_restored" : "login",
      "auth",
      null,
      { provider, linkedAccount: !!existingUser },
      req,
    );

    // A real login takes over: new session id, stored and handed to this browser.
    // A restore keeps the one it already holds — rotating it there would treat a
    // cookie expiring as if it were a sign-in.
    if (existingAccount && !restoring) {
      await startSession(res, resolvedUserId);
    }

    // Cookie only. Returning the JWT in the body as well made it readable by any
    // script on the page, which is precisely what httpOnly prevents. The client
    // never used the value — setAuthToken ignores its first argument — it was
    // only ever a flag for the phone path, now replaced by a boolean.
    res.json({
      userId: resolvedUserId,
      isLinkedAccount: !!existingUser,
      isNewUser: !existingAccount,
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

    // End sessions ONLY if this session used the method being removed. Unlinking
    // Google while signed in by phone must not sign you out — nothing about that
    // session depended on Google.
    //
    // req.userType is the JWT's type claim: "phone", or a provider like
    // "google.com". The identity being removed is a phone row or an email/provider
    // row, so comparing the two answers "did I come in through this?".
    const removedWasPhone = identity.identityType === "phone";
    const sessionIsPhone = req.userType === "phone";
    if (removedWasPhone === sessionIsPhone) {
      await bumpTokenVersion(req.userId, "identity_unlinked", req);
    }

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

  // The session id goes too, on BOTH sides. Leaving the row set would let this
  // browser come back and be read as the current holder — restoring a session it
  // deliberately ended, without the bump a fresh login owes the other devices.
  // Cleared only if this browser is the holder: a stale device logging out must
  // not wipe the id belonging to whoever replaced it.
  try {
    const [account] = await db
      .select({ currentSessionId: users.currentSessionId })
      .from(users)
      .where(eq(users.id, req.userId));
    if (isCurrentHolder(req, account)) {
      await db
        .update(users)
        .set({ currentSessionId: null })
        .where(eq(users.id, req.userId));
    }
  } catch (error) {
    console.error("Failed to clear session id on logout:", error.message);
  }
  res.clearCookie(SID_COOKIE_NAME, SID_COOKIE_OPTIONS);

  res.json({ success: true });
});

app.get("/api/auth/check", optionalAuth, async (req, res) => {
  if (req.userId) {
    // sessionType comes from the JWT, which records how this session was
    // created. The client cannot infer it: linking Google deliberately destroys
    // the Firebase session, so "is there a Firebase session" answers a different
    // question and gets it wrong for anyone who has linked.
    const [existingAccount] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, req.userId));

    // hasAccount is what makes the sign-up gate survive a reload. pendingSignup
    // is in-memory, so a refresh loses it and the restore effects create the
    // account nobody agreed to. Asking the server "does this session's id have a
    // users row" turns a remembered decision into a detected fact.
    res.json({
      authenticated: true,
      userId: req.userId,
      sessionType: req.userType || null,
      hasAccount: !!existingAccount,
    });
  } else {
    res.json({ authenticated: false });
  }
});

app.use("/api/users", apiLimiter);
app.use("/api/trees", apiLimiter);
app.use("/api/people", apiLimiter);
app.use("/api/relationships", apiLimiter);

// SEPARATE budgets, not the same one. `apiLimiter` is a single instance, so every
// path mounted on it shares one 50/minute allowance. /api/deletions is polled by
// the app itself — loadRestorableDeletion runs on every change to people or
// relationships — so adding a person with two parents costs three writes plus
// three polls. Putting all of that on one budget would rate-limit ordinary
// editing.
app.use("/api/deletions", readLimiter);


app.post("/api/users", authenticateUser, async (req, res) => {
  const rid = req.requestId || "";
  // The body carries email, displayName and phoneNumber. It was logged in full,
  // unconditionally, so every sign-up wrote a person's contact details into the
  // hosting provider's log — which is not access-controlled the way the database
  // is, and is not covered by account deletion. debugLog exists for exactly this
  // and was bypassed here.
  debugLog(`[${rid}][Users] POST - incoming body:`, JSON.stringify(req.body));
  debugLog(`[${rid}][Users] POST - req.userId from JWT: "${req.userId}"`);

  try {
    const validatedData = userCreateSchema.parse(req.body);

    debugLog(
      `[${rid}][Users] POST - req.userId: "${req.userId}", validatedData.id: "${validatedData.id}"`,
    );

    if (req.userId !== validatedData.id) {
      debugLog(`[${rid}][Users] Mismatch! req.userId !== validatedData.id`);
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

    // Creation only happens after the sign-up screen is confirmed, so this is
    // the moment consent was actually given.
    const [user] = await db
      .insert(users)
      .values({
        id: validatedData.id,
        email: validatedData.email || null,
        displayName: validatedData.displayName || null,
        phoneNumber: validatedData.phoneNumber || null,
        provider: validatedData.provider || "unknown",
        termsAcceptedAt: new Date(),
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

    // A NEW session, now that the account exists.
    //
    // The session that reached this endpoint was issued before any `users` row
    // existed and carries `na: true` — the marker that lets a pre-account session
    // through. It is only supposed to live for the seconds between the token
    // exchange and this confirmation, but nothing re-issued it, so it kept `na`
    // for its full 48 hours. Deleting the account within that window left a token
    // that still passed the pre-account guard: the app reopened the sign-up gate
    // for a deleted account instead of refusing the session.
    //
    // OWASP items 66 and 67: a session established before login is replaced once
    // the identity is established, and re-authentication issues a new identifier.
    // Reissuing here also fixes a second thing — the old token's `tv` was frozen
    // at 0 from before the row existed, so it did not track the account it now
    // belongs to.
    //
    // Only for a session that actually carries `na`. An ordinary sign-in reaching
    // this endpoint (the update branch above returns earlier, so this is the
    // create path only) is left alone.
    if (req.tokenClaims?.na) {
      const freshToken = jwt.sign(
        {
          userId: user.id,
          type: req.userType || validatedData.provider || "firebase",
          tv: user.tokenVersion ?? 0,
        },
        JWT_SECRET,
        { expiresIn: SESSION_EXPIRES_IN },
      );
      res.cookie("auth_token", freshToken, COOKIE_OPTIONS);
      await logAudit(
        user.id,
        "session_upgraded",
        "auth",
        null,
        { reason: "account_created" },
        req,
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

// REMOVED: PUT /api/users/:id
//
// Unreachable AND redundant. Its only caller was api.users.update, called only by
// handleSaveProfile — which is defined once in App.jsx and never invoked; there
// is no email/phone edit UI. `setProfileEmail` and `setProfilePhone` are never
// called either, so the state it read was permanently empty.
//
// Had it run, it would have DESTROYED data: userUpdateSchema makes all three
// fields optional while the handler set each to `|| null`, so a partial update
// nulled whatever it omitted — and with empty state, all three.
//
// The legitimate update path already exists: POST /api/users updates
// lastLoginAt, displayName and email when the row is already there.
//
// Note what it could never have done anyway: editing users.email does not change
// how anyone signs in. Login resolves through auth_identities, which this never
// touched. A profile editor that appears to change your login address without
// doing so is worse than none.

// Deleting an account requires proving you are still there — a fresh credential,
// not merely a session that was created at some point in the past. Everything else
// in this app is reversible; this is not, and it takes seven tables with it.
//
// The proof matches how the session was created: a Google session re-runs the
// popup and sends the resulting token, a phone session receives an SMS code.
const verifyReauth = async (req) => {
  const isPhone = req.userType === "phone";

  if (isPhone) {
    const { phoneNumber, code } = req.body || {};
    if (!phoneNumber || !code) return "رمز التحقق مطلوب لحذف الحساب";

    const formatted = normalizePhone(phoneNumber);
    // The number must be one of THIS account's, or a code sent to any phone at
    // all would authorise deleting someone else's account.
    const own = await db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.userId, req.userId),
          eq(authIdentities.identityType, "phone"),
          eq(authIdentities.identityValue, formatted),
        ),
      );
    if (own.length === 0) return "رقم الهاتف لا يخص هذا الحساب";

    try {
      const twilio = (await import("twilio")).default;
      const { accountSid, authToken } = await getTwilioCredentials();
      const client = twilio(accountSid, authToken);
      const verifySid = process.env.TWILIO_VERIFY_SID;
      if (!verifySid) return "خدمة التحقق غير مهيأة";
      const check = await client.verify.v2
        .services(verifySid)
        .verificationChecks.create({ to: formatted, code });
      if (check.status !== "approved") return "رمز التحقق غير صحيح";
    } catch (error) {
      console.error("Reauth: Twilio check failed:", error);
      return "تعذّر التحقق من الرمز";
    }
    return null;
  }

  const { firebaseIdToken } = req.body || {};
  if (!firebaseIdToken) return "إعادة تسجيل الدخول مطلوبة لحذف الحساب";
  try {
    const admin = (await import("firebase-admin")).default;
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID });
    }
    const decoded = await admin.auth().verifyIdToken(firebaseIdToken);
    const email = decoded?.email ? normalizeEmail(decoded.email) : null;

    // The token must belong to THIS account. Any valid Google token would
    // otherwise authorise deleting any account.
    const match = await db
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.userId, req.userId),
          eq(authIdentities.identityType, "email"),
          eq(authIdentities.identityValue, email || ""),
        ),
      );
    if (match.length === 0 && decoded?.uid !== req.userId) {
      return "الحساب المستخدم للتحقق لا يطابق هذا الحساب";
    }

    // auth_time is when the user last actually authenticated, not when the token
    // was minted. A token refreshed from a stored credential carries an old
    // auth_time, which is exactly the case this check exists to reject.
    const authAgeSeconds = Date.now() / 1000 - (decoded?.auth_time ?? 0);
    if (authAgeSeconds > 300) {
      return "يرجى تسجيل الدخول مرة أخرى قبل حذف الحساب";
    }
  } catch (error) {
    console.error("Reauth: Firebase verification failed:", error);
    return "تعذّر التحقق من الحساب";
  }
  return null;
};

app.delete("/api/users/:id", authenticateUser, async (req, res) => {
  try {
    const userId = req.params.id;

    if (req.userId !== userId) {
      return res.status(403).json({ error: "غير مصرح بالوصول" });
    }

    const reauthError = await verifyReauth(req);
    if (reauthError) {
      await logAudit(
        req.userId,
        "delete_refused",
        "user",
        userId,
        { reason: "reauth_failed" },
        req,
      );
      return res.status(401).json({ error: reauthError });
    }

    const userTrees = await db
      .select()
      .from(trees)
      .where(eq(trees.createdBy, userId));

    // The audit entry goes FIRST, deliberately. logAudit writes through `db`, not
    // through the transaction, so running it inside would be a second connection
    // contending for locks the transaction already holds on auditLogs — a
    // deadlock. Recording the intent up front also means a failed deletion leaves
    // evidence it was attempted, which is the more useful failure.
    await logAudit(
      userId,
      "delete",
      "user",
      userId,
      { deletedTrees: userTrees.length },
      req,
    );

    // ALL of it, or none. Seven tables were deleted as a loose sequence: a failure
    // partway left trees gone and the user row present, or people gone and their
    // relationships orphaned. That is the shape of every stray record cleaned up
    // by hand so far.
    await db.transaction(async (tx) => {
      for (const tree of userTrees) {
        await tx.delete(relationships).where(eq(relationships.treeId, tree.id));
        await tx.delete(people).where(eq(people.treeId, tree.id));
        await tx.delete(editHistory).where(eq(editHistory.treeId, tree.id));
        // Deletion snapshots hold full person rows (names, dates, encrypted
        // phone/email) for everyone the user ever deleted. They must go with the
        // account, or "we delete all your data" is not true.
        await tx.delete(deletions).where(eq(deletions.treeId, tree.id));
        await tx.delete(trees).where(eq(trees.id, tree.id));
      }

      // Anything the loop above could not reach. edit_history carries BOTH a
      // treeId and a userId, and only treeId was used — so a row whose tree had
      // already gone (deleted by hand, or before the FK cascade existed) was
      // never matched by the loop and outlived the account. Its previousData and
      // newData are whole person rows: names, dates, encrypted phone and email.
      // The privacy policy says nothing remains, so nothing may.
      await tx.delete(editHistory).where(eq(editHistory.userId, userId));

      // Same reasoning for deletion snapshots, keyed by the user who made them.
      await tx.delete(deletions).where(eq(deletions.deletedBy, userId));

      await tx.delete(users).where(eq(users.id, userId));

      // Audit rows outlived the account: user id, IP address and user agent for
      // every login and every edit. Removed last, so the entry written above goes
      // with the rest and no personal trace of the account survives.
      await tx.delete(auditLogs).where(eq(auditLogs.userId, userId));
    });

    res.clearCookie("auth_token", COOKIE_OPTIONS);
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    handleError(res, error, "User delete");
  }
});

app.get("/api/trees", authenticateUser, async (req, res) => {
  try {
    const { userId } = req.query;

    debugLog(
      `[Trees] GET - req.userId: "${req.userId}", query.userId: "${userId}"`,
    );

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (req.userId !== userId) {
      debugLog(`[Trees] Mismatch! req.userId !== query.userId`);
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

    // No HTML escaping on the way in. React encodes at render, which is where
    // encoding belongs; escaping here too produced DOUBLE encoding, so a name
    // containing & was stored and displayed as &amp;. The escaping was only
    // load-bearing for the HTML export, which is gone.
    const sanitizedData = validatedData;

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

// DELETE /api/trees/:id was REMOVED.
//
// The app is one tree per user by design — milk-siblings, divorce, every
// relationship type lives inside a single tree, and nothing is ever split across
// several. App.jsx takes userTrees[0] and creates one if none exists; there is no
// picker and no way to make a second. The endpoint was left over from an earlier
// multi-tree design, alongside the export endpoint and the migration scripts.
//
// Nothing called it. It was authenticated but destructive with no confirmation
// and no undo — and unlike batch-delete it wrote no snapshot to `deletions`, it
// deleted them, so a session-holder could permanently erase an entire tree by id
// with no way back. Deleting a tree now happens only through account deletion,
// which is transactional and re-authenticated.
//
// If multi-tree is ever built it will want soft-delete and a confirmation flow,
// not this. Git has the original.

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
          photoUrl: normalizePhotoUrl(person.photoUrl),
        };
      } catch (decryptError) {
        console.error(`[${rid}][People] Decrypt error for person ${person.id}:`, decryptError.message);
        return {
          ...person,
          phone: null,
          email: null,
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

// REMOVED: GET /api/people/search
//
// No search UI exists. api.people.search was defined in api.js and called from
// nowhere, so this endpoint has never been reachable. Removed with it rather
// than left as a maintained path nobody can invoke — and with it the only
// consumer of escapeLikePattern.
//
// If search returns it will need the ILIKE escaping back: `%` and `_` in a
// user's query are wildcards, so an unescaped search for "_" matches everyone.

app.post("/api/people", authenticateUser, async (req, res) => {
  try {
    // A person row is name, birth date, birth place, profession, phone and email.
    // phone/email are encrypted at rest and were being printed in PLAINTEXT here
    // on the way in, so the log undid the encryption for every person ever added.
    debugLog("POST /api/people received data:", req.body);
    const validatedData = personSchema.parse(req.body);
    debugLog("After validation:", validatedData);

    const ownership = await verifyTreeOwnership(
      validatedData.treeId,
      req.userId,
    );
    if (!ownership.valid) {
      return res.status(403).json({ error: ownership.error });
    }

    const sanitizedData = validatedData;

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
      phone: encryptPII(sanitizedData.phone),
      email: encryptPII(sanitizedData.email),
      profession: sanitizedData.profession || null,
      birthOrder: sanitizedData.birthOrder ?? null,
      photoUrl: sanitizedData.photoUrl || null,
    };
    debugLog("Saving to DB:", personData);
    const [person] = await db.insert(people).values(personData).returning();

    await recordUndo({
      treeId: validatedData.treeId,
      userId: req.userId,
      groupId: req.headers["x-action-group"] || null,
      kind: "create",
      label: person.firstName || null,
      peopleAfter: [person],
    });

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
    debugLog("PUT /api/people/:id received data:", req.body);
    const personId = validateId(req.params.id);
    if (!personId) {
      return res.status(400).json({ error: "Invalid person ID" });
    }

    const validatedData = personUpdateSchema.parse(req.body);
    debugLog("After validation:", validatedData);

    // Note the create path escaped four fields and this one escaped six, so the
    // same field was stored escaped or not depending on which endpoint wrote it.
    const sanitizedData = validatedData;

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
    if (sanitizedData.phone !== undefined)
      personData.phone = encryptPII(sanitizedData.phone);
    if (sanitizedData.email !== undefined)
      personData.email = encryptPII(sanitizedData.email);
    if (sanitizedData.profession !== undefined)
      personData.profession = sanitizedData.profession || null;
    if (sanitizedData.birthOrder !== undefined)
      personData.birthOrder = sanitizedData.birthOrder;
    if (sanitizedData.photoUrl !== undefined)
      personData.photoUrl = sanitizedData.photoUrl;

    debugLog("Updating in DB with:", personData);
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

    await logAudit(req.userId, "update", "person", personId, null, req);

    const decryptedPerson = {
      ...person,
      phone: decryptPII(person.phone),
      email: decryptPII(person.email),
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

    // The client needs `kind` and `groupId` to collapse a group into one action,
    // and NAMES to say what undoing would do. This used to return counts only —
    // so the group collapse and the preview both read fields that were never
    // sent, and silently produced nothing. Names only; the full rows stay on the
    // server.
    const rows = await db
      .select({
        id: deletions.id,
        label: deletions.label,
        kind: deletions.kind,
        groupId: deletions.groupId,
        deletedAt: deletions.deletedAt,
        restoredAt: deletions.restoredAt,
        peopleCount: sql`jsonb_array_length(${deletions.people})`,
        relationshipsCount: sql`jsonb_array_length(${deletions.relationships})`,
        peopleNames: sql`(
          select coalesce(json_agg(x->>'firstName'), '[]'::json)
          from jsonb_array_elements(${deletions.people}) x
        )`,
        peopleAfterNames: sql`(
          select coalesce(json_agg(x->>'firstName'), '[]'::json)
          from jsonb_array_elements(${deletions.peopleAfter}) x
        )`,
        peopleIds: sql`(
          select coalesce(json_agg(x->>'id'), '[]'::json)
          from jsonb_array_elements(${deletions.people}) x
        )`,
        peopleAfterIds: sql`(
          select coalesce(json_agg(x->>'id'), '[]'::json)
          from jsonb_array_elements(${deletions.peopleAfter}) x
        )`,
        relationshipsAfterCount: sql`jsonb_array_length(${deletions.relationshipsAfter})`,
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

    // The whole undo, or none of it. This removes rows, re-inserts rows, and marks
    // the snapshot restored — three steps that must agree. A failure between the
    // removes and the inserts loses a person permanently; a failure before the
    // final update leaves the snapshot un-restored, so the same undo could run
    // twice and re-insert rows that already exist.
    let peopleRestored = [];
    let relRestored = [];

    await db.transaction(async (tx) => {
      if (relIdsToRemove.length > 0) {
        await tx
          .delete(relationships)
          .where(inArray(relationships.id, relIdsToRemove));
      }
      if (peopleIdsToRemove.length > 0) {
        await tx.delete(people).where(inArray(people.id, peopleIdsToRemove));
      }

      // Upsert, not insert-or-skip: for an update the row still exists, and
      // onConflictDoNothing would silently leave the new values in place. Done one
      // row at a time so each row's own values are used in the DO UPDATE clause.
      for (const row of peopleRows) {
        const { id, ...rest } = row;
        const [out] = await tx
          .insert(people)
          .values(row)
          .onConflictDoUpdate({ target: people.id, set: rest })
          .returning({ id: people.id });
        if (out) peopleRestored.push(out);
      }

      for (const row of relRows) {
        const { id, ...rest } = row;
        const [out] = await tx
          .insert(relationships)
          .values(row)
          .onConflictDoUpdate({ target: relationships.id, set: rest })
          .returning({ id: relationships.id });
        if (out) relRestored.push(out);
      }

      // Keep the serial sequences ahead of any id we just re-inserted.
      await tx.execute(
        sql`SELECT setval(pg_get_serial_sequence('people','id'), GREATEST(COALESCE((SELECT MAX(id) FROM people), 1), 1))`,
      );
      await tx.execute(
        sql`SELECT setval(pg_get_serial_sequence('relationships','id'), GREATEST(COALESCE((SELECT MAX(id) FROM relationships), 1), 1))`,
      );

      await tx
        .update(deletions)
        .set({ restoredAt: new Date() })
        .where(inArray(deletions.id, groupIds));
    });

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

    // Snapshot and deletion together, or neither. The snapshot is what undo reads
    // from: a snapshot written without the delete leaves a phantom undo entry, and
    // a delete without the snapshot is unrecoverable. Separately they could differ.
    const snapshot = await db.transaction(async (tx) => {
      const [snap] = await tx
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
        await tx
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
        await tx
          .delete(people)
          .where(and(eq(people.treeId, treeId), inArray(people.id, foundIds)));
      }

      return snap;
    });

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


      // NULL is "married". Writing the literal 'married' created a THIRD state
      // meaning the same thing — new rows get NULL, and only un-ticking divorce
      // produced 'married'. Nothing broke, because every reader asks
      // `<> 'divorced'`, but anyone writing `IS NULL` to mean married would
      // silently miss every marriage that had once been divorced.
      const normalizedStatus = status === "divorced" ? "divorced" : null;

      const [updated] = await db
        .update(relationships)
        .set({ status: normalizedStatus })
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

// REMOVED: GET /api/history/:treeId
//
// The only reader edit_history ever had, and no client code called it —
// api.history.get was defined in api.js and never invoked. Removed together with
// the writes: an endpoint returning 100 rows of full person snapshots, reachable
// by anyone with a session and a tree id, earned nothing.

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
// strict newest-first, grouped by user action. GET /api/history/:treeId has since
// been removed too, along with every write to edit_history — see recordEdit.


// REMOVED: GET /api/export/:treeId
//
// Four formats — csv, html, text, gedcom — built before the move off Replit and
// never wired into the UI. ExportDialog.jsx was its only caller and was deleted.
//
// Removing it also removes the app's only HTML sink: the html format interpolated
// tree and person names straight into a document, and the filename into a
// Content-Disposition header. That is what made the input-time HTML escaping
// load-bearing. With it gone, escaping on write protects nothing — React encodes
// at render, which is where encoding belongs.
//
// If export ever returns, encode at OUTPUT for each format, do not reinstate
// escaping on write: CSV needs formula-injection handling (a leading = + - @),
// HTML needs entity encoding, and the filename header needs its own sanitising.


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
// Liveness. Says only that the process is running and answering.
//
// Point RENDER's own health check here and nowhere else. If Render's check ever
// depends on the database, a few seconds of Neon being unreachable becomes Render
// killing the service or failing a deploy — an outage manufactured out of a blip.
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness. Says the app can actually serve a request.
//
// Point the EXTERNAL uptime monitor here. /health alone would not have caught the
// outage this app has already had: `users.token_version` was missing from the
// production database for days, so every read of `users` asked for a column that
// was not there and returned 500. Login was dead. The process was fine, Neon was
// fine, and a liveness check would have reported healthy the whole time.
//
// `select()` with no argument asks for EVERY column in shared/schema.js, which is
// exactly how Drizzle builds the query that failed. So this does not merely prove
// the database is reachable — it proves the schema still matches the code. That
// entire class of failure surfaces here now, automatically, instead of when
// somebody happens to try signing in.
//
// Cached, because this is public and unauthenticated: without it, anyone could
// turn a monitoring endpoint into one database query per request.
let readinessCache = { at: 0, ok: false, detail: null };
const READINESS_TTL_MS = 30_000;

app.get("/health/ready", async (req, res) => {
  const now = Date.now();
  if (now - readinessCache.at < READINESS_TTL_MS) {
    return res
      .status(readinessCache.ok ? 200 : 503)
      .json({ status: readinessCache.ok ? "ready" : "degraded", cached: true });
  }

  try {
    await db.select().from(users).limit(1);
    readinessCache = { at: now, ok: true, detail: null };
    res.status(200).json({ status: "ready", cached: false });
  } catch (error) {
    // The reason goes to the log, never to the response: the useful failures name
    // a missing column, which tells an anonymous caller about the schema.
    console.error("[Readiness] Database check failed:", error.message);
    readinessCache = { at: now, ok: false, detail: error.message };
    res.status(503).json({ status: "degraded", cached: false });
  }
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
