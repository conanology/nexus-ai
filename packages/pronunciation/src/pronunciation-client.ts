/**
 * Pronunciation dictionary client for NEXUS-AI TTS
 *
 * Provides access to pronunciation dictionary stored in Firestore with
 * in-memory caching for fast lookups during script processing.
 *
 * @module @nexus-ai/pronunciation
 */

import { FirestoreClient } from '@nexus-ai/core/storage';
import { NexusError } from '@nexus-ai/core/errors';
import { logger, CostTracker } from '@nexus-ai/core/observability';
import { withRetry } from '@nexus-ai/core/utils';
import type { PronunciationEntry, AddTermInput } from './types.js';

/**
 * Pronunciation dictionary client with Firestore persistence and in-memory caching
 */
export class PronunciationClient {
  private readonly firestore: FirestoreClient;
  private readonly collectionName = 'pronunciation';
  private cache: Map<string, PronunciationEntry> | null = null;
  private readonly log = logger.child({ component: 'nexus.pronunciation.client' });

  /**
   * Create a new PronunciationClient
   *
   * @param projectId - Optional GCP project ID
   */
  constructor(projectId?: string) {
    this.firestore = new FirestoreClient(projectId);
  }

  /**
   * Load all dictionary entries into memory cache
   *
   * @param tracker - Optional CostTracker to record query costs
   * @returns Map of term (lowercase) to PronunciationEntry
   */
  async getDictionary(tracker?: CostTracker): Promise<Map<string, PronunciationEntry>> {
    if (this.cache) {
      return this.cache;
    }

    this.log.info('Loading pronunciation dictionary from Firestore');

    try {
      // Query all documents with retry
      const { result: entries } = await withRetry(
        () => this.firestore.queryDocuments<PronunciationEntry>(this.collectionName, []),
        { stage: 'pronunciation' }
      );

      // Record cost (Firestore read: 1 unit per document)
      if (tracker) {
        tracker.recordApiCall('firestore-read', { input: entries.length }, 0);
      }

      this.cache = new Map<string, PronunciationEntry>();
      for (const entry of entries) {
        this.cache.set(entry.term.toLowerCase(), entry);
      }

      this.log.info({ entryCount: this.cache.size }, 'Pronunciation dictionary loaded');
      return this.cache;
    } catch (error) {
      this.log.error({ error }, 'Failed to load pronunciation dictionary');
      throw error instanceof NexusError ? error : NexusError.fromError(error, 'pronunciation');
    }
  }

  /**
   * Look up a term in the pronunciation dictionary
   */
  async lookupTerm(term: string, tracker?: CostTracker): Promise<PronunciationEntry | null> {
    await this.getDictionary(tracker);

    const normalizedTerm = term.toLowerCase();
    const entry = this.cache!.get(normalizedTerm);

    if (entry) {
      // Update usage tracking asynchronously
      this.updateUsageTracking(normalizedTerm, tracker).catch((error) => {
        this.log.warn({ term: normalizedTerm, error }, 'Failed to update usage tracking');
      });
    }

    return entry || null;
  }

  /**
   * Add a new term to the pronunciation dictionary
   */
  async addTerm(input: AddTermInput, tracker?: CostTracker): Promise<void> {
    const normalizedTerm = input.term.toLowerCase();
    const ssml = input.ssml || this.generateSSML(input.term, input.ipa);

    const entry: PronunciationEntry = {
      term: normalizedTerm,
      ipa: input.ipa,
      ssml,
      verified: input.verified ?? false,
      source: input.source ?? 'manual',
      usageCount: 0,
      lastUsed: null,
      addedDate: new Date().toISOString(),
    };

    try {
      await withRetry(
        () => this.firestore.setDocument(this.collectionName, normalizedTerm, entry),
        { stage: 'pronunciation' }
      );

      if (tracker) {
        tracker.recordApiCall('firestore-write', { output: 1 }, 0);
      }

      if (this.cache) {
        this.cache.set(normalizedTerm, entry);
      }

      this.log.info({ term: normalizedTerm }, 'Term added successfully');
    } catch (error) {
      throw NexusError.critical(
        'NEXUS_PRONUNCIATION_WRITE_ERROR',
        `Failed to add pronunciation for term: ${input.term}`,
        'pronunciation',
        { term: input.term, error }
      );
    }
  }

  /**
   * Generate SSML phoneme tag with XML escaping
   */
  private generateSSML(term: string, ipa: string): string {
    const escape = (text: string) =>
      text.replace(/[<>&"']/g, (m) => {
        const map: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '&': '&amp;',
          '"': '&quot;',
          "'": '&apos;',
        };
        return map[m] || m;
      });

    return `<phoneme alphabet="ipa" ph="${escape(ipa)}">${escape(term)}</phoneme>`;
  }

  /**
   * Update usage tracking for a term
   */
  private async updateUsageTracking(normalizedTerm: string, tracker?: CostTracker): Promise<void> {
    try {
      const entry = this.cache?.get(normalizedTerm);
      const newCount = (entry?.usageCount ?? 0) + 1;
      const now = new Date().toISOString();

      await withRetry(
        () =>
          this.firestore.updateDocument<PronunciationEntry>(this.collectionName, normalizedTerm, {
            usageCount: newCount,
            lastUsed: now,
          }),
        { stage: 'pronunciation' }
      );

      if (tracker) {
        tracker.recordApiCall('firestore-write', { output: 1 }, 0);
      }

      if (entry) {
        entry.usageCount = newCount;
        entry.lastUsed = now;
      }
    } catch (error) {
      this.log.debug({ term: normalizedTerm, error }, 'Failed to update usage tracking');
    }
  }

  async getAllTerms(tracker?: CostTracker): Promise<PronunciationEntry[]> {
    const dictionary = await this.getDictionary(tracker);
    return Array.from(dictionary.values());
  }

  clearCache(): void {
    this.cache = null;
  }
}

