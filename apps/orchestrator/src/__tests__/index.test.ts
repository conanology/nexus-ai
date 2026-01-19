import { describe, it, expect } from 'vitest';
import { createServer } from '../index.js';

describe('Orchestrator Service', () => {
  it('should create HTTP server instance', () => {
    const app = createServer();
    expect(app).toBeDefined();
    expect(app).toBeInstanceOf(Function);
  });

  it('should have health endpoint registered', () => {
    const app = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routes = (app as any)._router?.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    expect(routes).toContain('/health');
  });

  it('should have scheduled trigger endpoint registered', () => {
    const app = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routes = (app as any)._router?.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    expect(routes).toContain('/trigger/scheduled');
  });

  it('should have manual trigger endpoint registered', () => {
    const app = createServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routes = (app as any)._router?.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    expect(routes).toContain('/trigger/manual');
  });
});
