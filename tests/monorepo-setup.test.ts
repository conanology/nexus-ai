import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const projectRoot = join(__dirname, '..');

describe('Monorepo Setup', () => {
  it('should have package.json with workspaces configured', () => {
    const pkgPath = join(projectRoot, 'package.json');
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    expect(pkg.workspaces).toBeDefined();
  });

  it('should have pnpm-workspace.yaml configured', () => {
    const workspacePath = join(projectRoot, 'pnpm-workspace.yaml');
    expect(existsSync(workspacePath)).toBe(true);

    const content = readFileSync(workspacePath, 'utf-8');
    expect(content).toContain('apps/*');
    expect(content).toContain('packages/*');
  });

  it('should have turbo.json with build pipeline', () => {
    const turboPath = join(projectRoot, 'turbo.json');
    expect(existsSync(turboPath)).toBe(true);

    const turbo = JSON.parse(readFileSync(turboPath, 'utf-8'));
    expect(turbo.pipeline || turbo.tasks).toBeDefined();
  });

  it('should have .nvmrc with Node.js 20.x', () => {
    const nvmrcPath = join(projectRoot, '.nvmrc');
    expect(existsSync(nvmrcPath)).toBe(true);

    const version = readFileSync(nvmrcPath, 'utf-8').trim();
    expect(version).toMatch(/^20\./);
  });

  it('should have tsconfig.base.json with strict mode', () => {
    const tsconfigPath = join(projectRoot, 'tsconfig.base.json');
    expect(existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.target).toMatch(/ES2022|ES2023|ESNext/i);
  });

  it('should have .gitignore with required entries', () => {
    const gitignorePath = join(projectRoot, '.gitignore');
    expect(existsSync(gitignorePath)).toBe(true);

    const content = readFileSync(gitignorePath, 'utf-8');
    expect(content).toContain('node_modules');
    expect(content).toContain('dist');
    expect(content).toContain('.turbo');
    expect(content).toContain('.env');
  });

  it('should have apps/ directory', () => {
    const appsPath = join(projectRoot, 'apps');
    expect(existsSync(appsPath)).toBe(true);
  });

  it('should have packages/ directory', () => {
    const packagesPath = join(projectRoot, 'packages');
    expect(existsSync(packagesPath)).toBe(true);
  });

  it('should have packages/config/ directory', () => {
    const configPath = join(projectRoot, 'packages', 'config');
    expect(existsSync(configPath)).toBe(true);
  });

  it('should have packages/core/ directory', () => {
    const corePath = join(projectRoot, 'packages', 'core');
    expect(existsSync(corePath)).toBe(true);
  });

  it('should use @nexus-ai scope for packages', () => {
    const corePkgPath = join(projectRoot, 'packages', 'core', 'package.json');

    if (existsSync(corePkgPath)) {
      const pkg = JSON.parse(readFileSync(corePkgPath, 'utf-8'));
      expect(pkg.name).toMatch(/^@nexus-ai\//);
    }
  });
});
