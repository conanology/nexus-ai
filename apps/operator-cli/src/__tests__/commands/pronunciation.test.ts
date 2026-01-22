/**
 * Pronunciation command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/pronunciation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerPronunciationCommand } from '../../commands/pronunciation.js';

// Mock @nexus-ai/pronunciation
const mockGetAllTerms = vi.fn();
const mockGetUnverifiedTerms = vi.fn();
const mockAddTerm = vi.fn();
const mockSearchTerms = vi.fn();
const mockGetTerm = vi.fn();
const mockUpdateTerm = vi.fn();

vi.mock('@nexus-ai/pronunciation', () => ({
  PronunciationClient: vi.fn().mockImplementation(() => ({
    getAllTerms: mockGetAllTerms,
    getUnverifiedTerms: mockGetUnverifiedTerms,
    addTerm: mockAddTerm,
    searchTerms: mockSearchTerms,
    getTerm: mockGetTerm,
    updateTerm: mockUpdateTerm,
  })),
}));

vi.mock('@nexus-ai/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('Pronunciation Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerPronunciationCommand(program);

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

  it('should register pronunciation command with subcommands', () => {
    const pronCmd = program.commands.find((cmd) => cmd.name() === 'pronunciation');
    expect(pronCmd).toBeDefined();

    const subcommands = pronCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('add');
    expect(subcommands).toContain('search');
    expect(subcommands).toContain('verify');
  });

  it('should have pron alias', () => {
    const pronCmd = program.commands.find((cmd) => cmd.name() === 'pronunciation');
    expect(pronCmd?.aliases()).toContain('pron');
  });

  describe('pronunciation list', () => {
    it('should list all terms', async () => {
      mockGetAllTerms.mockResolvedValueOnce([
        { term: 'GPT', ipa: '/dʒiː piː tiː/', verified: true, source: 'manual' },
        { term: 'LLaMA', ipa: '/ˈlɑːmə/', verified: false, source: 'auto' },
      ]);

      await program.parseAsync(['node', 'test', 'pronunciation', 'list']);

      expect(mockGetAllTerms).toHaveBeenCalledWith(20);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should list unverified terms with --unverified flag', async () => {
      mockGetUnverifiedTerms.mockResolvedValueOnce([
        { term: 'Mixtral', ipa: '/mɪkˈstrɑːl/', verified: false, source: 'auto' },
      ]);

      await program.parseAsync(['node', 'test', 'pronunciation', 'list', '--unverified']);

      expect(mockGetUnverifiedTerms).toHaveBeenCalledWith(20);
    });

    it('should respect --limit option', async () => {
      mockGetAllTerms.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', 'pronunciation', 'list', '--limit', '50']);

      expect(mockGetAllTerms).toHaveBeenCalledWith(50);
    });

    it('should output JSON when --json flag is set', async () => {
      mockGetAllTerms.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', '--json', 'pronunciation', 'list']);

      const jsonOutput = consoleLogSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"entries"')
      );
      expect(jsonOutput).toBeDefined();
    });
  });

  describe('pronunciation add', () => {
    it('should add a term to the dictionary', async () => {
      mockAddTerm.mockResolvedValueOnce(undefined);

      await program.parseAsync([
        'node',
        'test',
        'pronunciation',
        'add',
        'GPT-4o',
        '/dʒiːpiːtiːfoʊ/',
        '<phoneme alphabet="ipa" ph="dʒiːpiːtiːfoʊ">GPT-4o</phoneme>',
      ]);

      expect(mockAddTerm).toHaveBeenCalledWith(
        expect.objectContaining({
          term: 'GPT-4o',
          ipa: '/dʒiːpiːtiːfoʊ/',
          verified: false,
          source: 'manual',
        })
      );
    });
  });

  describe('pronunciation search', () => {
    it('should search for terms by prefix', async () => {
      mockSearchTerms.mockResolvedValueOnce([
        { term: 'GPT', ipa: '/dʒiː piː tiː/', verified: true },
        { term: 'GPT-4', ipa: '/dʒiː piː tiː fɔːr/', verified: false },
      ]);

      await program.parseAsync(['node', 'test', 'pronunciation', 'search', 'GPT']);

      expect(mockSearchTerms).toHaveBeenCalledWith('GPT');
    });

    it('should handle no results', async () => {
      mockSearchTerms.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', 'pronunciation', 'search', 'xyz123']);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('pronunciation verify', () => {
    it('should mark a term as verified', async () => {
      mockGetTerm.mockResolvedValueOnce({ term: 'GPT', ipa: '/dʒiː piː tiː/', verified: false });
      mockUpdateTerm.mockResolvedValueOnce(undefined);

      await program.parseAsync(['node', 'test', 'pronunciation', 'verify', 'GPT']);

      expect(mockGetTerm).toHaveBeenCalledWith('GPT');
      expect(mockUpdateTerm).toHaveBeenCalledWith('GPT', { verified: true });
    });

    it('should handle term not found', async () => {
      mockGetTerm.mockResolvedValueOnce(null);

      await program.parseAsync(['node', 'test', 'pronunciation', 'verify', 'unknown']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
