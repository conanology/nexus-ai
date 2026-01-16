/**
 * Seed pronunciation dictionary with initial technical AI terms
 *
 * Usage: tsx scripts/seed-pronunciation.ts [--force]
 *
 * Options:
 *   --force  Overwrite existing terms (default: skip existing)
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PronunciationClient } from '../packages/pronunciation/src/index.js';
import type { PronunciationEntry } from '../packages/pronunciation/src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SeedEntry {
  term: string;
  ipa: string;
  verified: boolean;
  source: 'seed' | 'auto' | 'manual';
}

/**
 * Generate SSML phoneme tag for a seed entry
 */
function generateSSML(term: string, ipa: string): string {
  return `<phoneme alphabet="ipa" ph="${ipa}">${term}</phoneme>`;
}

/**
 * Load seed data from JSON file
 */
async function loadSeedData(): Promise<SeedEntry[]> {
  const seedPath = join(__dirname, '../packages/pronunciation/data/seed.json');
  const content = await readFile(seedPath, 'utf-8');
  return JSON.parse(content) as SeedEntry[];
}

/**
 * Seed the pronunciation dictionary
 */
async function seedDictionary(force: boolean = false): Promise<void> {
  console.log('🌱 Seeding pronunciation dictionary...\n');

  const client = new PronunciationClient();
  const seedData = await loadSeedData();

  console.log(`📖 Loaded ${seedData.length} terms from seed data\n`);

  // Load existing dictionary to check for conflicts
  const existingDictionary = await client.getDictionary();
  console.log(`📚 Found ${existingDictionary.size} existing entries in Firestore\n`);

  let added = 0;
  let skipped = 0;
  let updated = 0;

  for (const entry of seedData) {
    const normalizedTerm = entry.term.toLowerCase();
    const exists = existingDictionary.has(normalizedTerm);

    if (exists && !force) {
      console.log(`⏭️  Skipping "${entry.term}" (already exists)`);
      skipped++;
      continue;
    }

    try {
      await client.addTerm({
        term: normalizedTerm,
        ipa: entry.ipa,
        ssml: generateSSML(entry.term, entry.ipa),
        source: entry.source,
        verified: entry.verified,
      });

      if (exists) {
        console.log(`🔄 Updated "${entry.term}"`);
        updated++;
      } else {
        console.log(`✅ Added "${entry.term}"`);
        added++;
      }
    } catch (error) {
      console.error(`❌ Failed to add "${entry.term}":`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Seeding complete!');
  console.log('='.repeat(60));
  console.log(`✅ Added: ${added} terms`);
  if (updated > 0) {
    console.log(`🔄 Updated: ${updated} terms`);
  }
  if (skipped > 0) {
    console.log(`⏭️  Skipped: ${skipped} terms (already exist)`);
  }
  console.log(`📊 Total in dictionary: ${added + skipped + updated} terms`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');

  if (force) {
    console.log('⚠️  Force mode enabled - will overwrite existing terms\n');
  }

  try {
    await seedDictionary(force);
    process.exit(0);
  } catch (error) {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  }
}

main();
