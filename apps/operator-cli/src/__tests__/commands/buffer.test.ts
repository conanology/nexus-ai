/**
 * Buffer command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/buffer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerBufferCommand } from '../../commands/buffer.js';

// Mock @nexus-ai/core
const mockListAvailableBuffers = vi.fn();
const mockDeployBuffer = vi.fn();
const mockCreateBufferVideo = vi.fn();
const mockGetBufferHealthStatus = vi.fn();

vi.mock('@nexus-ai/core', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
  listAvailableBuffers: (...args: unknown[]) => mockListAvailableBuffers(...args),
  deployBuffer: (...args: unknown[]) => mockDeployBuffer(...args),
  createBufferVideo: (...args: unknown[]) => mockCreateBufferVideo(...args),
  getBufferHealthStatus: (...args: unknown[]) => mockGetBufferHealthStatus(...args),
  BUFFER_THRESHOLDS: { MINIMUM_COUNT: 1, WARNING_COUNT: 2 },
}));

describe('Buffer Command', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerBufferCommand(program);

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

  it('should register buffer command with subcommands', () => {
    const bufferCmd = program.commands.find((cmd) => cmd.name() === 'buffer');
    expect(bufferCmd).toBeDefined();

    const subcommands = bufferCmd?.commands.map((c) => c.name());
    expect(subcommands).toContain('list');
    expect(subcommands).toContain('deploy');
    expect(subcommands).toContain('create');
    expect(subcommands).toContain('health');
  });

  describe('buffer list', () => {
    it('should list available buffers', async () => {
      mockListAvailableBuffers.mockResolvedValueOnce([
        {
          id: 'bf-12345678',
          topic: 'Test Topic',
          title: 'Test Video',
          createdDate: new Date().toISOString(),
          status: 'active',
        },
      ]);

      await program.parseAsync(['node', 'test', 'buffer', 'list']);

      expect(mockListAvailableBuffers).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle empty buffer list', async () => {
      mockListAvailableBuffers.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', 'buffer', 'list']);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should output JSON when --json flag is set', async () => {
      mockListAvailableBuffers.mockResolvedValueOnce([]);

      await program.parseAsync(['node', 'test', '--json', 'buffer', 'list']);

      const jsonOutput = consoleLogSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('"buffers"')
      );
      expect(jsonOutput).toBeDefined();
    });
  });

  describe('buffer deploy', () => {
    it('should deploy buffer with --yes flag', async () => {
      mockListAvailableBuffers.mockResolvedValueOnce([
        { id: 'bf-12345678', topic: 'Test', title: 'Test', status: 'active' },
      ]);
      mockDeployBuffer.mockResolvedValueOnce({
        success: true,
        bufferId: 'bf-12345678',
        videoId: 'abc123',
        scheduledTime: '2026-01-22T14:00:00Z',
      });

      await program.parseAsync(['node', 'test', 'buffer', 'deploy', '--yes']);

      expect(mockDeployBuffer).toHaveBeenCalled();
    });

    it('should prompt for confirmation without --yes flag', async () => {
      // The process.exit mock doesn't actually stop execution in tests
      // so we just verify the confirmation message is shown and exit(0) is called
      mockListAvailableBuffers.mockResolvedValueOnce([
        { id: 'bf-12345678', topic: 'Test', title: 'Test', status: 'active' },
      ]);
      // Also mock deployBuffer since execution continues in test
      mockDeployBuffer.mockResolvedValueOnce({
        success: true,
        bufferId: 'bf-12345678',
      });

      await program.parseAsync(['node', 'test', 'buffer', 'deploy']);

      // Verify confirmation message was logged
      expect(consoleLogSpy).toHaveBeenCalled();
      const confirmationCall = consoleLogSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('About to deploy')
      );
      expect(confirmationCall).toBeDefined();
      // And exit(0) was called
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('buffer create', () => {
    it('should require --video-id and --title options', async () => {
      await program.parseAsync(['node', 'test', 'buffer', 'create', 'New Topic']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should create buffer with all options', async () => {
      mockCreateBufferVideo.mockResolvedValueOnce({
        id: 'bf-new12345',
        videoId: 'newvideo123',
        topic: 'New Topic',
      });

      await program.parseAsync([
        'node',
        'test',
        'buffer',
        'create',
        'New Topic',
        '--video-id',
        'newvideo123',
        '--title',
        'New Video Title',
      ]);

      expect(mockCreateBufferVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'newvideo123',
          topic: 'New Topic',
          title: 'New Video Title',
          source: 'manual',
        })
      );
    });
  });

  describe('buffer health', () => {
    it('should display health status', async () => {
      mockGetBufferHealthStatus.mockResolvedValueOnce({
        totalCount: 3,
        availableCount: 2,
        deployedCount: 1,
        status: 'healthy',
        belowWarningThreshold: false,
        belowMinimumThreshold: false,
        lastChecked: new Date().toISOString(),
      });

      await program.parseAsync(['node', 'test', 'buffer', 'health']);

      expect(mockGetBufferHealthStatus).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should warn when below threshold', async () => {
      mockGetBufferHealthStatus.mockResolvedValueOnce({
        totalCount: 1,
        availableCount: 1,
        deployedCount: 0,
        status: 'warning',
        belowWarningThreshold: true,
        belowMinimumThreshold: false,
        lastChecked: new Date().toISOString(),
      });

      await program.parseAsync(['node', 'test', 'buffer', 'health']);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
