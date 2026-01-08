# Story 1.1: Initialize Monorepo

Status: done

## Story

As a developer,
I want a properly configured Turborepo monorepo with pnpm workspaces,
so that I can build pipeline stages with shared code and independent deployments.

## Acceptance Criteria

1. **Given** no existing project structure
   **When** I run the Turborepo initialization command
   **Then** a monorepo is created with the following structure:
   - `apps/` directory for deployable applications
   - `packages/` directory for shared libraries
   - `pnpm-workspace.yaml` configured for workspace packages
   - `turbo.json` with build, test, and lint pipelines
   - Root `package.json` with workspace scripts
   - Shared `tsconfig.base.json` with strict mode enabled

2. **And** running `pnpm install` succeeds without errors

3. **And** running `pnpm build` executes Turborepo pipeline

4. **And** `.nvmrc` specifies Node.js 20.x LTS

5. **And** `.gitignore` excludes node_modules, dist, .env files

## Tasks / Subtasks

- [x] Task 1: Initialize Turborepo monorepo (AC: #1)
  - [x] Run `pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm`
  - [x] Verify generated structure matches architecture spec
  - [x] Remove any default sample apps/packages from starter

- [x] Task 2: Configure pnpm workspace (AC: #1)
  - [x] Create/verify `pnpm-workspace.yaml` with packages glob
  - [x] Ensure packages/* and apps/* are included in workspace

- [x] Task 3: Configure Turborepo pipelines (AC: #1, #3)
  - [x] Update `turbo.json` with build, test, lint, and typecheck pipelines
  - [x] Configure caching for build outputs
  - [x] Set up proper task dependencies

- [x] Task 4: Set up TypeScript strict mode (AC: #1)
  - [x] Create `tsconfig.base.json` with strict mode enabled
  - [x] Configure path aliases for @nexus-ai/* packages
  - [x] Set target to ES2022, module to NodeNext

- [x] Task 5: Configure root package.json (AC: #1, #2, #3)
  - [x] Add workspace scripts: build, test, lint, typecheck, dev
  - [x] Configure package manager and engine requirements
  - [x] Set project name and metadata

- [x] Task 6: Create directory structure (AC: #1)
  - [x] Ensure `apps/` directory exists with .gitkeep
  - [x] Ensure `packages/` directory exists with .gitkeep
  - [x] Create placeholder structure per architecture

- [x] Task 7: Configure development environment (AC: #4, #5)
  - [x] Create `.nvmrc` with Node.js 20.x specification
  - [x] Create comprehensive `.gitignore` (node_modules, dist, .env*, etc.)
  - [x] Create `.env.example` with NEXUS_ prefix variables

- [x] Task 8: Verify installation and build (AC: #2, #3)
  - [x] Run `pnpm install` and verify success
  - [x] Run `pnpm build` and verify Turborepo pipeline executes
  - [x] Verify no errors in initial setup

## Dev Notes

### Critical Architecture Requirements

**Initialization Command (MANDATORY):**
```bash
pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm
```

**Target Project Structure:**
```
nexus-ai/
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── tsconfig.base.json
├── .nvmrc
├── .gitignore
├── .env.example
├── apps/
│   └── .gitkeep
├── packages/
│   └── .gitkeep
└── .github/workflows/
    └── ci.yml (optional - can be deferred)
```

### TypeScript Configuration

**tsconfig.base.json MUST include:**
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### Turbo Pipeline Configuration

**turbo.json MUST include:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "tests/**/*.ts"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Naming Conventions (ENFORCE)

| Element | Convention | Example |
|---------|------------|---------|
| Package scope | `@nexus-ai/` | `@nexus-ai/core` |
| Package names | kebab-case | `news-sourcing`, `script-gen` |
| Environment vars | `NEXUS_` prefix | `NEXUS_PROJECT_ID` |

### .env.example Template

```bash
# NEXUS-AI Environment Configuration
NEXUS_PROJECT_ID=nexus-ai-dev
NEXUS_BUCKET_NAME=nexus-ai-artifacts
NEXUS_LOG_LEVEL=debug
NEXUS_GEMINI_API_KEY=
NEXUS_DISCORD_WEBHOOK=
```

### Project Structure Notes

- This story establishes the foundation for ALL subsequent stories
- The `@nexus-ai/core` package (Story 1.2) depends on this structure
- All 10 stories in Epic 1 will add to this monorepo structure
- Apps will include: orchestrator, video-studio, render-service, operator-cli
- Packages will include: core, news-sourcing, research, script-gen, pronunciation, tts, visual-gen, thumbnail, youtube, twitter, notifications, buffer

### Detected Conflicts or Variances

- None - this is the foundational story with no prior constraints

### References

- [Source: architecture.md#Starter-Template-Evaluation] - Turborepo selection rationale
- [Source: architecture.md#Project-Structure] - Complete directory structure
- [Source: architecture.md#Naming-Patterns] - Package naming conventions
- [Source: prd.md#Tech-Stack] - Runtime: Node.js / TypeScript
- [Source: epics.md#Story-1.1] - Original story requirements
- [Source: project-context.md#Technology-Stack] - Node.js 20.x LTS requirement

### Dependencies

- **Upstream Dependencies:** None (this is the first story)
- **Downstream Dependencies:** All subsequent stories in Epic 1 depend on this

### NFRs Addressed by This Story

- **NFR23:** Establishes foundation for encrypted credentials via GCP Secret Manager structure
- **NFR24:** Sets up environment variable patterns for credential rotation
- **NFR25:** Establishes logging infrastructure foundation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- Turborepo initialized via `pnpm dlx create-turbo@latest nexus-ai --package-manager pnpm`
- Removed default sample apps (docs, web) and UI package
- Configured turbo.json for Node.js backend (dist outputs instead of .next)
- Created tsconfig.base.json with strict mode, ES2022 target, NodeNext module
- Updated package.json with test/typecheck scripts and Node 20+ engine requirement
- Created .nvmrc with Node.js 20
- Created .env.example with NEXUS_ prefixed environment variables
- Verified pnpm install succeeds (245 packages installed)
- Verified pnpm build executes Turborepo pipeline successfully

### File List

**Created/Modified:**
- `nexus-ai/turbo.json` - Turborepo pipeline configuration
- `nexus-ai/tsconfig.base.json` - TypeScript base configuration
- `nexus-ai/package.json` - Root workspace package
- `nexus-ai/.nvmrc` - Node.js version specification
- `nexus-ai/.env.example` - Environment variable template
- `nexus-ai/apps/.gitkeep` - Placeholder for apps directory
- `nexus-ai/pnpm-workspace.yaml` - Workspace configuration (from starter)
- `nexus-ai/.gitignore` - Git ignore rules (from starter)

**Preserved from Starter:**
- `nexus-ai/packages/eslint-config/` - ESLint configuration package
- `nexus-ai/packages/typescript-config/` - TypeScript configuration package

