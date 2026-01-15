import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const projectRoot = join(__dirname, '..');

describe('Acceptance Criteria Validation', () => {
  describe('AC1: Monorepo Initialization', () => {
    it('should have root package.json with workspaces for apps/* and packages/*', () => {
      const pkgPath = join(projectRoot, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

      expect(pkg.workspaces).toContain('apps/*');
      expect(pkg.workspaces).toContain('packages/*');
    });
  });

  describe('AC2: Directory Structure Compliance', () => {
    it('should have apps/ directory for deployable applications', () => {
      expect(existsSync(join(projectRoot, 'apps'))).toBe(true);
      expect(existsSync(join(projectRoot, 'apps', 'orchestrator'))).toBe(true);
      expect(existsSync(join(projectRoot, 'apps', 'video-studio'))).toBe(true);
    });

    it('should have packages/ directory created', () => {
      expect(existsSync(join(projectRoot, 'packages'))).toBe(true);
    });

    it('should have packages/config/ for shared configuration', () => {
      expect(existsSync(join(projectRoot, 'packages', 'config'))).toBe(true);

      const pkgPath = join(projectRoot, 'packages', 'config', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe('@nexus-ai/config');
    });

    it('should have packages/core/ structured for shared types and utilities', () => {
      expect(existsSync(join(projectRoot, 'packages', 'core'))).toBe(true);

      const pkgPath = join(projectRoot, 'packages', 'core', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      expect(pkg.name).toBe('@nexus-ai/core');
    });
  });

  describe('AC3: Configuration Standards', () => {
    it('should have turbo.json configured with build, test, and lint pipelines', () => {
      const turboPath = join(projectRoot, 'turbo.json');
      const turbo = JSON.parse(readFileSync(turboPath, 'utf-8'));

      const tasks = turbo.tasks || turbo.pipeline;
      expect(tasks.build).toBeDefined();
      expect(tasks.test).toBeDefined();
      expect(tasks.lint).toBeDefined();
    });

    it('should have shared tsconfig.base.json with strict mode and ES2022+ target', () => {
      const tsconfigPath = join(projectRoot, 'tsconfig.base.json');
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.target).toMatch(/ES2022|ES2023|ESNext/);
    });

    it('should have .nvmrc with Node.js 20.x LTS', () => {
      const nvmrcPath = join(projectRoot, '.nvmrc');
      const version = readFileSync(nvmrcPath, 'utf-8').trim();

      expect(version).toMatch(/^20\./);
    });

    it('should have .gitignore with required exclusions', () => {
      const gitignorePath = join(projectRoot, '.gitignore');
      const content = readFileSync(gitignorePath, 'utf-8');

      expect(content).toContain('node_modules');
      expect(content).toContain('dist');
      expect(content).toContain('.turbo');
      expect(content).toContain('.env');
      expect(content).toMatch(/\.DS_Store|Thumbs\.db/); // OS files
    });
  });

  describe('AC4: Package Management', () => {
    it('should have pnpm-workspace.yaml with correct patterns', () => {
      const workspacePath = join(projectRoot, 'pnpm-workspace.yaml');
      const content = readFileSync(workspacePath, 'utf-8');

      expect(content).toContain('apps/*');
      expect(content).toContain('packages/*');
    });

    it('should have node_modules after pnpm install', () => {
      expect(existsSync(join(projectRoot, 'node_modules'))).toBe(true);
    });

    it('should be buildable (verifies pnpm build produces dist outputs)', () => {
      // Run build command
      try {
        execSync('pnpm build', { encoding: 'utf-8', cwd: projectRoot });
        console.log('Build completed successfully');
      } catch (error) {
        throw new Error(`Build failed: ${error}`);
      }

      // Verify build outputs exist
      const coreDistExists = existsSync(join(projectRoot, 'packages', 'core', 'dist'));
      const orchestratorDistExists = existsSync(join(projectRoot, 'apps', 'orchestrator', 'dist'));

      expect(coreDistExists).toBe(true);
      expect(orchestratorDistExists).toBe(true);
    }, 120000); // 2 minute timeout for builds
  });

  describe('AC5: Naming Conventions', () => {
    it('should use @nexus-ai scope for all packages', () => {
      const corePkg = JSON.parse(
        readFileSync(join(projectRoot, 'packages', 'core', 'package.json'), 'utf-8')
      );
      expect(corePkg.name).toBe('@nexus-ai/core');

      const configPkg = JSON.parse(
        readFileSync(join(projectRoot, 'packages', 'config', 'package.json'), 'utf-8')
      );
      expect(configPkg.name).toBe('@nexus-ai/config');

      const orchestratorPkg = JSON.parse(
        readFileSync(join(projectRoot, 'apps', 'orchestrator', 'package.json'), 'utf-8')
      );
      expect(orchestratorPkg.name).toBe('@nexus-ai/orchestrator');

      const videoPkg = JSON.parse(
        readFileSync(join(projectRoot, 'apps', 'video-studio', 'package.json'), 'utf-8')
      );
      expect(videoPkg.name).toBe('@nexus-ai/video-studio');
    });
  });
});
