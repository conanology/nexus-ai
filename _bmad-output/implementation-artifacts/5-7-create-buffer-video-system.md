# Story 5.7: Create Buffer Video System

Status: ready-for-dev

## Story

As an operator,
I want emergency buffer videos that can be deployed when the pipeline fails,
So that the channel always publishes daily content and maintains reliability (NFR1).

## Acceptance Criteria

1. **Given** the orchestrator detects a pipeline failure (health check or stage critical failure)
   **When** the operator runs `nexus buffer deploy`
   **Then** an available buffer video is scheduled for publication at 2 PM UTC

2. **Given** a buffer video is deployed
   **When** the deployment completes
   **Then** the original failed topic is queued for processing the next day

3. **Given** the buffer video system
   **When** querying available buffers
   **Then** returns list of unused buffer videos from Firestore `buffer-videos` collection

4. **Given** NFR5 requirement (minimum 1 buffer video)
   **When** buffer count drops below 2
   **Then** a WARNING alert is sent via Discord

5. **Given** a buffer video is deployed
   **When** deployment completes successfully
   **Then** an incident is logged with resolution type "buffer_deployed"

6. **Given** buffer management functions
   **When** calling `createBuffer(topic)`
   **Then** generates and stores evergreen content in `buffer-videos/{id}`

7. **Given** buffer management functions
   **When** calling `getAvailableBuffers()`
   **Then** returns all buffers where `used: false` and `status: 'active'`

8. **Given** buffer management functions
   **When** calling `deployBuffer()`
   **Then** marks buffer as used, updates usedDate, and decrements available count

9. **Given** buffer management functions
   **When** calling `getBufferCount()`
   **Then** returns count of available (non-deployed) buffer videos

10. **Given** a buffer creation script
    **When** operator runs `scripts/create-buffer-video.ts`
    **Then** generates an evergreen video (topic selection, script, audio, visuals) and stores in `buffer-videos`

## Tasks / Subtasks

- [ ] Task 1: Create buffer types and constants (AC: 3, 6, 7, 8, 9)
  - [ ] Create `packages/core/src/buffer/types.ts` with BufferVideo interface
  - [ ] Define BufferVideoStatus type: 'active' | 'deployed' | 'archived'
  - [ ] Add BUFFER_THRESHOLDS constants (MINIMUM_COUNT: 1, WARNING_COUNT: 2)
  - [ ] Create BufferDeploymentResult interface
  - [ ] Create BufferHealthStatus interface for digest integration

- [ ] Task 2: Create buffer manager module (AC: 3, 6, 7, 8, 9)
  - [ ] Create `packages/core/src/buffer/manager.ts`
  - [ ] Implement `createBufferVideo(data: CreateBufferInput): Promise<BufferVideo>`
  - [ ] Implement `getBufferById(id: string): Promise<BufferVideo | null>`
  - [ ] Implement `listAvailableBuffers(): Promise<BufferVideo[]>` with caching
  - [ ] Implement `deployBuffer(id: string, forDate: string): Promise<BufferDeploymentResult>`
  - [ ] Implement `archiveBuffer(id: string): Promise<void>`
  - [ ] Add lazy Firestore initialization pattern

- [ ] Task 3: Create buffer selector module (AC: 1, 8)
  - [ ] Create `packages/core/src/buffer/selector.ts`
  - [ ] Implement `selectBufferForDeployment(): Promise<BufferVideo>` (FIFO - oldest first)
  - [ ] Implement `getBufferDeploymentCandidate(): Promise<BufferVideo | null>`

- [ ] Task 4: Create buffer monitor module (AC: 4, 9)
  - [ ] Create `packages/core/src/buffer/monitor.ts`
  - [ ] Implement `getBufferCount(): Promise<number>` with 5-min cache
  - [ ] Implement `getBufferHealthStatus(): Promise<BufferHealthStatus>`
  - [ ] Implement `getBufferSummaryForDigest(): Promise<BufferSummary>`
  - [ ] Add buffer count monitoring for health check integration

- [ ] Task 5: Add buffer error codes (AC: 1, 4, 5)
  - [ ] Add to `packages/core/src/errors/codes.ts`:
    - NEXUS_BUFFER_NOT_FOUND
    - NEXUS_BUFFER_DEPLOYMENT_FAILED
    - NEXUS_BUFFER_EXHAUSTED (count < 1)
    - NEXUS_BUFFER_CREATE_FAILED
    - NEXUS_BUFFER_INVALID_STATUS

- [ ] Task 6: Create buffer module exports (AC: all)
  - [ ] Create `packages/core/src/buffer/index.ts` with public exports
  - [ ] Add `./buffer` subpath to `packages/core/package.json` exports
  - [ ] Re-export buffer module from `packages/core/src/index.ts`

- [ ] Task 7: Integrate with orchestrator failure handler (AC: 1, 2, 5)
  - [ ] Update `apps/orchestrator/src/health/failure-handler.ts`
  - [ ] Implement `triggerBufferDeployment(pipelineId, healthResult)` function
  - [ ] Log incident with buffer deployment resolution
  - [ ] Queue original failed topic for next day

- [ ] Task 8: Integrate with notifications (AC: 4)
  - [ ] Update `packages/notifications/src/routing.ts` for buffer alerts
  - [ ] Add buffer count to daily digest health section
  - [ ] Implement buffer-deployed alert (WARNING severity)
  - [ ] Implement buffer-low alert (WARNING when count < 2)
  - [ ] Implement pipeline-failed-no-buffer alert (CRITICAL)

- [ ] Task 9: Create buffer creation script (AC: 6, 10)
  - [ ] Create `scripts/create-buffer-video.ts`
  - [ ] Accept topic parameter for evergreen content
  - [ ] Use existing pipeline stages (script-gen, tts, visual-gen, render, thumbnail)
  - [ ] Store result in Firestore `buffer-videos` collection
  - [ ] Seed initial 3-5 buffer videos with evergreen topics

- [ ] Task 10: Write comprehensive tests (AC: all)
  - [ ] `packages/core/src/buffer/__tests__/types.test.ts` - Constants, interface validation
  - [ ] `packages/core/src/buffer/__tests__/manager.test.ts` - CRUD with mocked Firestore
  - [ ] `packages/core/src/buffer/__tests__/selector.test.ts` - Selection logic, edge cases
  - [ ] `packages/core/src/buffer/__tests__/monitor.test.ts` - Count aggregation, health status
  - [ ] Integration tests for orchestrator failure → buffer deployment flow

## Dev Notes

### Critical Architecture Patterns (MUST FOLLOW)

**From project-context.md - MANDATORY:**

1. **Firestore Path**: `buffer-videos/{id}` - already defined in `packages/core/src/storage/paths.ts` (line 93)

2. **Error Handling Pattern**:
```typescript
try {
  // Firestore operation
} catch (error) {
  logger.error({ error }, 'Failed to deploy buffer video');
  throw NexusError.critical(
    'NEXUS_BUFFER_DEPLOYMENT_FAILED',
    `Failed to deploy buffer: ${error.message}`,
    'buffer'
  );
}
```

3. **Logger Naming Convention**: `nexus.core.buffer.{module}` (e.g., `nexus.core.buffer.manager`)

4. **Collection Constant Pattern** (from Story 5.6):
```typescript
const BUFFER_COLLECTION = 'buffer-videos';
```

5. **Lazy Firestore Initialization** (from Story 5.6):
```typescript
let firestoreClient: FirestoreClient | null = null;

function getFirestoreClient(): FirestoreClient {
  if (!firestoreClient) {
    firestoreClient = new FirestoreClient();
  }
  return firestoreClient;
}
```

6. **Query Caching Pattern** (from Story 5.6):
```typescript
const queryCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    queryCache.delete(key);
    return null;
  }
  return cached.data as T;
}

export function clearBufferCache(): void {
  queryCache.clear();
}
```

### Buffer Video Document Structure

**Firestore Path:** `buffer-videos/{id}`

```typescript
interface BufferVideo {
  // Core identification
  id: string;                          // UUID (auto-generated)
  videoId: string;                     // YouTube video ID (already uploaded)

  // Content metadata
  topic: string;                       // Evergreen topic (e.g., "Top 5 AI Papers This Week")
  title: string;                       // Video title (max 100 chars)
  description?: string;                // Video description snippet

  // Lifecycle tracking
  createdDate: string;                 // ISO 8601 UTC timestamp
  used: boolean;                       // Has buffer been deployed?
  usedDate?: string;                   // ISO 8601 UTC when deployed
  deploymentCount: number;             // Number of times deployed (typically 0 or 1)

  // Quality metadata
  durationSec: number;                 // Video length (typically 300-480 sec for 5-8 min)
  thumbnailPath?: string;              // Cloud Storage URL to thumbnail backup

  // Source/classification
  source: 'manual' | 'auto';           // How buffer was created
  evergreen: boolean;                  // Is this evergreen content (always true for buffers)

  // Status tracking
  status: 'active' | 'deployed' | 'archived';
  retirementDate?: string;             // When buffer was archived
}
```

### CRITICAL: Buffer Deployment is NOT Automatic

```typescript
// ❌ WRONG: Auto-deploy buffer on failure
if (error.severity === CRITICAL) {
  await bufferService.deployBuffer();  // DON'T DO THIS
}

// ✅ RIGHT: Alert operator, let them decide
if (error.severity === CRITICAL) {
  await alerts.sendCritical('Pipeline failed. Run: nexus buffer deploy');
  await incidents.logIncident({ /* ... */ });
  // Operator runs CLI command to deploy
}
```

### Integration with Orchestrator

**Primary Integration Point:** `apps/orchestrator/src/health/failure-handler.ts` (line 223)

Current placeholder exists:
```typescript
export async function triggerBufferDeployment(
  pipelineId: string,
  healthResult: HealthCheckResult
): Promise<void> {
  // Story 5.7 will implement:
  // - Query Firestore for available buffer videos
  // - Select appropriate buffer video
  // - Schedule YouTube publication (NOT upload - video already exists)
  // - Update buffer video inventory
  // - Log buffer deployment in incidents collection
  // - Queue original topic for next day
}
```

**Key Insight:** Buffer videos are PRE-PUBLISHED on YouTube (private/unlisted). Deployment only schedules them for public release. This means:
- NO upload needed during deployment
- Only `youtube.schedulePublish(videoId, PUBLISH_TIME)` call
- ~1,500 YouTube quota units (not 1,600 for full upload)

### Queue Failed Topic for Next Day

```typescript
// Queue with full metadata for debugging
await firestore.setDocument(`queued-topics/${nextDate}`, {
  topic: failedTopic,
  failureReason: error.code,
  failureStage: currentStage,
  originalDate: pipelineId,
  queuedDate: new Date().toISOString(),
  retryCount: 0,
  maxRetries: 2  // Max 2 retry attempts per topic (FR46)
});
```

### Testing Pattern (from Story 5.6)

**Mock Setup:**
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSetDocument = vi.fn();
const mockGetDocument = vi.fn();
const mockQueryDocuments = vi.fn();
const mockFirestoreClient = {
  setDocument: mockSetDocument,
  getDocument: mockGetDocument,
  queryDocuments: mockQueryDocuments,
};

vi.mock('../../storage/firestore-client.js', () => ({
  FirestoreClient: vi.fn(() => mockFirestoreClient),
}));
```

**Expected Test Count:** ~60-80 tests (based on Story 5.5: 91 tests, Story 5.6: 80 tests)

### Project Structure Notes

**New Files to Create:**
```
packages/core/src/buffer/
├── index.ts           # Public exports
├── types.ts           # Type definitions and constants
├── manager.ts         # Buffer CRUD operations
├── selector.ts        # Buffer selection logic (FIFO)
├── monitor.ts         # Buffer count and health monitoring
└── __tests__/
    ├── types.test.ts
    ├── manager.test.ts
    ├── selector.test.ts
    └── monitor.test.ts
```

**Files to Modify:**
- `packages/core/package.json` - Add `./buffer` subpath export
- `packages/core/src/index.ts` - Re-export buffer module
- `packages/core/src/errors/codes.ts` - Add buffer error codes
- `apps/orchestrator/src/health/failure-handler.ts` - Implement triggerBufferDeployment
- `packages/notifications/src/routing.ts` - Add buffer alert routing
- `packages/notifications/src/digest.ts` - Add buffer health to digest

### Evergreen Topic Suggestions for Initial Buffers

Per product brief requirements, seed with 3-5 buffer videos:
1. "Top 5 AI Research Papers This Week" (weekly roundup)
2. "Essential AI Tools Every Developer Should Know" (tool roundup)
3. "The State of Open Source AI in 2026" (ecosystem overview)
4. "Getting Started with AI Development: A Complete Guide" (tutorial)
5. "AI Ethics and Safety: What You Need to Know" (educational)

### Alert Routing Configuration

**From notifications/routing.ts pattern:**
```typescript
const BUFFER_ALERT_ROUTING = {
  'buffer-deployed': {
    severity: 'WARNING',
    channels: ['discord'],  // Not email - it's successful recovery
  },
  'buffer-low': {
    severity: 'WARNING',
    channels: ['discord', 'email'],  // Need operator action
  },
  'pipeline-failed-no-buffer': {
    severity: 'CRITICAL',
    channels: ['discord', 'email'],  // Emergency - no content today
  },
};
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#State-Persistence] - Firestore paths
- [Source: _bmad-output/planning-artifacts/prd.md#FR36-FR37] - Buffer video requirements
- [Source: _bmad-output/planning-artifacts/prd.md#NFR5] - Minimum 1 buffer requirement
- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.7] - Story acceptance criteria
- [Source: packages/core/src/storage/paths.ts:93] - getBufferVideoPath() helper exists
- [Source: apps/orchestrator/src/health/failure-handler.ts:223] - Integration placeholder
- [Source: _bmad-output/implementation-artifacts/5-6-implement-incident-logging.md] - Previous story patterns
- [Source: _bmad-output/project-context.md] - Critical rules and patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

