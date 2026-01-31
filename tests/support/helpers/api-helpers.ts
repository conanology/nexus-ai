import type { APIRequestContext } from '@playwright/test';

/**
 * Pure helper functions for API interactions.
 * Framework-agnostic: accept all dependencies explicitly.
 */

type ApiRequestParams = {
  request: APIRequestContext;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest({
  request,
  method,
  url,
  data,
  headers = {},
}: ApiRequestParams) {
  const response = await request.fetch(url, {
    method,
    data,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!response.ok()) {
    throw new Error(
      `API ${method} ${url} failed: ${response.status()} ${await response.text()}`,
    );
  }

  return response.json();
}

export async function waitForHealthy(
  request: APIRequestContext,
  baseUrl: string,
  maxAttempts = 30,
  intervalMs = 1000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await request.get(`${baseUrl}/health`);
      if (resp.ok()) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Server at ${baseUrl} did not become healthy`);
}
