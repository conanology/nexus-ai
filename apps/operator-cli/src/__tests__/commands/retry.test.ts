/**
 * Retry command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerRetryCommand } from '../../commands/retry.js';

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

// Mock auth utils
vi.mock('../../utils/auth.js', () => ({
  getOrchestratorUrl: vi.fn(() => 'https://orchestrator.example.com'),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Retry Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerRetryCommand(program);

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

  it('should register retry command', () => {
    const retryCmd = program.commands.find((cmd) => cmd.name() === 'retry');
    expect(retryCmd).toBeDefined();
    expect(retryCmd?.description()).toContain('Retry');
  });

  it('should have --from option', () => {
    const retryCmd = program.commands.find((cmd) => cmd.name() === 'retry');
    const fromOpt = retryCmd?.options.find((opt) => opt.long === '--from');
    expect(fromOpt).toBeDefined();
  });

  it('should have --wait option', () => {
    const retryCmd = program.commands.find((cmd) => cmd.name() === 'retry');
    const waitOpt = retryCmd?.options.find((opt) => opt.long === '--wait');
    expect(waitOpt).toBeDefined();
  });

  it('should reject invalid pipeline ID format', async () => {
    await program.parseAsync(['node', 'test', 'retry', 'invalid-id']);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should check pipeline state before retry', async () => {
    mockGetDocument.mockResolvedValueOnce({ status: 'failed', currentStage: 'tts' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Retry started', status: 'accepted' }),
    });

    await program.parseAsync(['node', 'test', 'retry', '2026-01-22']);

    expect(mockGetDocument).toHaveBeenCalledWith('pipelines', '2026-01-22/state');
  });

  it('should reject retry for non-failed pipeline', async () => {
    // The process.exit mock doesn't actually stop execution in tests
    mockGetDocument.mockResolvedValueOnce({ status: 'completed', currentStage: 'publish' });
    // Mock fetch since execution continues in tests even after process.exit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Retry started', status: 'accepted' }),
    });

    await program.parseAsync(['node', 'test', 'retry', '2026-01-22']);

    // Verify error message was shown and exit(1) was called
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
    // The error message should mention the status
    const errorCall = consoleErrorSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('not in failed state')
    );
    expect(errorCall).toBeDefined();
  });

  it('should reject retry for non-existent pipeline', async () => {
    mockGetDocument.mockResolvedValueOnce(null);

    await program.parseAsync(['node', 'test', 'retry', '2026-01-22']);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should make API call with correct body', async () => {
    mockGetDocument.mockResolvedValueOnce({ status: 'failed', currentStage: 'tts' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Retry started', status: 'accepted' }),
    });

    await program.parseAsync(['node', 'test', 'retry', '2026-01-22', '--from', 'tts']);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://orchestrator.example.com/retry',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('2026-01-22'),
      })
    );

    const fetchCall = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.fromStage).toBe('tts');
  });

  it('should output JSON when --json flag is set', async () => {
    mockGetDocument.mockResolvedValueOnce({ status: 'failed', currentStage: 'tts' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        message: 'Retry started',
        status: 'accepted',
        pipelineId: '2026-01-22',
      }),
    });

    await program.parseAsync(['node', 'test', '--json', 'retry', '2026-01-22']);

    const jsonOutput = consoleLogSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('"success"')
    );
    expect(jsonOutput).toBeDefined();
  });
});
