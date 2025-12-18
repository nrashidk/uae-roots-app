import { db } from './db.js';
import { people } from '../shared/schema.js';
import { eq, like } from 'drizzle-orm';

async function migratePhotoUrls() {
  console.log('Starting photo URL migration...');
  console.log('This will update /uploads/ URLs to /api/photos/ URLs in the database.');
  
  let migratedCount = 0;
  let errorCount = 0;

  try {
    const allPeople = await db.select().from(people);
    console.log(`Found ${allPeople.length} people records to check.`);

    for (const person of allPeople) {
      if (person.photoUrl && person.photoUrl.startsWith('/uploads/')) {
        const newUrl = person.photoUrl.replace('/uploads/', '/api/photos/');
        
        try {
          await db.update(people)
            .set({ photoUrl: newUrl })
            .where(eq(people.id, person.id));
          
          migratedCount++;
          console.log(`  Updated: ${person.photoUrl} -> ${newUrl}`);
        } catch (updateError) {
          console.error(`  Error updating person ${person.id}:`, updateError.message);
          errorCount++;
        }
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Photo URLs migrated: ${migratedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migratePhotoUrls();
