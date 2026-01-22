/**
 * Status command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/status
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerStatusCommand } from '../../commands/status.js';

// Mock @nexus-ai/core
const mockGetDocument = vi.fn();
vi.mock('@nexus-ai/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  FirestoreClient: vi.fn().mockImplementation(() => ({
    getDocument: mockGetDocument,
  })),
}));

describe('Status Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerStatusCommand(program);

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

  it('should register status command', () => {
    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status');
    expect(statusCmd).toBeDefined();
    expect(statusCmd?.description()).toContain('status');
  });

  it('should have --date option', () => {
    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status');
    const dateOpt = statusCmd?.options.find((opt) => opt.long === '--date');
    expect(dateOpt).toBeDefined();
  });

  it('should have --watch option', () => {
    const statusCmd = program.commands.find((cmd) => cmd.name() === 'status');
    const watchOpt = statusCmd?.options.find((opt) => opt.long === '--watch');
    expect(watchOpt).toBeDefined();
  });

  it('should display status for found pipeline', async () => {
    mockGetDocument.mockResolvedValueOnce({
      currentStage: 'tts',
      status: 'running',
      startTime: new Date().toISOString(),
      durationMs: 30000,
    });

    await program.parseAsync(['node', 'test', 'status', '--date', '2026-01-22']);

    expect(mockGetDocument).toHaveBeenCalledWith('pipelines', '2026-01-22/state');
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should handle pipeline not found', async () => {
    mockGetDocument.mockRejectedValueOnce(new Error('Document not found'));

    await program.parseAsync(['node', 'test', 'status', '--date', '2026-01-22']);

    // Should show info message, not error
    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it('should output JSON when --json flag is set', async () => {
    mockGetDocument.mockResolvedValueOnce({
      currentStage: 'render',
      status: 'completed',
    });

    await program.parseAsync(['node', 'test', '--json', 'status']);

    const jsonOutput = consoleLogSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('"found"')
    );
    expect(jsonOutput).toBeDefined();
  });

  it('should reject invalid date format', async () => {
    await program.parseAsync(['node', 'test', 'status', '--date', 'bad-date']);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
