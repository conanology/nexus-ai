import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMemoryClient } from '../memory-client.js';
import type { VideoMemoryEntry, MemoryClient } from '../types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDbPath(): string {
  const dir = path.join(os.tmpdir(), `nexus-memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return path.join(dir, 'test.db');
}

function makeEntry(overrides: Partial<Omit<VideoMemoryEntry, 'id'>> = {}): Omit<VideoMemoryEntry, 'id'> {
  return {
    topic: 'Kubernetes autoscaling',
    title: 'How Kubernetes Autoscaling Actually Works',
    slug: 'kubernetes-autoscaling',
    publishedAt: new Date().toISOString(),
    claims: ['HPA scales on CPU', 'VPA adjusts limits', 'Karpenter replaces Cluster Autoscaler'],
    stance: 'balanced',
    topicTags: ['kubernetes', 'autoscaling', 'devops', 'cloud'],
    source: 'hacker-news',
    wordCount: 1500,
    sceneCount: 45,
    durationSec: 300,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryClient', () => {
  let dbPath: string;
  let client: MemoryClient;

  beforeEach(() => {
    dbPath = makeTmpDbPath();
    client = createMemoryClient(dbPath);
  });

  afterEach(async () => {
    await client.close();
    // Cleanup temp files
    try {
      const dir = path.dirname(dbPath);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('save() and query() round-trip', () => {
    it('saves an entry and retrieves it by topic', async () => {
      const entry = makeEntry();
      await client.save(entry);

      const results = await client.query('Kubernetes autoscaling');
      expect(results).toHaveLength(1);
      expect(results[0].topic).toBe('Kubernetes autoscaling');
      expect(results[0].title).toBe('How Kubernetes Autoscaling Actually Works');
      expect(results[0].claims).toEqual(entry.claims);
      expect(results[0].topicTags).toEqual(entry.topicTags);
      expect(results[0].id).toBeDefined();
    });

    it('saves multiple entries and retrieves them', async () => {
      await client.save(makeEntry({ topic: 'React Server Components', topicTags: ['react', 'rsc', 'nextjs'] }));
      await client.save(makeEntry({ topic: 'Docker Compose v2', topicTags: ['docker', 'compose', 'containers'] }));
      await client.save(makeEntry({ topic: 'Vue 4 Release', topicTags: ['vue', 'javascript', 'frontend'] }));

      const results = await client.query('React components', 10);
      expect(results.length).toBeGreaterThanOrEqual(1);
      // React entry should rank highest
      expect(results[0].topic).toBe('React Server Components');
    });
  });

  describe('TF-IDF similarity ranking', () => {
    it('ranks exact topic match higher than partial match', async () => {
      await client.save(makeEntry({
        topic: 'WebAssembly WASM performance',
        title: 'WASM Performance Deep Dive',
        topicTags: ['wasm', 'webassembly', 'performance'],
      }));
      await client.save(makeEntry({
        topic: 'JavaScript performance optimization',
        title: 'JS Performance Tips',
        topicTags: ['javascript', 'performance', 'optimization'],
      }));

      const results = await client.query('WebAssembly WASM performance');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // WASM entry should rank first since it's a closer match
      expect(results[0].topic).toContain('WebAssembly');
    });
  });

  describe('query() edge cases', () => {
    it('returns empty array on empty store', async () => {
      const results = await client.query('anything');
      expect(results).toEqual([]);
    });

    it('respects limit parameter', async () => {
      // Save 8 entries
      for (let i = 0; i < 8; i++) {
        await client.save(makeEntry({
          topic: `Topic ${i} about kubernetes`,
          topicTags: ['kubernetes', `tag-${i}`],
        }));
      }

      const results = await client.query('kubernetes', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('defaults to max 5 entries', async () => {
      for (let i = 0; i < 8; i++) {
        await client.save(makeEntry({
          topic: `Topic ${i} about kubernetes`,
          topicTags: ['kubernetes', `tag-${i}`],
        }));
      }

      const results = await client.query('kubernetes');
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('no-op fallback on error', () => {
    it('returns no-op client when DB path is invalid', async () => {
      // Close the default client
      await client.close();

      // Create client with an invalid path (null bytes cause OS errors)
      const badClient = createMemoryClient('/\0invalid\0path/db.sqlite');
      const results = await badClient.query('test');
      expect(results).toEqual([]);

      await badClient.save(makeEntry()); // Should not throw
      await badClient.close();
    });

    it('save() is silent no-op when DB fails', async () => {
      await client.close();
      const badClient = createMemoryClient('/\0invalid/db.sqlite');

      // Should not throw
      await expect(badClient.save(makeEntry())).resolves.toBeUndefined();
      await badClient.close();
    });
  });

  describe('close()', () => {
    it('releases DB connection', async () => {
      await client.save(makeEntry());
      await client.close();

      // After close, query should return empty (new client created internally)
      // Re-opening with same path should work
      const client2 = createMemoryClient(dbPath);
      const results = await client2.query('kubernetes');
      expect(results.length).toBeGreaterThanOrEqual(1); // Data persisted to disk
      await client2.close();
    });
  });

  describe('concurrent operations', () => {
    it('handles concurrent save calls without errors', async () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        makeEntry({
          topic: `Concurrent topic ${i}`,
          slug: `concurrent-${i}`,
          topicTags: ['concurrent', `tag-${i}`],
        }),
      );

      // Fire all saves concurrently
      await Promise.all(entries.map((e) => client.save(e)));

      const results = await client.query('concurrent', 10);
      expect(results.length).toBe(5);
    });
  });
});
