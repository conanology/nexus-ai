/**
 * Pronunciation command - manage pronunciation dictionary
 *
 * @module @nexus-ai/operator-cli/commands/pronunciation
 */

import type { Command } from 'commander';
import { createLogger } from '@nexus-ai/core';
import { PronunciationClient, type PronunciationEntry } from '@nexus-ai/pronunciation';
import {
  formatTable,
  formatJson,
  formatError,
  formatSuccess,
  formatInfo,
} from '../utils/output.js';

const logger = createLogger('nexus.operator-cli.pronunciation');

export function registerPronunciationCommand(program: Command): void {
  const pronunciation = program
    .command('pronunciation')
    .alias('pron')
    .description('Manage pronunciation dictionary');

  // List subcommand
  pronunciation
    .command('list')
    .description('List dictionary entries')
    .option('-u, --unverified', 'Show only unverified terms', false)
    .option('-l, --limit <n>', 'Limit results', '20')
    .action(async (options: { unverified?: boolean; limit?: string }) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;
      const limit = parseInt(options.limit ?? '20', 10);

      logger.info({ unverified: options.unverified, limit }, 'Listing pronunciation entries');

      try {
        const client = new PronunciationClient();
        let entries: PronunciationEntry[];

        if (options.unverified) {
          entries = await client.getUnverifiedTerms(limit);
        } else {
          entries = await client.getAllTerms(limit);
        }

        if (jsonMode) {
          console.log(formatJson({ entries, count: entries.length }));
          return;
        }

        if (entries.length === 0) {
          console.log(formatInfo('No pronunciation entries found'));
          return;
        }

        console.log(`\nPronunciation Dictionary (${entries.length} entries)`);
        console.log('─'.repeat(70));

        const rows = entries.map((e) => [
          e.term,
          e.ipa ?? '-',
          e.verified ? '✓' : '',
          e.source ?? 'manual',
        ]);

        console.log(formatTable(['Term', 'IPA', 'Verified', 'Source'], rows));

        if (entries.length === limit) {
          console.log(`\n  Showing first ${limit} entries. Use --limit to see more.`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Pronunciation list failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to list entries: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Add subcommand
  pronunciation
    .command('add <term> <ipa> <ssml>')
    .description('Add a term to the dictionary')
    .action(async (term: string, ipa: string, ssml: string) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ term, ipa }, 'Adding pronunciation entry');

      try {
        const client = new PronunciationClient();
        await client.addTerm({
          term,
          ipa,
          ssml,
          verified: false,
          source: 'manual',
        });

        if (jsonMode) {
          console.log(formatJson({ success: true, term, ipa, ssml }));
        } else {
          console.log(formatSuccess(`Added pronunciation for "${term}"`));
          console.log(`  IPA: ${ipa}`);
          console.log(`  SSML: ${ssml}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Pronunciation add failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to add entry: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Search subcommand
  pronunciation
    .command('search <query>')
    .description('Search dictionary by term prefix')
    .action(async (query: string) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ query }, 'Searching pronunciation dictionary');

      try {
        const client = new PronunciationClient();
        const entries = await client.searchTerms(query);

        if (jsonMode) {
          console.log(formatJson({ query, entries, count: entries.length }));
          return;
        }

        if (entries.length === 0) {
          console.log(formatInfo(`No entries found matching "${query}"`));
          return;
        }

        console.log(`\nSearch Results for "${query}" (${entries.length} matches)`);
        console.log('─'.repeat(60));

        const rows = entries.map((e: PronunciationEntry) => [
          e.term,
          e.ipa ?? '-',
          e.verified ? '✓' : '',
        ]);

        console.log(formatTable(['Term', 'IPA', 'Verified'], rows));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Pronunciation search failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to search: ${errorMessage}`));
        }
        process.exit(1);
      }
    });

  // Verify subcommand
  pronunciation
    .command('verify <term>')
    .description('Mark a term as human-verified')
    .action(async (term: string) => {
      const parentOpts = program.opts() as { json?: boolean };
      const jsonMode = parentOpts.json ?? false;

      logger.info({ term }, 'Verifying pronunciation entry');

      try {
        const client = new PronunciationClient();

        // Get the entry first
        const entry = await client.getTerm(term);
        if (!entry) {
          if (jsonMode) {
            console.log(formatJson({ success: false, error: 'Term not found' }));
          } else {
            console.error(formatError(`Term "${term}" not found in dictionary`));
          }
          process.exit(1);
        }

        // Update to verified
        await client.updateTerm(term, { verified: true });

        if (jsonMode) {
          console.log(formatJson({ success: true, term, verified: true }));
        } else {
          console.log(formatSuccess(`Marked "${term}" as verified`));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Pronunciation verify failed');

        if (jsonMode) {
          console.log(formatJson({ success: false, error: errorMessage }));
        } else {
          console.error(formatError(`Failed to verify: ${errorMessage}`));
        }
        process.exit(1);
      }
    });
}
