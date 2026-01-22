/**
 * CLI program setup tests
 *
 * @module @nexus-ai/operator-cli/__tests__/cli
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { program } from '../cli.js';

// Mock the auth module
vi.mock('../utils/auth.js', () => ({
  verifyAuth: vi.fn().mockResolvedValue(undefined),
}));

// Mock all command registrations
vi.mock('../commands/trigger.js', () => ({
  registerTriggerCommand: vi.fn(),
}));

vi.mock('../commands/status.js', () => ({
  registerStatusCommand: vi.fn(),
}));

vi.mock('../commands/costs.js', () => ({
  registerCostsCommand: vi.fn(),
}));

vi.mock('../commands/buffer.js', () => ({
  registerBufferCommand: vi.fn(),
}));

vi.mock('../commands/pronunciation.js', () => ({
  registerPronunciationCommand: vi.fn(),
}));

vi.mock('../commands/review.js', () => ({
  registerReviewCommand: vi.fn(),
}));

vi.mock('../commands/retry.js', () => ({
  registerRetryCommand: vi.fn(),
}));

describe('CLI Program', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct name', () => {
    expect(program.name()).toBe('nexus');
  });

  it('should have a description', () => {
    expect(program.description()).toBe('NEXUS-AI pipeline operator CLI');
  });

  it('should have a version', () => {
    expect(program.version()).toBe('1.0.0');
  });

  it('should have --json global option', () => {
    const jsonOption = program.options.find((opt) => opt.long === '--json');
    expect(jsonOption).toBeDefined();
  });
});
