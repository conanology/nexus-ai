/**
 * Tests for Secret Manager health check
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSecretsHealth } from '../secrets-health.js';

// Mock dependencies
vi.mock('@nexus-ai/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nexus-ai/core')>();
  return {
    ...actual,
    getSecret: vi.fn(),
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  };
});

describe('checkSecretsHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return healthy status when secret retrieval succeeds', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('secret-value-here');

    const result = await checkSecretsHealth();

    expect(result.service).toBe('secret-manager');
    expect(result.status).toBe('healthy');
    expect(result.error).toBeUndefined();
  });

  it('should return failed status when secret not found', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockRejectedValue(new Error('Secret not found'));

    const result = await checkSecretsHealth();

    expect(result.service).toBe('secret-manager');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Secret not found');
  });

  it('should return failed status when secret is empty', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('');

    const result = await checkSecretsHealth();

    expect(result.service).toBe('secret-manager');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('empty');
  });

  it('should return failed status when project ID is missing', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockRejectedValue(
      new Error('NEXUS_PROJECT_ID not set')
    );

    const result = await checkSecretsHealth();

    expect(result.service).toBe('secret-manager');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('NEXUS_PROJECT_ID');
  });

  it('should call getSecret with the correct secret name', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockResolvedValue('secret-value');

    await checkSecretsHealth();

    expect(getSecret).toHaveBeenCalledWith('nexus-gemini-api-key');
  });

  it('should include latency in result', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'secret-value';
    });

    const result = await checkSecretsHealth();

    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it('should return failed status on SDK errors', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockRejectedValue(new Error('SDK initialization failed'));

    const result = await checkSecretsHealth();

    expect(result.service).toBe('secret-manager');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('SDK initialization failed');
  });

  it('should return failed status on permission errors', async () => {
    const { getSecret } = await import('@nexus-ai/core');

    (getSecret as any).mockRejectedValue(
      new Error('Permission denied accessing secret')
    );

    const result = await checkSecretsHealth();

    expect(result.service).toBe('secret-manager');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Permission denied');
  });
});
