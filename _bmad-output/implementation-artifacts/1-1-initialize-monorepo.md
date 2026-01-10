# Story 1.1: Initialize Monorepo

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a properly configured Turborepo monorepo with pnpm workspaces,
So that I can build pipeline stages with shared code and independent deployments.

## Acceptance Criteria

1.  **Monorepo Initialization**:
    *   Project initialized using `pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm`.
    *   Root `package.json` defines workspaces (e.g., `apps/*`, `packages/*`).
2.  **Directory Structure Compliance**:
    *   `apps/` directory created for deployable applications (`orchestrator`, `video-studio`, etc.).
    *   `packages/` directory created for shared libraries.
    *   `packages/config/` created for shared configuration (tsconfig, eslint).
    *   `packages/core/` structured for shared types and utilities.
3.  **Configuration Standards**:
    *   `turbo.json` configured with build, test, and lint pipelines.
    *   Shared `tsconfig.base.json` present with `strict: true` and modern target (ES2022+).
    *   `.nvmrc` created specifying Node.js `20.x` (LTS).
    *   `.gitignore` properly configured to exclude `node_modules`, `dist`, `.turbo`, `.env`, and OS files.
4.  **Package Management**:
    *   `pnpm-workspace.yaml` configured to include `apps/*`, `packages/*`, and `packages/stages/*` (if nested structure used).
    *   `pnpm install` runs successfully without errors.
    *   `pnpm build` executes the Turborepo pipeline successfully.
5.  **Naming Conventions**:
    *   Packages use scope `@nexus-ai/{name}` (e.g., `@nexus-ai/core`).

## Tasks / Subtasks

- [x] Initialize Turborepo project
  - [x] Run `create-turbo` with pnpm
  - [x] Clean up default example apps/packages if not needed or refactor them
- [x] Configure Workspace Structure
  - [x] Set up `apps/` directory
  - [x] Set up `packages/` directory structure
  - [x] Update `pnpm-workspace.yaml`
- [x] Establish Shared Configuration
  - [x] Create `@nexus-ai/config` (or use default `ui` / `tsconfig` approach)
  - [x] Ensure `tsconfig.json` enforces strict mode
  - [x] Create `.nvmrc`
- [x] Verify Build Pipeline
  - [x] Run `pnpm install`
  - [x] Run `pnpm build`
  - [x] Commit initial structure

## Dev Notes

### Relevant Architecture Patterns
*   **Starter**: Turborepo v2.x (Latest) with pnpm.
*   **Structure**: The architecture mandates a specific structure. Note that `create-turbo` might scaffold a `web` and `docs` app by default. You should remove these or repurpose them.
    *   Create `apps/orchestrator` (can be empty shell for now).
    *   Create `apps/video-studio` (Remotion app) - *Note: Architecture says "add Remotion video-studio with `npm create video@latest apps/video-studio`"*.
*   **Package Scoping**: All internal packages MUST be scoped as `@nexus-ai/`.
*   **Strict Mode**: TypeScript `strict: true` is non-negotiable.

### Technical Requirements (from Architecture)
*   **Node.js**: 20.x LTS.
*   **Package Manager**: pnpm (latest).
*   **Monorepo Tool**: Turborepo (latest, v2.7+).

### Project Structure Notes
*   **Validation**: Ensure `packages/stages` is supported in workspace config if you plan to nest stages there (Architecture suggests `packages/stages/news-sourcing` etc.). `pnpm` supports glob patterns like `packages/**`.
*   **Clean Start**: Remove any `node_modules` before committing.

### References
*   [Architecture: Starter Template Evaluation](file:///home/cryptology/nexus/_bmad-output/planning-artifacts/architecture.md#starter-template-evaluation)
*   [Architecture: Project Structure](file:///home/cryptology/nexus/_bmad-output/planning-artifacts/architecture.md#complete-project-directory-structure)

## Dev Agent Record

### Agent Model Used
CLAUDE_4_5_SONNET

### Debug Log References
*   None

### Implementation Plan
*   Used TDD approach: wrote failing tests first, then implemented features
*   Created comprehensive test suite covering all acceptance criteria
*   Used create-turbo template as base, then customized for project needs

### Completion Notes List
*   ✅ Initialized Turborepo v2.7.3 with pnpm workspace configuration
*   ✅ Created directory structure: apps/ (orchestrator, video-studio) and packages/ (config, core)
*   ✅ Configured tsconfig.base.json with strict mode and ES2022 target
*   ✅ Set Node.js version to 20.18.2 LTS in .nvmrc
*   ✅ All packages scoped with @nexus-ai/ namespace
*   ✅ Build pipeline working: pnpm build executes successfully via Turborepo
*   ✅ Tests passing: 24/24 tests including full acceptance criteria validation
*   ✅ Monorepo ready for development of pipeline stages and services

### File List
*   `package.json` - Root package with workspaces and Turborepo scripts
*   `pnpm-workspace.yaml` - Workspace configuration (includes packages/** for nested packages)
*   `turbo.json` - Turborepo pipeline configuration (build, test, lint, dev tasks)
*   `.nvmrc` - Node.js 20.18.2 LTS version
*   `tsconfig.base.json` - Shared TypeScript config with strict mode
*   `.gitignore` - Git ignore rules (includes OS files for Mac/Windows/Linux)
*   `vitest.config.ts` - Test configuration
*   `tests/monorepo-setup.test.ts` - Monorepo setup validation tests
*   `tests/acceptance-criteria.test.ts` - Full AC validation test suite (fixed flaky build test)
*   `packages/config/package.json` - @nexus-ai/config package
*   `packages/config/tsconfig.json` - Config package TypeScript settings
*   `packages/core/package.json` - @nexus-ai/core package
*   `packages/core/tsconfig.json` - Core package TypeScript settings
*   `packages/core/src/index.ts` - Core package entry point
*   `apps/orchestrator/package.json` - @nexus-ai/orchestrator app
*   `apps/orchestrator/tsconfig.json` - Orchestrator TypeScript settings
*   `apps/orchestrator/src/index.ts` - Orchestrator entry point
*   `apps/video-studio/package.json` - @nexus-ai/video-studio app (Remotion 4.x configured)
*   `apps/video-studio/tsconfig.json` - Video studio TypeScript settings with JSX
*   `apps/video-studio/remotion.config.ts` - Remotion configuration
*   `apps/video-studio/src/Root.tsx` - Remotion root composition registry
*   `apps/video-studio/src/HelloWorld.tsx` - Sample Remotion composition

### Change Log
*   2026-01-09: Initial monorepo setup complete with Turborepo v2.7.3, pnpm workspaces, strict TypeScript configuration, and comprehensive test suite (24 tests passing)
*   2026-01-09: Code review fixes applied - properly committed all files, set up Remotion 4.x in video-studio, enhanced .gitignore, fixed workspace config for nested packages, fixed flaky test (commit: 0140038)
