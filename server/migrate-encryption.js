import CryptoJS from 'crypto-js';
import crypto from 'crypto';
import { db } from './db.js';
import { people, users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;

if (!ENCRYPTION_KEY) {
  console.error('CRITICAL: ENCRYPTION_KEY or JWT_SECRET environment variable is required');
  process.exit(1);
}

const deriveEncryptionKey = (keyString) => {
  return crypto.createHash('sha256').update(keyString).digest();
};

const DERIVED_KEY = deriveEncryptionKey(ENCRYPTION_KEY);

const encryptPIIv2 = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
};

const decryptLegacy = (encrypted) => {
  if (!encrypted) return null;
  if (encrypted.startsWith('v2:')) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch {
    return null;
  }
};

const isLegacyFormat = (encrypted) => {
  if (!encrypted) return false;
  if (encrypted.startsWith('v2:')) return false;
  return true;
};

async function migrateEncryption() {
  console.log('Starting encryption migration...');
  console.log('This will re-encrypt legacy CryptoJS data to the new AES-256-GCM format.');
  
  let migratedPeopleCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    const allPeople = await db.select().from(people);
    console.log(`Found ${allPeople.length} people records to check.`);

    for (const person of allPeople) {
      const updates = {};
      let needsUpdate = false;

      const fieldsToMigrate = ['phone', 'email', 'identificationNumber'];
      
      for (const field of fieldsToMigrate) {
        const value = person[field];
        if (value && isLegacyFormat(value)) {
          const decrypted = decryptLegacy(value);
          if (decrypted) {
            updates[field] = encryptPIIv2(decrypted);
            needsUpdate = true;
          } else {
            console.warn(`  Warning: Could not decrypt ${field} for person ${person.id}`);
            errorCount++;
          }
        }
      }

      if (needsUpdate) {
        try {
          await db.update(people).set(updates).where(eq(people.id, person.id));
          migratedPeopleCount++;
          if (migratedPeopleCount % 100 === 0) {
            console.log(`  Migrated ${migratedPeopleCount} records...`);
          }
        } catch (updateError) {
          console.error(`  Error updating person ${person.id}:`, updateError.message);
          errorCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Records migrated: ${migratedPeopleCount}`);
    console.log(`Records skipped (already v2 or no encrypted data): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\nSome records could not be migrated. Please review the warnings above.');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateEncryption();
