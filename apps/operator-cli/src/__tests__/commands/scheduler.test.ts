/**
 * Scheduler command tests
 *
 * @module @nexus-ai/operator-cli/__tests__/commands/scheduler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerSchedulerCommand } from '../../commands/scheduler.js';

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
  getProjectId: vi.fn(() => 'test-project'),
}));

// Mock child_process
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

describe('Scheduler Command', () => {
  let program: Command;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleLogSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let processExitSpy: any;

  // Helper to setup mock for gcloud version check + job existence check + actual command
  const setupGcloudMocks = (commandResponse: string | (() => string)) => {
    mockExecSync.mockImplementation((cmd: string) => {
      // gcloud --version check
      if (cmd === 'gcloud --version') {
        return 'Google Cloud SDK 450.0.0';
      }
      // Job existence check (describe with --format=value)
      if (cmd.includes('describe') && cmd.includes('--format=value')) {
        return 'projects/test-project/locations/us-central1/jobs/nexus-daily-pipeline';
      }
      // Actual command (pause, resume, run, status describe)
      if (typeof commandResponse === 'function') {
        return commandResponse();
      }
      return commandResponse;
    });
  };

  beforeEach(() => {
    program = new Command();
    program.option('--json', 'Output as JSON');
    registerSchedulerCommand(program);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Command Registration', () => {
    it('should register scheduler command with subcommands', () => {
      const schedulerCmd = program.commands.find((cmd) => cmd.name() === 'scheduler');
      expect(schedulerCmd).toBeDefined();
      expect(schedulerCmd?.description()).toContain('Cloud Scheduler');
    });

    it('should have status subcommand', () => {
      const schedulerCmd = program.commands.find((cmd) => cmd.name() === 'scheduler');
      const statusCmd = schedulerCmd?.commands.find((cmd) => cmd.name() === 'status');
      expect(statusCmd).toBeDefined();
    });

    it('should have pause subcommand', () => {
      const schedulerCmd = program.commands.find((cmd) => cmd.name() === 'scheduler');
      const pauseCmd = schedulerCmd?.commands.find((cmd) => cmd.name() === 'pause');
      expect(pauseCmd).toBeDefined();
    });

    it('should have resume subcommand', () => {
      const schedulerCmd = program.commands.find((cmd) => cmd.name() === 'scheduler');
      const resumeCmd = schedulerCmd?.commands.find((cmd) => cmd.name() === 'resume');
      expect(resumeCmd).toBeDefined();
    });

    it('should have run subcommand', () => {
      const schedulerCmd = program.commands.find((cmd) => cmd.name() === 'scheduler');
      const runCmd = schedulerCmd?.commands.find((cmd) => cmd.name() === 'run');
      expect(runCmd).toBeDefined();
    });
  });

  describe('scheduler status', () => {
    it('should call gcloud scheduler jobs describe', async () => {
      const mockStatus = {
        name: 'projects/test-project/locations/us-central1/jobs/nexus-daily-pipeline',
        state: 'ENABLED',
        schedule: '0 6 * * *',
        timeZone: 'UTC',
        scheduleTime: '2026-01-23T06:00:00Z',
        lastAttemptTime: '2026-01-22T06:00:00Z',
        status: { code: 0 },
      };
      setupGcloudMocks(JSON.stringify(mockStatus));

      await program.parseAsync(['node', 'test', 'scheduler', 'status']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gcloud scheduler jobs describe'),
        expect.any(Object)
      );
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle job not found', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        throw new Error('NOT_FOUND: Job not found');
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'status']);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON when --json flag is set', async () => {
      const mockStatus = {
        name: 'nexus-daily-pipeline',
        state: 'ENABLED',
        schedule: '0 6 * * *',
        timeZone: 'UTC',
      };
      setupGcloudMocks(JSON.stringify(mockStatus));

      await program.parseAsync(['node', 'test', '--json', 'scheduler', 'status']);

      const jsonOutput = consoleLogSpy.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('"found"')
      );
      expect(jsonOutput).toBeDefined();
    });

    it('should fail gracefully when gcloud is not installed', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          throw new Error('command not found: gcloud');
        }
        return '';
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'status']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('scheduler pause', () => {
    it('should call gcloud scheduler jobs pause', async () => {
      setupGcloudMocks('');

      await program.parseAsync(['node', 'test', 'scheduler', 'pause']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gcloud scheduler jobs pause'),
        expect.any(Object)
      );
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle pause error', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        if (cmd.includes('describe') && cmd.includes('--format=value')) {
          return 'nexus-daily-pipeline';
        }
        // Fail on actual pause command
        throw new Error('Permission denied');
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'pause']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when job does not exist', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        // Job existence check fails
        throw new Error('NOT_FOUND: Job not found');
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'pause']);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('scheduler resume', () => {
    it('should call gcloud scheduler jobs resume', async () => {
      const mockStatus = {
        state: 'ENABLED',
        scheduleTime: '2026-01-23T06:00:00Z',
        schedule: '0 6 * * *',
        timeZone: 'UTC',
      };

      let resumeCalled = false;
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        if (cmd.includes('describe') && cmd.includes('--format=value')) {
          return 'nexus-daily-pipeline';
        }
        if (cmd.includes('resume')) {
          resumeCalled = true;
          return '';
        }
        // Status fetch after resume
        return JSON.stringify(mockStatus);
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'resume']);

      expect(resumeCalled).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle resume error', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        if (cmd.includes('describe') && cmd.includes('--format=value')) {
          return 'nexus-daily-pipeline';
        }
        // Fail on actual resume command
        throw new Error('Permission denied');
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'resume']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should fail when job does not exist', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        // Job existence check fails
        throw new Error('NOT_FOUND: Job not found');
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'resume']);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('scheduler run', () => {
    it('should call gcloud scheduler jobs run', async () => {
      setupGcloudMocks('');

      await program.parseAsync(['node', 'test', 'scheduler', 'run']);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gcloud scheduler jobs run'),
        expect.any(Object)
      );
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle run error', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        if (cmd.includes('describe') && cmd.includes('--format=value')) {
          return 'nexus-daily-pipeline';
        }
        // Fail on actual run command
        throw new Error('Job is paused');
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'run']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should output JSON when --json flag is set', async () => {
      setupGcloudMocks('');

      await program.parseAsync(['node', 'test', '--json', 'scheduler', 'run']);

      const jsonOutput = consoleLogSpy.mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && call[0].includes('"success"')
      );
      expect(jsonOutput).toBeDefined();
    });

    it('should fail when job does not exist', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'gcloud --version') {
          return 'Google Cloud SDK 450.0.0';
        }
        // Job existence check fails
        throw new Error('NOT_FOUND: Job not found');
      });

      await program.parseAsync(['node', 'test', 'scheduler', 'run']);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });
});
