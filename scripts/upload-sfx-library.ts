/**
 * Upload SFX library fixtures to Google Cloud Storage
 *
 * Usage: npx tsx scripts/upload-sfx-library.ts
 *
 * Reads library.json and all SFX files from the local fixtures directory
 * and uploads them to gs://nexus-ai-assets/sfx/
 *
 * Requires GCP authentication (GOOGLE_APPLICATION_CREDENTIALS or default credentials).
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage } from '@google-cloud/storage';
import type { SfxTrack, SfxLibrary } from '@nexus-ai/audio-mixer';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUCKET_NAME = 'nexus-ai-assets';
const GCS_PREFIX = 'sfx';
const FIXTURES_DIR = join(
  __dirname,
  '../packages/audio-mixer/src/__fixtures__/sfx-library'
);

async function loadLibrary(): Promise<SfxLibrary> {
  const libraryPath = join(FIXTURES_DIR, 'library.json');
  const content = await readFile(libraryPath, 'utf-8');
  return JSON.parse(content) as SfxLibrary;
}

function getLocalPath(track: SfxTrack): string {
  return join(FIXTURES_DIR, track.category, track.filename);
}

function getGcsDestination(track: SfxTrack): string {
  return `${GCS_PREFIX}/${track.category}/${track.filename}`;
}

async function main(): Promise<void> {
  console.log('🔊 SFX Library Upload Tool\n');

  const storage = new Storage();
  const bucket = storage.bucket(BUCKET_NAME);

  // Load library index
  let library: SfxLibrary;
  try {
    library = await loadLibrary();
  } catch (error) {
    console.error(
      '❌ Failed to load library.json:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  console.log(`📖 Loaded ${library.tracks.length} tracks from library.json\n`);

  let uploaded = 0;
  let failed = 0;

  // Upload each SFX file
  for (const track of library.tracks) {
    const localPath = getLocalPath(track);
    const destination = getGcsDestination(track);

    try {
      await bucket.upload(localPath, { destination });
      console.log(`✅ Uploaded: ${destination}`);
      uploaded++;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to upload ${track.id}: ${message}`);
      failed++;
    }
  }

  // Upload library.json itself
  const libraryDest = `${GCS_PREFIX}/library.json`;
  try {
    await bucket.upload(join(FIXTURES_DIR, 'library.json'), {
      destination: libraryDest,
    });
    console.log(`✅ Uploaded: ${libraryDest}`);
    uploaded++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to upload library.json: ${message}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Upload Summary');
  console.log('='.repeat(60));
  console.log(`✅ Uploaded: ${uploaded} files`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed} files`);
  }
  console.log(`🪣 Bucket: gs://${BUCKET_NAME}/${GCS_PREFIX}/`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main();
