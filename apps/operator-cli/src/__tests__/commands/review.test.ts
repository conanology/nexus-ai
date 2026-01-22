/**
 * Review command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/review
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerReviewCommand } from '../../commands/review.js';

// Mock @nexus-ai/core
const mockGetReviewQueue = vi.fn();
const mockGetReviewItem = vi.fn();
const mockResolveReviewItem = vi.fn();
const mockDismissReviewItem = vi.fn();
const mockSkipTopic = vi.fn();
const mockRequeueTopicFromReview = vi.fn();

vi.mock('@nexus-ai/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  getReviewQueue: (...args: unknown[]) => mockGetReviewQueue(...args),
  getReviewItem: (...args: unknown[]) => mockGetReviewItem(...args),
  resolveReviewItem: (...args: unknown[]) => mockResolveReviewItem(...args),
  dismissReviewItem: (...args: unknown[]) => mockDismissReviewItem(...args),
  skipTopic: (...args: unknown[]) => mockSkipTopic(...args),
  requeueTopicFromReview: (...args: unknown[]) => mockRequeueTopicFromReview(...args),
}));

describe('Review Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerReviewCommand(program);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never) as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('should register review command with subcommands', () => {
    const reviewCmd = program.commands.find((cmd) => cmd.name() === 'review');
    expect(reviewCmd).toBeDefined();

    const subcommands = reviewCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('show');
    expect(subcommands).toContain('resolve');
    expect(subcommands).toContain('dismiss');
    expect(subcommands).toContain('skip');
    expect(subcommands).toContain('requeue');
  });

  describe('review list', () => {
    it('should list pending review items', async () => {
      mockGetReviewQueue.mockResolvedValueOnce([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'pronunciation',
          stage: 'pronunciation',
          pipelineId: '2026-01-22',
          createdAt: new Date().toISOString(),
          status: 'pending',
        },
      ]);

      await program.parseAsync(['node', 'test', 'review', 'list']);

      expect(mockGetReviewQueue).toHaveBeenCalledWith({ status: 'pending' });
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should filter by type with --type option', async () => {
      mockGetReviewQueue.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', 'review', 'list', '--type', 'pronunciation']);

      expect(mockGetReviewQueue).toHaveBeenCalledWith({ status: 'pending', type: 'pronunciation' });
    });

    it('should handle empty queue', async () => {
      mockGetReviewQueue.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', 'review', 'list']);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should output JSON when --json flag is set', async () => {
      mockGetReviewQueue.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', '--json', 'review', 'list']);

      const jsonOutput = consoleLogSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"items"')
      );
      expect(jsonOutput).toBeDefined();
    });
  });

  describe('review show', () => {
    it('should show review item details', async () => {
      mockGetReviewItem.mockResolvedValueOnce({
        id: '550e8400',
        type: 'pronunciation',
        stage: 'pronunciation',
        pipelineId: '2026-01-22',
        status: 'pending',
        createdAt: new Date().toISOString(),
        item: { unknownTerms: ['GPT-4o'] },
        context: {},
      });

      await program.parseAsync(['node', 'test', 'review', 'show', '550e8400']);

      expect(mockGetReviewItem).toHaveBeenCalledWith('550e8400');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle item not found', async () => {
      mockGetReviewItem.mockResolvedValueOnce(null);

      await program.parseAsync(['node', 'test', 'review', 'show', 'nonexistent']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('review resolve', () => {
    it('should resolve a review item', async () => {
      mockGetReviewItem.mockResolvedValueOnce({ id: '550e8400', status: 'pending' });
      mockResolveReviewItem.mockResolvedValueOnce(undefined);

      await program.parseAsync(['node', 'test', 'review', 'resolve', '550e8400']);

      expect(mockResolveReviewItem).toHaveBeenCalledWith('550e8400', 'Resolved via CLI', 'cli');
    });

    it('should include note when provided', async () => {
      mockGetReviewItem.mockResolvedValueOnce({ id: '550e8400', status: 'pending' });
      mockResolveReviewItem.mockResolvedValueOnce(undefined);

      await program.parseAsync(['node', 'test', 'review', 'resolve', '550e8400', '-n', 'Added pronunciations']);

      expect(mockResolveReviewItem).toHaveBeenCalledWith('550e8400', 'Added pronunciations', 'cli');
    });
  });

  describe('review dismiss', () => {
    it('should dismiss a review item with reason', async () => {
      mockGetReviewItem.mockResolvedValueOnce({ id: '550e8400', status: 'pending' });
      mockDismissReviewItem.mockResolvedValueOnce(undefined);

      await program.parseAsync(['node', 'test', 'review', 'dismiss', '550e8400', '-r', 'False positive']);

      expect(mockDismissReviewItem).toHaveBeenCalledWith('550e8400', 'False positive', 'cli');
    });
  });

  describe('review skip', () => {
    it('should skip a controversial topic', async () => {
      mockGetReviewItem.mockResolvedValueOnce({
        id: '550e8400',
        type: 'controversial',
        pipelineId: '2026-01-22',
        status: 'pending',
      });
      mockSkipTopic.mockResolvedValueOnce(undefined);

      await program.parseAsync(['node', 'test', 'review', 'skip', '550e8400']);

      expect(mockSkipTopic).toHaveBeenCalledWith('550e8400', 'cli');
    });

    it('should reject skip for non-topic items', async () => {
      mockGetReviewItem.mockResolvedValueOnce({
        id: '550e8400',
        type: 'pronunciation',
        status: 'pending',
      });

      await program.parseAsync(['node', 'test', 'review', 'skip', '550e8400']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('review requeue', () => {
    it('should requeue a topic for tomorrow', async () => {
      mockGetReviewItem.mockResolvedValueOnce({
        id: '550e8400',
        type: 'controversial',
        status: 'pending',
      });
      mockRequeueTopicFromReview.mockResolvedValueOnce(undefined);

      await program.parseAsync(['node', 'test', 'review', 'requeue', '550e8400']);

      expect(mockRequeueTopicFromReview).toHaveBeenCalledWith(
        '550e8400',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        'cli'
      );
    });
  });
});
