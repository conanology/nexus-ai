/**
 * Trigger command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/trigger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerTriggerCommand } from '../../commands/trigger.js';

// Mock @nexus-ai/core
vi.mock('@nexus-ai/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock auth utils
vi.mock('../../utils/auth.js', () => ({
  getOrchestratorUrl: vi.fn(() => 'https://orchestrator.example.com'),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Trigger Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerTriggerCommand(program);

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

  it('should register trigger command', () => {
    const triggerCmd = program.commands.find((cmd) => cmd.name() === 'trigger');
    expect(triggerCmd).toBeDefined();
    expect(triggerCmd?.description()).toContain('trigger');
  });

  it('should have --date option', () => {
    const triggerCmd = program.commands.find((cmd) => cmd.name() === 'trigger');
    const dateOpt = triggerCmd?.options.find((opt) => opt.long === '--date');
    expect(dateOpt).toBeDefined();
  });

  it('should have --wait option', () => {
    const triggerCmd = program.commands.find((cmd) => cmd.name() === 'trigger');
    const waitOpt = triggerCmd?.options.find((opt) => opt.long === '--wait');
    expect(waitOpt).toBeDefined();
  });

  it('should have --skip-health-check option', () => {
    const triggerCmd = program.commands.find((cmd) => cmd.name() === 'trigger');
    const skipOpt = triggerCmd?.options.find((opt) => opt.long === '--skip-health-check');
    expect(skipOpt).toBeDefined();
  });

  it('should make API call with correct body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Pipeline triggered', status: 'accepted' }),
    });

    await program.parseAsync(['node', 'test', 'trigger', '--date', '2026-01-22']);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://orchestrator.example.com/trigger',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('2026-01-22'),
      })
    );
  });

  it('should handle successful trigger', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Pipeline triggered', status: 'accepted', pipelineId: '2026-01-22' }),
    });

    await program.parseAsync(['node', 'test', 'trigger']);

    expect(consoleLogSpy).toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalledWith(1);
  });

  it('should output JSON when --json flag is set', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Pipeline triggered', status: 'accepted', pipelineId: '2026-01-22' }),
    });

    await program.parseAsync(['node', 'test', '--json', 'trigger']);

    const jsonOutput = consoleLogSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('"success"')
    );
    expect(jsonOutput).toBeDefined();
  });

  it('should reject invalid date format', async () => {
    await program.parseAsync(['node', 'test', 'trigger', '--date', 'invalid-date']);

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});
