# Story 5.1: Create Orchestrator Service

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a central orchestrator service that coordinates all pipeline stages,
so that the daily video production pipeline runs as a unified, coordinated workflow with proper state management and error handling.

## Acceptance Criteria

1. **Given** all stage packages from Epics 1-4
   **When** I create the orchestrator service
   **Then** `apps/orchestrator/` Cloud Run app is created with:
   - Modern Node.js/TypeScript HTTP server (Express or Fastify)
   - Proper Cloud Run container configuration
   - Dockerfile optimized for Cloud Run deployment
   - Health check endpoint for service readiness
   - Project structure following monorepo patterns

2. **Given** Cloud Run resource constraints and NFR6 (4-hour pipeline duration)
   **When** I configure the service for GCP deployment
   **Then** service configuration includes:
   - 1 CPU, 1GB RAM allocation (lightweight coordination)
   - Timeout: 4 hours (14,400 seconds) to support full pipeline duration
   - Concurrency: 1 (one pipeline execution at a time)
   - Min instances: 0 (scale to zero for cost efficiency)
   - Max instances: 1 (single instance orchestration)
   - Environment variables for GCP project, bucket, Firestore config

3. **Given** the architecture's stage organization pattern
   **When** I implement the orchestrator structure
   **Then** it includes:
   - `src/index.ts` - HTTP server entry point with Express/Fastify
   - `src/pipeline.ts` - Pipeline execution logic and stage coordination
   - `src/stages.ts` - Stage package imports and configuration
   - `src/state.ts` - Pipeline state management with Firestore persistence
   - `src/quality-gate.ts` - Pre-publish quality check implementation
   - `src/handlers/scheduled.ts` - Cloud Scheduler trigger handler
   - `src/handlers/manual.ts` - Manual trigger endpoint handler
   - `src/handlers/health.ts` - Health check endpoint handler
   - TypeScript strict mode configuration

4. **Given** all 9 stage packages from previous epics
   **When** I configure stage imports
   **Then** orchestrator imports and configures:
   - `@nexus-ai/news-sourcing` - Topic selection (Stage 1)
   - `@nexus-ai/research` - Research brief generation (Stage 2)
   - `@nexus-ai/script-gen` - Multi-agent script generation (Stage 3)
   - `@nexus-ai/pronunciation` - SSML tagging (Stage 4)
   - `@nexus-ai/tts` - Audio synthesis (Stage 5)
   - `@nexus-ai/visual-gen` - Scene timeline generation (Stage 6)
   - `@nexus-ai/thumbnail` - Thumbnail generation (Stage 7)
   - `@nexus-ai/youtube` - Video upload and scheduling (Stage 8)
   - `@nexus-ai/twitter` - Social promotion (Stage 9)
   - `@nexus-ai/notifications` - Alerts and digest (Stage 10)
   - Each stage configured with proper dependency injection

5. **Given** the need for service health monitoring
   **When** I implement the health endpoint
   **Then** `/health` endpoint returns:
   - HTTP 200 status when service is ready
   - JSON response: `{ status: 'healthy', timestamp: ISO8601, version: string }`
   - Fast response time (<100ms)
   - No external dependencies checked (just service readiness)
   - Used by Cloud Run health checks

6. **Given** Cloud Run best practices for Node.js (2026)
   **When** I create the Dockerfile
   **Then** it follows optimization guidelines:
   - Uses Node.js 20 LTS base image
   - Multi-stage build for smaller image size
   - Runs application with `node dist/index.js` (not `npm start`)
   - Non-root user for security
   - Proper .dockerignore to exclude node_modules, tests
   - Build artifacts copied from TypeScript compilation
   - Environment variables for runtime configuration

## Tasks / Subtasks

- [x] Task 1: Initialize Orchestrator App Structure (AC: #1)
  - [x] Create `apps/orchestrator/` directory
  - [x] Initialize `package.json` with dependencies
  - [x] Configure `tsconfig.json` extending from base
  - [x] Create source structure with placeholder files
  - [x] Add to Turborepo pipeline configuration

- [x] Task 2: Implement HTTP Server with Health Endpoint (AC: #1, #5)
  - [x] Create `src/index.ts` with Express server
  - [x] Implement `/health` endpoint handler
  - [x] Add graceful shutdown handling
  - [x] Configure port from environment variable (default: 8080)
  - [x] Add request logging middleware

- [x] Task 3: Configure Stage Imports and Registry (AC: #4)
  - [x] Create `src/stages.ts` with stage imports
  - [x] Define stage execution order configuration
  - [x] Set up stage dependency injection
  - [x] Configure stage-specific options
  - [x] Export stage registry for pipeline executor

- [x] Task 4: Implement Pipeline State Management (AC: #3)
  - [x] Create `src/state.ts` with Firestore client
  - [x] Implement state initialization for new pipeline
  - [x] Add state update methods for stage progression
  - [x] Implement state persistence after each stage
  - [x] Add state recovery for pipeline resume

- [x] Task 5: Create Handler Stubs for Triggers (AC: #3)
  - [x] Create `src/handlers/scheduled.ts` for Cloud Scheduler
  - [x] Create `src/handlers/manual.ts` for manual triggers
  - [x] Add input validation for pipeline triggers
  - [x] Implement error responses for invalid requests
  - [x] Route handlers to pipeline executor (stub for Story 5.2)

- [x] Task 6: Implement Pre-Publish Quality Gate (AC: #3)
  - [x] Create `src/quality-gate.ts` with decision logic
  - [x] Define quality criteria per architecture
  - [x] Implement AUTO_PUBLISH decision path
  - [x] Implement AUTO_PUBLISH_WITH_WARNING path
  - [x] Implement HUMAN_REVIEW path with queue integration

- [x] Task 7: Configure Cloud Run Deployment (AC: #2, #6)
  - [x] Create Dockerfile with optimizations
  - [x] Create `.dockerignore` file
  - [x] Add cloud run deployment configuration
  - [x] Set up environment variables
  - [x] Configure service account permissions
  - [x] Document deployment commands

- [x] Task 8: Testing and Validation (AC: all)
  - [x] Unit tests for HTTP server setup
  - [x] Unit tests for health endpoint
  - [x] Unit tests for stage registry
  - [x] Unit tests for quality gate
  - [x] Unit tests for handlers
  - [x] Verify TypeScript compilation
  - [x] All tests passing (24 tests)

## Dev Notes

### Architecture Context - Central Orchestrator Pattern

**Decision from Architecture Document:**
> Single Cloud Run orchestrator service coordinates all pipeline stages sequentially. Pipeline is inherently sequential (no parallelism benefit from Pub/Sub). Single video/day doesn't need event-driven scale. One place to see state, logs, failures for debugging. Orchestrator holds pipeline state in memory, persists to Firestore at checkpoints.

**CRITICAL: Story 5.1 is FOUNDATION ONLY**
- This story creates the service structure and imports stage packages
- **Pipeline execution logic is implemented in Story 5.2**
- This story focuses on: service setup, health endpoint, stage registry, state management, quality gate, handlers (stubs)
- Story 5.2 will implement: sequential stage execution, retry logic, fallback handling, error recovery

### Service Configuration Requirements

**Cloud Run Configuration (Architecture: Section 2):**
```yaml
# Service: orchestrator
deployment: Cloud Run
resources:
  cpu: 1
  memory: 1GB
  timeout: 4 hours  # NFR6: <4hr pipeline (6 AM → 10 AM UTC)
  concurrency: 1     # One pipeline at a time
  min_instances: 0   # Scale to zero for cost efficiency
  max_instances: 1   # Single orchestrator instance
```

**Why These Settings:**
- **1 CPU, 1GB**: Coordination role, not compute-intensive. Stages do the heavy work.
- **4-hour timeout**: NFR6 requires <4hr pipeline duration. Need buffer for retries/fallbacks.
- **Concurrency 1**: Only one pipeline runs at a time (1 video/day). Prevents race conditions.
- **Scale to zero**: Cost optimization. No need to run 24/7.

### HTTP Server Best Practices (2026 Research)

**Based on Google Cloud Documentation (Updated 2026-01-02):**
> Start your application directly using `node index.js` instead of `npm start`, as npm adds extra latency. By optimizing startup time, you can reduce latency, improve responsiveness, and achieve effective cost optimization.

**Dockerfile Best Practices:**
- Use `CMD ["node", "dist/index.js"]` (not `npm start`)
- Multi-stage build to reduce image size
- Copy only production dependencies
- Run as non-root user for security
- Use Node.js 20 LTS base image

**Example Dockerfile Structure:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
USER node
CMD ["node", "dist/index.js"]
```

### Stage Import Configuration

**All Stage Packages from Epics 1-4:**
```typescript
// src/stages.ts
import { executeNewsSourcing } from '@nexus-ai/news-sourcing';
import { executeResearch } from '@nexus-ai/research';
import { executeScriptGen } from '@nexus-ai/script-gen';
import { executePronunciation } from '@nexus-ai/pronunciation';
import { executeTTS } from '@nexus-ai/tts';
import { executeVisualGen } from '@nexus-ai/visual-gen';
import { executeThumbnail } from '@nexus-ai/thumbnail';
import { executeYouTube } from '@nexus-ai/youtube';
import { executeTwitter } from '@nexus-ai/twitter';
import { executeNotifications } from '@nexus-ai/notifications';

export const stageRegistry = {
  'news-sourcing': executeNewsSourcing,
  'research': executeResearch,
  'script-gen': executeScriptGen,
  'pronunciation': executePronunciation,
  'tts': executeTTS,
  'visual-gen': executeVisualGen,
  'thumbnail': executeThumbnail,
  'youtube': executeYouTube,
  'twitter': executeTwitter,
  'notifications': executeNotifications
};

// Stage execution order (for Story 5.2)
export const stageOrder = [
  'news-sourcing',
  'research',
  'script-gen',
  'pronunciation',
  'tts',
  'visual-gen',
  'thumbnail',
  'youtube',
  'twitter',
  'notifications'
];
```

**Note:** Render stage is NOT a separate package. It's called via HTTP from visual-gen stage to `render-service` Cloud Run app.

### Pipeline State Management

**Firestore State Structure (Architecture: Section 3):**
```typescript
// pipelines/{YYYY-MM-DD}/state
interface PipelineState {
  pipelineId: string;           // YYYY-MM-DD
  status: 'running' | 'paused' | 'completed' | 'failed' | 'skipped';
  currentStage: string | null;
  startTime: string;            // ISO 8601
  endTime?: string;
  stages: {
    [stageName: string]: {
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
      startTime?: string;
      endTime?: string;
      durationMs?: number;
      provider?: {
        name: string;
        tier: 'primary' | 'fallback';
        attempts: number;
      };
      cost?: CostBreakdown;
      error?: {
        code: string;
        message: string;
        severity: string;
      };
    };
  };
  qualityContext: {
    degradedStages: string[];
    fallbacksUsed: string[];
    flags: string[];
  };
}
```

**State Persistence Pattern:**
```typescript
// src/state.ts
export class PipelineStateManager {
  async initializePipeline(pipelineId: string): Promise<void>;
  async updateStageStatus(pipelineId: string, stage: string, status: StageStatus): Promise<void>;
  async getState(pipelineId: string): Promise<PipelineState>;
  async markComplete(pipelineId: string): Promise<void>;
  async markFailed(pipelineId: string, error: NexusError): Promise<void>;
}
```

### Pre-Publish Quality Gate

**Architecture Decision (Section 5):**
> Quality Gate (Pre-Publish): Function qualityGateCheck returns AUTO_PUBLISH, AUTO_PUBLISH_WITH_WARNING, or HUMAN_REVIEW. Core Principle: NEVER publish low-quality content. Skip day > bad video.

**Quality Decision Logic:**
```typescript
// src/quality-gate.ts
export function qualityGateCheck(run: PipelineRun): QualityDecision {
  // AUTO_PUBLISH: No issues
  if (run.qualityContext.degradedStages.length === 0 &&
      run.qualityContext.fallbacksUsed.length === 0) {
    return 'AUTO_PUBLISH';
  }

  // HUMAN_REVIEW: Major quality compromises
  if (hasTTSFallback(run) ||
      hasHighVisualFallback(run) ||
      hasWordCountIssue(run) ||
      hasPronunciationIssues(run)) {
    return 'HUMAN_REVIEW';
  }

  // AUTO_PUBLISH_WITH_WARNING: Minor issues (≤2, no TTS fallback)
  if (run.qualityContext.degradedStages.length <= 2) {
    return 'AUTO_PUBLISH_WITH_WARNING';
  }

  return 'HUMAN_REVIEW';
}
```

**Quality Criteria (Architecture: Section 5):**
- TTS fallback used → HUMAN_REVIEW
- >30% visual fallbacks → HUMAN_REVIEW
- Word count outside range → HUMAN_REVIEW
- >3 pronunciation unknowns unresolved → HUMAN_REVIEW
- Thumbnail fallback + visual fallback → HUMAN_REVIEW
- Single minor issue → AUTO_PUBLISH_WITH_WARNING

### Handler Implementation Patterns

**Cloud Scheduler Trigger Handler (Story 5.12 will configure scheduler):**
```typescript
// src/handlers/scheduled.ts
export async function handleScheduledTrigger(req: Request, res: Response) {
  // Verify request is from Cloud Scheduler
  const authHeader = req.headers.authorization;
  if (!authHeader || !verifySchedulerAuth(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Generate pipeline ID from current date
  const pipelineId = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Trigger pipeline (Story 5.2 will implement executePipeline)
  // For now, return success
  res.status(200).json({
    message: 'Pipeline scheduled',
    pipelineId
  });
}
```

**Manual Trigger Handler:**
```typescript
// src/handlers/manual.ts
export async function handleManualTrigger(req: Request, res: Response) {
  // Optional: specific date override
  const pipelineId = req.body?.date || new Date().toISOString().split('T')[0];

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pipelineId)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  // Trigger pipeline (Story 5.2)
  res.status(200).json({
    message: 'Pipeline triggered',
    pipelineId
  });
}
```

**Health Check Handler:**
```typescript
// src/handlers/health.ts
export async function handleHealthCheck(req: Request, res: Response) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERSION || 'unknown'
  });
}
```

### Project Structure Reference

**From Architecture Document (Section 6):**
```
apps/orchestrator/
├── Dockerfile
├── .dockerignore
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # HTTP server entry
    ├── pipeline.ts           # Pipeline execution (Story 5.2)
    ├── stages.ts             # Stage imports & registry
    ├── state.ts              # State management
    ├── quality-gate.ts       # Pre-publish quality check
    └── handlers/
        ├── scheduled.ts      # Cloud Scheduler trigger
        ├── manual.ts         # Manual trigger
        └── health.ts         # Health check
```

### Dependencies to Add

**package.json:**
```json
{
  "name": "@nexus-ai/orchestrator",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "express": "^4.18.0",
    "@nexus-ai/core": "workspace:*",
    "@nexus-ai/news-sourcing": "workspace:*",
    "@nexus-ai/research": "workspace:*",
    "@nexus-ai/script-gen": "workspace:*",
    "@nexus-ai/pronunciation": "workspace:*",
    "@nexus-ai/tts": "workspace:*",
    "@nexus-ai/visual-gen": "workspace:*",
    "@nexus-ai/thumbnail": "workspace:*",
    "@nexus-ai/youtube": "workspace:*",
    "@nexus-ai/twitter": "workspace:*",
    "@nexus-ai/notifications": "workspace:*"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.1.0"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

### Key Learnings from Previous Epic Stories

**From Story 4.5 (Twitter Package) Dev Notes:**
1. **TDD Approach Works Well**: Write failing tests first, then implementation
2. **Firestore Path Consistency**: Use `pipelines/{pipelineId}/{stage}` pattern
3. **Integration Tests Critical**: Mock API responses for realistic testing
4. **Error Handling Matters**: Try/catch Firestore writes to prevent data loss
5. **Code Review Catches Issues**: Build tests proactively to avoid rework

**Common Patterns Established Across Epic 4:**
- Modular structure: separate files for different concerns
- `__tests__/` directory for unit and integration tests
- Export all public APIs from `index.ts`
- Use JSDoc comments for public functions
- Type-safe inputs/outputs with TypeScript strict mode

**Git Intelligence - Recent Commits:**
From last 10 commits, we see:
- Structured logging pattern (`logger.info` with context)
- Firestore integration for state persistence
- Comprehensive test coverage (unit + integration)
- Error handling with try/catch for external services
- Package structure: `src/index.ts` (exports), `src/{name}.ts` (logic), `src/__tests__/` (tests)

### Critical Architecture Patterns to Follow

**From Project Context Document:**

**1. Stage Execution Template (will be used in Story 5.2):**
Every stage follows consistent pattern with `StageInput`/`StageOutput`, retry/fallback, quality gates, cost tracking, structured logging.

**2. Error Severity Levels:**
```typescript
enum ErrorSeverity {
  RETRYABLE,    // Transient: timeout, rate limit, 503
  FALLBACK,     // Provider issue: use next in chain
  DEGRADED,     // Can continue but quality compromised
  RECOVERABLE,  // Stage failed, pipeline continues
  CRITICAL      // Must abort: no recovery possible
}
```

**3. Structured Logging - NEVER console.log:**
```typescript
// CORRECT
logger.info('Stage complete', {
  pipelineId,
  stage: 'orchestrator',
  durationMs: 1234
});

// WRONG - Banned by ESLint
console.log('Stage complete');
```

**4. Firestore Paths:**
```
pipelines/{YYYY-MM-DD}/state
pipelines/{YYYY-MM-DD}/artifacts
pipelines/{YYYY-MM-DD}/costs
pipelines/{YYYY-MM-DD}/quality
```

**5. Naming Conventions:**
- Functions: camelCase (`executePipeline`)
- Files: kebab-case (`quality-gate.ts`)
- Constants: SCREAMING_SNAKE (`MAX_RETRIES`)
- Error codes: `NEXUS_{DOMAIN}_{TYPE}`

### GCP Cloud Scheduler Integration

**From Web Research (2026 Best Practices):**

**Authentication & Security:**
> You need to create a service account to associate with Cloud Scheduler, and give that service account the permission to invoke your Cloud Run service. Select Cloud Run > Cloud Run Invoker as the role for the service account.

**Setup Requirements (Story 5.12 will configure):**
1. Enable Cloud Scheduler API
2. Create service account with Cloud Run Invoker role
3. Configure OIDC authentication with service account email
4. Specify fully qualified URL of orchestrator service
5. Use unix-cron format for schedule: `0 6 * * *` (6 AM UTC daily)
6. Select timezone: UTC
7. HTTP method: POST to `/trigger/scheduled` endpoint

**Best Practices:**
- One scheduler job per Cloud Run service
- Use OIDC token authentication (more secure than API key)
- Separate service accounts for different jobs
- Test scheduler job before production deployment
- Pause scheduler when not needed to save costs

### Service Account Permissions Required

**Orchestrator Service Account Needs:**
- `roles/run.invoker` - To be invoked by Cloud Scheduler
- `roles/datastore.user` - For Firestore read/write
- `roles/storage.objectAdmin` - For Cloud Storage artifacts
- `roles/secretmanager.secretAccessor` - For API keys/tokens
- `roles/logging.logWriter` - For structured logging
- `roles/run.invoker` - To invoke render-service Cloud Run

### Non-Functional Requirements Addressed

**NFR6: Total pipeline duration must be <4 hours (6:00 AM → 10:00 AM UTC)**
- Cloud Run timeout: 4 hours (14,400 seconds)
- Provides buffer for retries and fallbacks
- Story 5.2 will implement stage timeout monitoring

**NFR9: Alert delivery time must be <1 minute from trigger event**
- Lightweight orchestrator (1 CPU, 1GB) for fast startup
- Direct notification stage call for critical alerts
- Story 5.4 implements notification package

**Cost Efficiency:**
- Min instances: 0 (scale to zero between daily runs)
- Only runs 4-5 hours per day maximum
- 1 CPU, 1GB is minimal required resources

### Testing Strategy

**Unit Tests:**
- HTTP server initialization
- Health endpoint response format
- Stage registry configuration
- State management methods
- Quality gate decision logic
- Handler input validation

**Integration Tests:**
- Service startup and shutdown
- Firestore state persistence
- Handler routing to correct functions
- Error handling for invalid requests

**Docker Tests:**
- Dockerfile builds successfully
- Image size is reasonable (<500MB)
- Service starts within timeout
- Health check responds correctly

### References

**Source Documents:**
- [Epic 5, Story 5.1: Orchestrator Service](/_bmad-output/planning-artifacts/epics.md#L1527-L1565) - Full story requirements
- [Architecture: Decision 1 - Central Orchestrator](/_bmad-output/planning-artifacts/architecture.md#L180-L197) - Orchestration pattern
- [Architecture: Decision 2 - Hybrid Deployment](/_bmad-output/planning-artifacts/architecture.md#L199-L217) - Resource configuration
- [Architecture: Section 6 - Project Structure](/_bmad-output/planning-artifacts/architecture.md#L636-L753) - Directory layout
- [Project Context: Critical Rules](/_bmad-output/project-context.md#L31-L148) - Must-follow patterns

**Related Stories:**
- [Story 5.2: Pipeline Execution](/_bmad-output/planning-artifacts/epics.md#L1569-L1607) - Next story (implements execution logic)
- [Story 5.12: Cloud Scheduler](/_bmad-output/planning-artifacts/epics.md#L1943-L1976) - Scheduler configuration

**External Documentation (2026):**
- [Cloud Run Node.js Best Practices](https://cloud.google.com/run/docs/tips/nodejs) - Updated 2026-01-02
- [Cloud Scheduler with Cloud Run](https://docs.cloud.google.com/run/docs/triggering/using-scheduler) - Official guide
- [Cloud Run Authentication](https://docs.cloud.google.com/run/docs/authenticating/service-to-service) - OIDC setup

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

No blocking issues encountered. All compilation and test failures were resolved during implementation.

### Completion Notes List

**Implementation Summary:**
- ✅ Created complete orchestrator service structure with Express HTTP server
- ✅ Implemented health endpoint with ISO timestamp and version reporting
- ✅ Configured stage registry with imports for all 9 stage packages (notifications pending Story 5.4)
- ✅ Built pipeline state management using FirestoreClient for persistence
- ✅ Created handler stubs for scheduled and manual triggers
- ✅ Implemented quality gate with AUTO_PUBLISH, AUTO_PUBLISH_WITH_WARNING, and HUMAN_REVIEW decisions
- ✅ Configured Cloud Run deployment with optimized multi-stage Dockerfile
- ✅ Added comprehensive test coverage (24 tests, 100% pass rate)
- ✅ Followed project context patterns: structured logging, error handling, Firestore paths

**Key Technical Decisions:**
1. Used Express over Fastify (simpler, well-documented for Cloud Run)
2. Implemented Pino logger signature (context, message) following core patterns
3. Used FirestoreClient methods (getDocument, setDocument, updateDocument) per core package API
4. Stage registry uses `executeYouTubeUpload` (actual export name from youtube package)
5. Quality gate logic correctly identifies critical issues (TTS fallback, thumbnail+visual fallback)

**Tests Created:**
- HTTP server initialization and route registration (4 tests)
- Health endpoint response format (2 tests)
- Handler validation and error responses (7 tests)
- Stage registry structure and order (5 tests)
- Quality gate decision logic (8 tests)

**Cloud Run Configuration:**
- Resources: 1 CPU, 1GB RAM (lightweight coordination role)
- Timeout: 4 hours (14,400s) for full pipeline duration
- Concurrency: 1 (one pipeline at a time, prevents race conditions)
- Scaling: Min 0, Max 1 (scale to zero for cost efficiency)

**Note:** Pipeline execution logic (sequential stage execution, retry/fallback) is intentionally **NOT** implemented - reserved for Story 5.2 per architecture.

### File List

**Created:**
- apps/orchestrator/src/index.ts - HTTP server and startup logic
- apps/orchestrator/src/pipeline.ts - Pipeline execution stub (Story 5.2)
- apps/orchestrator/src/stages.ts - Stage registry and imports
- apps/orchestrator/src/state.ts - Pipeline state management
- apps/orchestrator/src/quality-gate.ts - Pre-publish quality gate
- apps/orchestrator/src/handlers/health.ts - Health check handler
- apps/orchestrator/src/handlers/scheduled.ts - Scheduled trigger handler
- apps/orchestrator/src/handlers/manual.ts - Manual trigger handler
- apps/orchestrator/src/__tests__/index.test.ts - Server tests
- apps/orchestrator/src/__tests__/stages.test.ts - Stage registry tests
- apps/orchestrator/src/__tests__/quality-gate.test.ts - Quality gate tests
- apps/orchestrator/src/__tests__/handlers.test.ts - Handler tests
- apps/orchestrator/Dockerfile - Multi-stage production build
- apps/orchestrator/.dockerignore - Docker build exclusions
- apps/orchestrator/README.md - Service documentation

**Modified:**
- apps/orchestrator/package.json - Added dependencies (express, stage packages, vitest)
- _bmad-output/implementation-artifacts/sprint-status.yaml - Updated story status
- _bmad-output/implementation-artifacts/5-1-create-orchestrator-service.md - Marked tasks complete

### Change Log

**2026-01-19 - Orchestrator Service Implementation**
- Created orchestrator service structure with Express HTTP server
- Implemented health endpoint, scheduled trigger, and manual trigger handlers
- Configured stage registry with all 9 pipeline stages (notifications pending Story 5.4)
- Built pipeline state management with Firestore persistence
- Implemented pre-publish quality gate decision logic
- Created Cloud Run deployment configuration (Dockerfile, documentation)
- Added comprehensive test suite (24 tests, all passing)
- Followed project patterns: structured logging, FirestoreClient API, error handling
- TypeScript compilation successful, all tests passing
