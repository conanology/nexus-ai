# Story 1.1: Initialize Monorepo

Status: ready-for-dev

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

- [ ] Initialize Turborepo project
  - [ ] Run `create-turbo` with pnpm
  - [ ] Clean up default example apps/packages if not needed or refactor them
- [ ] Configure Workspace Structure
  - [ ] Set up `apps/` directory
  - [ ] Set up `packages/` directory structure
  - [ ] Update `pnpm-workspace.yaml`
- [ ] Establish Shared Configuration
  - [ ] Create `@nexus-ai/config` (or use default `ui` / `tsconfig` approach)
  - [ ] Ensure `tsconfig.json` enforces strict mode
  - [ ] Create `.nvmrc`
- [ ] Verify Build Pipeline
  - [ ] Run `pnpm install`
  - [ ] Run `pnpm build`
  - [ ] Commit initial structure

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

### Completion Notes List
*   (To be filled by Dev Agent)

### File List
*   `package.json`
*   `pnpm-workspace.yaml`
*   `turbo.json`
*   `.nvmrc`
*   `tsconfig.base.json`
*   `.gitignore`
