/**
 * Channel Memory Client — SQLite-backed persistent store for cross-video lore.
 *
 * Uses sql.js (WASM SQLite) to persist video metadata and enable TF-IDF
 * similarity search across past videos. Gracefully degrades to a no-op
 * client on any initialization or runtime error.
 *
 * @module @nexus-ai/script-gen/memory-client
 */

import type { VideoMemoryEntry, MemoryClient } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_DB_PATH = 'local-storage/memory/channel-lore.db';

// ---------------------------------------------------------------------------
// TF-IDF Helpers
// ---------------------------------------------------------------------------

/** Tokenize a string into lowercase word stems */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Build TF (term frequency) map for a token list */
function buildTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  // Normalize by total token count
  const total = tokens.length || 1;
  for (const [k, v] of tf) {
    tf.set(k, v / total);
  }
  return tf;
}

/** Compute cosine similarity between two TF maps */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [key, val] of a) {
    normA += val * val;
    const bVal = b.get(key);
    if (bVal !== undefined) {
      dotProduct += val * bVal;
    }
  }
  for (const [, val] of b) {
    normB += val * val;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ---------------------------------------------------------------------------
// No-Op Client
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a MemoryClient backed by SQLite (sql.js WASM).
 *
 * Never throws — returns a no-op client on any initialization error.
 *
 * @param dbPath - Path to the SQLite database file. Defaults to `local-storage/memory/channel-lore.db`.
 */
export function createMemoryClient(dbPath?: string): MemoryClient {
  const path = dbPath ?? DEFAULT_DB_PATH;

  let db: any = null;
  let initialized = false;
  let initPromise: Promise<void> | null = null;

  async function ensureInit(): Promise<boolean> {
    if (initialized) return db !== null;
    if (initPromise) {
      await initPromise;
      return db !== null;
    }

    initPromise = (async () => {
      try {
        const fs = await import('node:fs');
        const nodePath = await import('node:path');

        // Ensure directory exists
        const dir = nodePath.default.dirname(path);
        fs.mkdirSync(dir, { recursive: true });

        // Load sql.js
        const initSqlJs = (await import('sql.js')).default;
        const SQL = await initSqlJs();

        // Load existing DB or create new
        let fileBuffer: Buffer | null = null;
        try {
          fileBuffer = fs.readFileSync(path);
        } catch {
          // File doesn't exist yet — will create new DB
        }

        db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();

        // Create table if not exists
        db.run(`
          CREATE TABLE IF NOT EXISTS video_memory (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            title TEXT NOT NULL,
            slug TEXT NOT NULL,
            publishedAt TEXT NOT NULL,
            claims TEXT NOT NULL,
            stance TEXT NOT NULL,
            topicTags TEXT NOT NULL,
            source TEXT NOT NULL,
            wordCount INTEGER NOT NULL,
            sceneCount INTEGER NOT NULL,
            durationSec REAL NOT NULL
          )
        `);

        initialized = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`[Memory] Failed to initialize SQLite: ${msg}`);
        initialized = true; // Mark as initialized (failed) to avoid retries
        db = null;
      }
    })();

    await initPromise;
    return db !== null;
  }

  /** Persist DB to disk */
  function persist(): void {
    if (!db) return;
    try {
      const fs = require('node:fs');
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(path, buffer);
    } catch {
      // Silent — non-critical
    }
  }

  const client: MemoryClient = {
    async query(topic: string, limit = 5): Promise<VideoMemoryEntry[]> {
      try {
        const ready = await ensureInit();
        if (!ready) return [];

        // Get all entries
        const stmt = db.prepare('SELECT * FROM video_memory');
        const entries: VideoMemoryEntry[] = [];

        while (stmt.step()) {
          const row = stmt.getAsObject() as Record<string, unknown>;
          entries.push({
            id: row.id as string,
            topic: row.topic as string,
            title: row.title as string,
            slug: row.slug as string,
            publishedAt: row.publishedAt as string,
            claims: JSON.parse(row.claims as string),
            stance: row.stance as string,
            topicTags: JSON.parse(row.topicTags as string),
            source: row.source as string,
            wordCount: row.wordCount as number,
            sceneCount: row.sceneCount as number,
            durationSec: row.durationSec as number,
          });
        }
        stmt.free();

        if (entries.length === 0) return [];

        // TF-IDF similarity ranking
        const queryTokens = tokenize(topic);
        const queryTF = buildTF(queryTokens);

        const scored = entries.map((entry) => {
          const entryTokens = [
            ...tokenize(entry.topic),
            ...tokenize(entry.title),
            ...entry.topicTags,
          ];
          const entryTF = buildTF(entryTokens);
          const score = cosineSimilarity(queryTF, entryTF);
          return { entry, score };
        });

        // Sort by score descending, take top N
        scored.sort((a, b) => b.score - a.score);
        return scored
          .filter((s) => s.score > 0)
          .slice(0, limit)
          .map((s) => s.entry);
      } catch {
        return [];
      }
    },

    async save(entry: Omit<VideoMemoryEntry, 'id'>): Promise<void> {
      try {
        const ready = await ensureInit();
        if (!ready) return;

        const id = crypto.randomUUID();
        db.run(
          `INSERT OR REPLACE INTO video_memory
           (id, topic, title, slug, publishedAt, claims, stance, topicTags, source, wordCount, sceneCount, durationSec)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            entry.topic,
            entry.title,
            entry.slug,
            entry.publishedAt,
            JSON.stringify(entry.claims),
            entry.stance,
            JSON.stringify(entry.topicTags),
            entry.source,
            entry.wordCount,
            entry.sceneCount,
            entry.durationSec,
          ],
        );

        persist();
      } catch {
        // Silent no-op per contract
      }
    },

    async close(): Promise<void> {
      try {
        if (db) {
          persist();
          db.close();
          db = null;
        }
      } catch {
        // Silent cleanup
      }
      initialized = false;
      initPromise = null;
    },
  };

  return client;
}
