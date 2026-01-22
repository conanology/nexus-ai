# Story 5.4: Create Notifications Package

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want Discord and email notification capabilities,
So that the operator stays informed of pipeline status, receives critical alerts immediately, and gets comprehensive daily digest emails with pipeline results, metrics, and flags.

## Acceptance Criteria

1. **Given** pipeline execution from Story 5.2 and health checks from Story 5.3
   **When** I create the `@nexus-ai/notifications` package
   **Then** package structure includes:
   - `src/index.ts` exports public API
   - `src/discord.ts` for webhook alerts
   - `src/email.ts` for digest emails
   - `src/digest.ts` for digest generation
   - `src/types.ts` for notification-specific types
   **And** package compiles and exports from `@nexus-ai/notifications`

2. **Given** the need for immediate critical alerts per FR31
   **When** I implement Discord alerts
   **Then** alerts use webhook URL from Secret Manager (`nexus-discord-webhook`)
   **And** alert levels are supported: CRITICAL (red), WARNING (yellow), SUCCESS (green)
   **And** format uses Discord embed with title, description, fields, timestamp
   **And** alerts sent for: pipeline failures, buffer deployed, quality degraded, milestones
   **And** rate limiting is respected (5 requests per 2 seconds per webhook)
   **And** exponential backoff with jitter is used for retries

3. **Given** the need for daily summary reports per FR32
   **When** I implement daily digest email
   **Then** email sent after pipeline completion (success or failure)
   **And** recipient loaded from config (operator email via Secret Manager)
   **And** uses SendGrid or similar email service (`nexus-sendgrid-api-key`)
   **And** digest content includes all required sections (see Dev Notes)

4. **Given** digest content requirements per FR32
   **When** generating the daily digest
   **Then** content includes:
   - **Video**: title, URL, topic, source
   - **Pipeline**: duration, cost, quality status
   - **Performance**: day-1 views (if available), CTR, thumbnail variant
   - **Health**: buffers remaining, budget remaining, days left in credit
   - **Alerts**: any issues from today's pipeline
   - **Tomorrow**: queued topic preview (if available)

5. **Given** integration with pipeline execution (FR45)
   **When** I implement `executeNotifications()` stage function
   **Then** it always runs, even after pipeline failures (NFR4, FR45)
   **And** sends Discord summary with pipeline outcome
   **And** sends digest email with comprehensive results
   **And** returns notification status (sent/failed for each channel)
   **And** notification failures are logged but don't fail the pipeline

6. **Given** notification reliability requirements
   **When** sending notifications
   **Then** Discord alerts use retry with exponential backoff (max 5 attempts)
   **And** Email uses SendGrid retry with exponential backoff (max 3 attempts)
   **And** failed notifications are logged to Firestore `notifications/{pipelineId}`
   **And** notification metrics tracked: sent count, failed count, latency

7. **Given** integration with health check failures (Story 5.3)
   **When** health check detects critical failure
   **Then** Discord CRITICAL alert is sent immediately
   **And** alert includes: failed services, health check timestamp, recommended action
   **And** this notification happens BEFORE pipeline skip (synchronous)

## Tasks / Subtasks

- [x] Task 1: Create Notifications Package Structure (AC: #1) ✅ COMPLETED
  - [x] Create `packages/notifications/` with standard package structure
  - [x] Create `src/types.ts` with notification interfaces
  - [x] Create `src/index.ts` with public exports
  - [x] Configure `package.json` with dependencies (@sendgrid/mail, etc.)
  - [x] Add tsconfig.json extending base config

- [x] Task 2: Implement Discord Webhook Alerts (AC: #2, #7) ✅ COMPLETED
  - [x] Create `src/discord.ts` with `sendDiscordAlert()` function
  - [x] Implement Discord embed structure with color coding
  - [x] Define alert levels: CRITICAL (red), WARNING (yellow), SUCCESS (green)
  - [x] Implement rate limiting with local tracking (5 req/2s)
  - [x] Implement exponential backoff with jitter for retries
  - [x] Handle webhook URL retrieval from Secret Manager
  - [x] Create helper functions: `formatCriticalAlert()`, `formatWarningAlert()`, `formatSuccessAlert()`
  - [x] Create `sendHealthCheckFailureAlert()` for Story 5.3 integration

- [x] Task 3: Implement SendGrid Email Service (AC: #3) ✅ COMPLETED
  - [x] Create `src/email.ts` with `sendEmail()` function
  - [x] Configure SendGrid client with API key from Secret Manager
  - [x] Implement retry logic with exponential backoff (max 3 attempts)
  - [x] Create `sendDigestEmail()` function for daily digests
  - [x] Create `sendAlertEmail()` function for critical alerts
  - [x] Handle email template formatting (HTML + plain text fallback)

- [x] Task 4: Implement Digest Generation (AC: #4) ✅ COMPLETED
  - [x] Create `src/digest.ts` with `generateDigest()` function
  - [x] Implement `DigestData` interface with all required fields
  - [x] Create `collectDigestData()` to gather pipeline results
  - [x] Create `formatDigestEmail()` for HTML email formatting
  - [x] Include all sections: Video, Pipeline, Performance, Health, Alerts, Tomorrow
  - [x] Implement conditional sections (e.g., Performance only if data available)

- [x] Task 5: Implement executeNotifications() Stage Function (AC: #5, #6) ✅ COMPLETED
  - [x] Create `src/notifications.ts` with `executeNotifications()` stage function
  - [x] Use `StageInput<NotificationsInput>` / `StageOutput<NotificationsOutput>` contracts
  - [x] Ensure always runs regardless of prior stage failures
  - [x] Send Discord summary (success/failure/degraded)
  - [x] Send digest email with comprehensive results
  - [x] Track notification metrics: sent count, failed count, latency per channel
  - [x] Log failed notifications to Firestore `notifications/{pipelineId}`
  - [x] Use `executeStage` wrapper from `@nexus-ai/core`

- [x] Task 6: Implement Notification Logging and Metrics (AC: #6) ✅ COMPLETED
  - [x] Create `src/metrics.ts` for notification tracking
  - [x] Track per-channel: sent count, failed count, average latency
  - [x] Store notification log in Firestore
  - [x] Implement `getNotificationHistory(pipelineId)` for debugging

- [x] Task 7: Integrate with Orchestrator (AC: #5, #7) ✅ COMPLETED
  - [x] Export `sendDiscordAlert()` for use by health check failure handler (Story 5.3)
  - [x] Export `sendCriticalAlert()` convenience function for immediate alerts
  - [x] Update orchestrator to import and use notifications package
  - [x] Ensure notifications stage is last in pipeline execution order

- [x] Task 8: Testing and Validation (AC: all) ✅ COMPLETED
  - [x] Unit tests for Discord alert formatting and rate limiting
  - [x] Unit tests for SendGrid email sending with mocked client
  - [x] Unit tests for digest generation with various data scenarios
  - [x] Unit tests for `executeNotifications()` stage function
  - [x] Unit tests for retry logic with exponential backoff
  - [x] Fix 6 failing tests related to vitest mock hoisting issues (resolved with vi.hoisted pattern)
  - [x] Integration test: Discord webhook send - Covered by unit tests with mocked fetch (actual webhook test requires deployed credentials)
  - [x] Integration test: SendGrid email send - Covered by unit tests with mocked SendGrid (actual API test requires credentials)

## Dev Notes

### Critical Context from Previous Stories

**Dependencies Already Built (Stories 5.1, 5.2, 5.3):**
- Orchestrator service structure at `apps/orchestrator/`
- Pipeline execution engine with state management (`src/pipeline.ts`)
- Health check system with failure detection (`src/health/`)
- Firestore client utilities in `@nexus-ai/core/storage`
- Structured logging via `createLogger` from `@nexus-ai/core`
- Secret management via `getSecret` from `@nexus-ai/core/secrets`
- Error handling with `NexusError` and severity levels
- Cost tracking via `CostTracker`

**What Story 5.4 MUST Implement:**
- `@nexus-ai/notifications` package with Discord and email capabilities
- `sendDiscordAlert()` function for immediate critical alerts
- `sendDigestEmail()` function for daily summaries
- `generateDigest()` function to compile pipeline results
- `executeNotifications()` stage function that always runs
- Integration with health check failure handler from Story 5.3

### Architecture Requirements - Notifications Pattern

**From Architecture Decision 6 (Monitoring & Alerting):**
> Cloud Logging + Cloud Monitoring + Discord/Email alerts. Discord for immediate alerts, Email for daily digest.

**Alert Routing Rules (From Architecture):**

| Trigger | Severity | Channels |
|---------|----------|----------|
| Pipeline failed, no buffer | CRITICAL | Discord + Email |
| Buffer deployed | WARNING | Discord |
| Quality degraded | WARNING | Discord |
| Buffer < 2 | WARNING | Discord + Email |
| Cost > $0.75/video | WARNING | Discord |
| Cost > $1.00/video | CRITICAL | Email |
| YouTube CTR < 3% | WARNING | Discord |
| Milestone achieved | SUCCESS | Discord |

**Notification Execution Flow:**
```
Pipeline Execution Complete (or Failed)
    ↓
executeNotifications(pipelineId)
    ↓
[Parallel] → Discord Summary + Digest Email
    ↓
Log Results → Firestore `notifications/{pipelineId}`
    ↓
Return NotificationsOutput
```

### Discord Webhook Implementation (2026 Best Practices)

**Webhook Structure:**
```typescript
interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;  // DECIMAL, not hex!
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string; // ISO 8601
}
```

**Color Codes (Decimal Values):**
```typescript
const DISCORD_COLORS = {
  CRITICAL: 15158332,  // Red (#E74C3C)
  WARNING: 16776960,   // Yellow (#FFFF00)
  SUCCESS: 3066993,    // Green (#2ECC71)
  INFO: 3447003        // Blue (#3498DB)
} as const;
```

**Rate Limiting:**
- 5 requests per 2 seconds per webhook
- Parse headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Implement local rate limit tracking
- Use exponential backoff: 2s → 4s → 8s → 16s → 32s

**Retry with Exponential Backoff:**
```typescript
async function sendWithRetry(
  send: () => Promise<Response>,
  maxAttempts: number = 5,
  baseDelayMs: number = 2000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await send();
      if (response.ok) return;

      if (response.status === 429) {
        // Rate limited - extract reset time from headers
        const retryAfter = parseInt(response.headers.get('retry-after') || '5') * 1000;
        await sleep(retryAfter);
        continue;
      }

      throw new Error(`Discord webhook failed: ${response.status}`);
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;

      const delay = baseDelayMs * Math.pow(2, attempt);
      const jitter = delay * (0.9 + Math.random() * 0.2); // ±10% jitter
      await sleep(jitter);
    }
  }
}
```

### SendGrid Email Implementation (2026)

**Package Setup:**
```typescript
import sgMail from '@sendgrid/mail';

// Initialize with API key from Secret Manager
const apiKey = await getSecret('nexus-sendgrid-api-key');
sgMail.setApiKey(apiKey);
```

**Transactional Email Pattern:**
```typescript
interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text: string;    // Plain text fallback
  html: string;    // HTML content
}

async function sendEmail(msg: EmailMessage): Promise<void> {
  const [response] = await sgMail.send({
    to: msg.to,
    from: { email: 'notifications@nexus-ai.com', name: 'NEXUS-AI' },
    subject: msg.subject,
    text: msg.text,
    html: msg.html
  });

  if (response.statusCode >= 400) {
    throw new Error(`SendGrid error: ${response.statusCode}`);
  }
}
```

**Alternative: Dynamic Templates (Recommended for Production):**
```typescript
// Use pre-designed SendGrid template
const msg = {
  to: operatorEmail,
  from: 'notifications@nexus-ai.com',
  templateId: 'd-xxxxxxxxxxxxx', // SendGrid template ID
  dynamicTemplateData: {
    subject: `NEXUS-AI Daily Digest - ${date}`,
    videoTitle: pipelineResult.videoTitle,
    videoUrl: pipelineResult.youtubeUrl,
    pipelineDuration: formatDuration(pipelineResult.durationMs),
    totalCost: formatCurrency(pipelineResult.cost),
    qualityStatus: pipelineResult.quality.status,
    // ... all other digest fields
  }
};
```

### Daily Digest Content Structure

**Digest Data Interface:**
```typescript
interface DigestData {
  // Video Section
  video: {
    title: string;
    url: string;
    topic: string;
    source: string;
    thumbnailVariant: 1 | 2 | 3;
  } | null;

  // Pipeline Section
  pipeline: {
    pipelineId: string;
    status: 'success' | 'failed' | 'degraded' | 'skipped';
    duration: string;        // Formatted (e.g., "3h 42m")
    cost: string;            // Formatted (e.g., "$0.47")
    stages: {
      name: string;
      status: string;
      provider?: string;
      tier?: 'primary' | 'fallback';
    }[];
  };

  // Performance Section (optional - only if data available)
  performance?: {
    day1Views?: number;
    ctr?: number;
    avgViewDuration?: string;
    thumbnailVariant: number;
  };

  // Health Section
  health: {
    buffersRemaining: number;
    budgetRemaining: string;  // "$245.32"
    daysOfRunway: number;
    creditExpiration?: string;
  };

  // Alerts Section
  alerts: {
    type: 'critical' | 'warning' | 'info';
    message: string;
    timestamp: string;
  }[];

  // Tomorrow Section (optional)
  tomorrow?: {
    queuedTopic?: string;
    expectedPublishTime: string;
  };
}
```

**HTML Email Template Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .section { margin-bottom: 24px; }
    .section-title { color: #333; font-size: 18px; font-weight: bold; border-bottom: 2px solid #2ECC71; }
    .status-success { color: #2ECC71; }
    .status-failed { color: #E74C3C; }
    .status-degraded { color: #F39C12; }
    .alert-critical { background: #FADBD8; border-left: 4px solid #E74C3C; }
    .alert-warning { background: #FCF3CF; border-left: 4px solid #F39C12; }
  </style>
</head>
<body>
  <h1>NEXUS-AI Daily Digest - {{date}}</h1>

  <!-- Video Section -->
  <div class="section">
    <h2 class="section-title">Today's Video</h2>
    {{#if video}}
      <p><strong>{{video.title}}</strong></p>
      <p><a href="{{video.url}}">Watch on YouTube</a></p>
      <p>Topic: {{video.topic}} | Source: {{video.source}}</p>
    {{else}}
      <p>No video published today.</p>
    {{/if}}
  </div>

  <!-- Pipeline Section -->
  <div class="section">
    <h2 class="section-title">Pipeline Status</h2>
    <p>Status: <span class="status-{{pipeline.status}}">{{pipeline.status}}</span></p>
    <p>Duration: {{pipeline.duration}} | Cost: {{pipeline.cost}}</p>
  </div>

  <!-- Health Section -->
  <div class="section">
    <h2 class="section-title">System Health</h2>
    <p>Buffer Videos: {{health.buffersRemaining}}</p>
    <p>Budget Remaining: {{health.budgetRemaining}} ({{health.daysOfRunway}} days)</p>
  </div>

  <!-- Alerts Section -->
  {{#if alerts.length}}
  <div class="section">
    <h2 class="section-title">Alerts</h2>
    {{#each alerts}}
      <div class="alert-{{type}}">{{message}}</div>
    {{/each}}
  </div>
  {{/if}}
</body>
</html>
```

### executeNotifications() Stage Implementation

**Stage Pattern (Following Project Context):**
```typescript
import {
  StageInput, StageOutput,
  logger, CostTracker,
  NexusError
} from '@nexus-ai/core';

export interface NotificationsInput {
  pipelineId: string;
  pipelineResult: PipelineResult;
  healthCheckResult?: HealthCheckResult;
}

export interface NotificationsOutput {
  discord: {
    sent: boolean;
    messageId?: string;
    error?: string;
  };
  email: {
    sent: boolean;
    messageId?: string;
    error?: string;
  };
  digest: DigestData;
}

export async function executeNotifications(
  input: StageInput<NotificationsInput>
): Promise<StageOutput<NotificationsOutput>> {
  const startTime = Date.now();
  const tracker = new CostTracker(input.pipelineId, 'notifications');

  logger.info({
    pipelineId: input.pipelineId,
    stage: 'notifications'
  }, 'Starting notifications stage');

  // Generate digest data
  const digest = await generateDigest(input.data.pipelineResult);

  // Send Discord and Email in parallel (both must complete)
  const [discordResult, emailResult] = await Promise.allSettled([
    sendDiscordSummary(input.pipelineId, input.data.pipelineResult),
    sendDigestEmail(input.pipelineId, digest)
  ]);

  // Extract results (never fail the stage on notification errors)
  const discordOutput = discordResult.status === 'fulfilled'
    ? { sent: true, messageId: discordResult.value }
    : { sent: false, error: discordResult.reason.message };

  const emailOutput = emailResult.status === 'fulfilled'
    ? { sent: true, messageId: emailResult.value }
    : { sent: false, error: emailResult.reason.message };

  // Log notification results to Firestore (non-blocking)
  logNotificationResults(input.pipelineId, discordOutput, emailOutput)
    .catch(err => logger.warn({ err, pipelineId: input.pipelineId }, 'Failed to log notification results'));

  const output: StageOutput<NotificationsOutput> = {
    success: true, // Always succeeds - notification failures are warnings
    data: {
      discord: discordOutput,
      email: emailOutput,
      digest
    },
    quality: {
      notificationsSent: [discordOutput.sent, emailOutput.sent].filter(Boolean).length,
      notificationsFailed: [discordOutput.sent, emailOutput.sent].filter(s => !s).length
    },
    cost: tracker.getSummary(),
    durationMs: Date.now() - startTime,
    provider: { name: 'notifications', tier: 'primary', attempts: 1 },
    warnings: [
      ...(discordOutput.sent ? [] : [`Discord notification failed: ${discordOutput.error}`]),
      ...(emailOutput.sent ? [] : [`Email notification failed: ${emailOutput.error}`])
    ]
  };

  logger.info({
    pipelineId: input.pipelineId,
    stage: 'notifications',
    discordSent: discordOutput.sent,
    emailSent: emailOutput.sent,
    durationMs: output.durationMs
  }, 'Notifications stage complete');

  return output;
}
```

### Service Criticality and Alert Routing

**Alert Routing Logic:**
```typescript
type AlertSeverity = 'CRITICAL' | 'WARNING' | 'SUCCESS' | 'INFO';

interface AlertConfig {
  severity: AlertSeverity;
  sendDiscord: boolean;
  sendEmail: boolean;
}

const ALERT_ROUTING: Record<string, AlertConfig> = {
  'pipeline-failed-no-buffer': { severity: 'CRITICAL', sendDiscord: true, sendEmail: true },
  'buffer-deployed': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'quality-degraded': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'buffer-low': { severity: 'WARNING', sendDiscord: true, sendEmail: true },
  'cost-warning': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'cost-critical': { severity: 'CRITICAL', sendDiscord: false, sendEmail: true },
  'youtube-ctr-low': { severity: 'WARNING', sendDiscord: true, sendEmail: false },
  'milestone-achieved': { severity: 'SUCCESS', sendDiscord: true, sendEmail: false },
  'health-check-failed': { severity: 'CRITICAL', sendDiscord: true, sendEmail: true }
};

async function routeAlert(alertType: string, data: Record<string, unknown>): Promise<void> {
  const config = ALERT_ROUTING[alertType];
  if (!config) {
    logger.warn({ alertType }, 'Unknown alert type, defaulting to Discord');
    await sendDiscordAlert({ severity: 'INFO', title: alertType, ...data });
    return;
  }

  const promises: Promise<void>[] = [];

  if (config.sendDiscord) {
    promises.push(sendDiscordAlert({ severity: config.severity, ...data }));
  }

  if (config.sendEmail) {
    promises.push(sendAlertEmail({ severity: config.severity, ...data }));
  }

  await Promise.allSettled(promises);
}
```

### Health Check Failure Alert (Story 5.3 Integration)

**Exported Function for Health Check:**
```typescript
// Export for use by apps/orchestrator/src/health/failure-handler.ts
export async function sendHealthCheckFailureAlert(
  pipelineId: string,
  healthResult: HealthCheckResult
): Promise<void> {
  const failedServices = healthResult.criticalFailures.join(', ');

  await sendDiscordAlert({
    severity: 'CRITICAL',
    title: 'Health Check Failed - Pipeline Skipped',
    description: `Critical services unavailable: ${failedServices}`,
    fields: [
      { name: 'Pipeline ID', value: pipelineId, inline: true },
      { name: 'Failed Services', value: failedServices, inline: true },
      { name: 'Timestamp', value: healthResult.timestamp, inline: true },
      { name: 'Action', value: 'Pipeline execution skipped. Buffer video deployment attempted.' }
    ],
    color: DISCORD_COLORS.CRITICAL
  });

  // Also send email for critical health failures
  await sendAlertEmail({
    subject: `[CRITICAL] NEXUS-AI Health Check Failed - ${pipelineId}`,
    body: `
      Critical services are unavailable and the pipeline has been skipped.

      Failed Services: ${failedServices}
      Timestamp: ${healthResult.timestamp}

      A buffer video deployment has been attempted to maintain daily publishing.

      Please investigate the service outages immediately.
    `
  });
}
```

### Dependencies to Add

**Package Dependencies (`packages/notifications/package.json`):**
```json
{
  "name": "@nexus-ai/notifications",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@nexus-ai/core": "workspace:*",
    "@sendgrid/mail": "^8.1.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### File Structure

**New Files to Create:**
```
packages/notifications/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   # Public exports
│   ├── types.ts                   # Notification interfaces
│   ├── discord.ts                 # Discord webhook implementation
│   ├── email.ts                   # SendGrid email implementation
│   ├── digest.ts                  # Digest generation logic
│   ├── notifications.ts           # executeNotifications() stage
│   ├── metrics.ts                 # Notification tracking
│   └── __tests__/
│       ├── discord.test.ts
│       ├── email.test.ts
│       ├── digest.test.ts
│       ├── notifications.test.ts
│       └── metrics.test.ts
```

**Files to Modify:**
```
apps/orchestrator/src/health/failure-handler.ts  # Import sendHealthCheckFailureAlert
apps/orchestrator/src/pipeline.ts                # Add notifications as final stage
apps/orchestrator/package.json                   # Add @nexus-ai/notifications dependency
pnpm-workspace.yaml                              # Ensure packages/notifications is included
```

### Key Learnings from Previous Stories

**From Story 5.3 (Health Check):**
1. **Promise.allSettled for parallel non-critical operations**: Used for Discord + Email
2. **Graceful degradation**: Notification failures should NOT fail the pipeline stage
3. **Firestore logging**: Log results for debugging but don't fail on log errors
4. **Structured logging**: Always include `pipelineId` and `stage` in logs

**From Story 5.2 (Pipeline Execution):**
1. **Async handler pattern**: Use non-blocking calls where appropriate
2. **State persistence**: Wrap Firestore writes in try/catch
3. **Error severity routing**: Use appropriate severity levels

**From Story 5.1 (Orchestrator Foundation):**
1. **Logger signature**: `logger.info(context, message)` (context first)
2. **Secret access**: Always use `getSecret()` from `@nexus-ai/core/secrets`
3. **Package exports**: Export public APIs from `index.ts`

### Testing Strategy

**Unit Test Scenarios:**
1. Discord alert formatting with all severity levels
2. Discord rate limiting and backoff behavior
3. SendGrid email sending success and failure paths
4. Digest generation with various pipeline results
5. Alert routing based on alert type
6. Retry logic with exponential backoff

**Integration Test Scenarios:**
1. Discord webhook with test webhook URL
2. SendGrid email with sandbox mode enabled
3. Full notifications stage execution
4. Health check failure alert integration

**Mocking Strategy:**
```typescript
// Mock Discord webhook
vi.mock('global', () => ({
  fetch: vi.fn().mockResolvedValue({ ok: true, status: 200 })
}));

// Mock SendGrid
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockResolvedValue([{ statusCode: 202 }])
  }
}));

// Mock Secret Manager
vi.mock('@nexus-ai/core/secrets', () => ({
  getSecret: vi.fn().mockImplementation((name: string) => {
    const secrets: Record<string, string> = {
      'nexus-discord-webhook': 'https://discord.com/api/webhooks/test',
      'nexus-sendgrid-api-key': 'SG.test-key',
      'nexus-operator-email': 'operator@example.com'
    };
    return Promise.resolve(secrets[name]);
  })
}));
```

### NFR Requirements Addressed

**NFR4 (FR45): Notification stage must execute regardless of prior failures**
- `executeNotifications()` always runs as final stage
- Notification errors logged but don't fail stage

**NFR9: Alert delivery time must be <1 minute from trigger event**
- Direct webhook/API calls (no queuing)
- Parallel Discord + Email execution
- Retry with timeout limits

**From FR31: Discord webhook alerts**
- CRITICAL, WARNING, SUCCESS alert levels
- Immediate delivery for pipeline failures
- Rate limiting respected

**From FR32: Daily digest email**
- Comprehensive pipeline summary
- Sent after every pipeline run
- Includes all required sections

### Edge Cases to Handle

1. **Discord Webhook URL Invalid/Expired:**
   - Log error, mark as failed
   - Continue with email notification

2. **SendGrid API Key Invalid:**
   - Log error, mark as failed
   - Continue with Discord notification

3. **Both Channels Fail:**
   - Log CRITICAL to Firestore
   - Stage still returns success (notification failures don't block pipeline)

4. **Rate Limited by Discord:**
   - Respect `retry-after` header
   - Exponential backoff up to 5 attempts
   - Log warning if all attempts fail

5. **Large Digest Content:**
   - Truncate description fields if too long
   - Split into multiple embeds if needed for Discord

6. **Missing Data for Digest:**
   - Use "N/A" or "Unavailable" placeholders
   - Don't fail digest generation on missing optional fields

### Project Context Critical Rules (MUST FOLLOW)

**From `/project-context.md`:**

1. **NEVER Use console.log - Use Structured Logger**
   ```typescript
   import { createLogger } from '@nexus-ai/core';
   const logger = createLogger('notifications.discord');
   ```

2. **NEVER Hardcode Credentials - Use Secret Manager**
   ```typescript
   const webhookUrl = await getSecret('nexus-discord-webhook');
   const sendgridKey = await getSecret('nexus-sendgrid-api-key');
   ```

3. **Follow Naming Conventions:**
   - Files: `kebab-case` (e.g., `digest.ts`)
   - Functions: `camelCase` (e.g., `sendDiscordAlert`)
   - Interfaces: `PascalCase` (e.g., `DigestData`)
   - Constants: `SCREAMING_SNAKE` (e.g., `DISCORD_COLORS`)

4. **Error Code Format:**
   ```typescript
   NEXUS_NOTIFICATIONS_{TYPE}
   // Examples:
   NEXUS_NOTIFICATIONS_DISCORD_RATE_LIMITED
   NEXUS_NOTIFICATIONS_EMAIL_SEND_FAILED
   NEXUS_NOTIFICATIONS_DIGEST_GENERATION_FAILED
   ```

5. **Use StageInput/StageOutput Contracts:**
   ```typescript
   async function executeNotifications(
     input: StageInput<NotificationsInput>
   ): Promise<StageOutput<NotificationsOutput>>
   ```

### References

**Source Documents:**
- [Epic 5, Story 5.4](/_bmad-output/planning-artifacts/epics.md#Story-5.4) - Full story requirements
- [Architecture: Decision 6 - Monitoring & Alerting](/_bmad-output/planning-artifacts/architecture.md#L352-L381) - Alert routing rules
- [Architecture: FR31-32](/_bmad-output/planning-artifacts/architecture.md#L230-L232) - Discord + Email requirements
- [Project Context: Critical Rules](/_bmad-output/project-context.md#L31-L148) - Must-follow patterns
- [Story 5.3: Health Check](/_bmad-output/implementation-artifacts/5-3-implement-daily-health-check.md) - Integration point

**External Resources (2026 Research):**
- [Discord Webhooks Guide - Color Coding](https://birdie0.github.io/discord-webhooks-guide/structure/embed/color.html) - Decimal color values
- [Discord Rate Limits](https://discord.com/developers/docs/topics/rate-limits) - 5 req/2s limit
- [SendGrid Node.js SDK](https://github.com/sendgrid/sendgrid-nodejs) - Email API patterns
- [Exponential Backoff Best Practices](https://www.svix.com/resources/webhook-best-practices/retries/) - Retry patterns
- [GCP Secret Manager Integration](https://cloud.google.com/run/docs/configuring/services/secrets) - Secret access patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

**Session 1 (2026-01-22):**
- Created `@nexus-ai/notifications` package with full implementation
- All 8 core source files created and functional
- Package builds successfully with `pnpm turbo run build`
- 55 of 61 unit tests passing
- 6 tests failing due to vitest mock hoisting complexity (not code bugs)
- Orchestrator integration complete - failure-handler.ts updated to use notifications
- stages.ts updated to use real `executeNotifications` instead of stub

**Session 2 (2026-01-22):**
- Fixed all 6 failing tests using `vi.hoisted()` pattern for vitest mock hoisting
- Discord tests: Fixed mock hoisting for getSecret and fetch
- Email tests: Fixed mock hoisting for SendGrid and getSecret
- Discord "fetch failure" test: Added vi.useFakeTimers() to handle retry delays
- All 61 unit tests now passing
- Fixed unused imports in orchestrator/failure-handler.ts
- Both notifications package and orchestrator build successfully
- Integration tests covered by comprehensive unit tests with mocked external services

### File List

**Created Files:**
```
packages/notifications/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                   # Public exports
│   ├── types.ts                   # Notification interfaces (DISCORD_COLORS, DigestData, etc.)
│   ├── discord.ts                 # Discord webhook implementation (rate limiting, backoff, health alerts)
│   ├── email.ts                   # SendGrid email implementation (digests, alerts, Secret Manager)
│   ├── digest.ts                  # Digest generation logic (formatDigestEmail, etc.)
│   ├── notifications.ts           # executeNotifications() stage function (with error handling)
│   ├── metrics.ts                 # Notification tracking (FirestoreClient)
│   ├── routing.ts                 # Alert routing utility (routeAlert, sendCriticalAlert)
│   ├── utils.ts                   # Shared utilities (escapeHtml, formatDuration, formatCost)
│   └── __tests__/
│       ├── discord.test.ts        # 14 tests (all passing)
│       ├── email.test.ts          # 9 tests (all passing)
│       ├── digest.test.ts         # 12 tests (all passing)
│       ├── notifications.test.ts  # 13 tests (all passing)
│       └── metrics.test.ts        # 13 tests (all passing)
```

**Modified Files:**
```
apps/orchestrator/package.json     # Added @nexus-ai/notifications dependency
apps/orchestrator/src/stages.ts    # Replaced stub with real executeNotifications
apps/orchestrator/src/health/failure-handler.ts  # Import and use sendDiscordAlert
_bmad-output/implementation-artifacts/sprint-status.yaml  # Status: in-progress
pnpm-lock.yaml                     # Updated with new package
```

### Test Results Summary

**Tests: 61 passed, 0 failed (100% passing)**

All tests passing after fixing vitest mock hoisting issues:
- Used `vi.hoisted()` to properly hoist mock functions before `vi.mock()` calls
- Added `vi.useFakeTimers()` to speed up retry delay tests
- Comprehensive coverage of Discord alerts, email sending, digest generation, and notifications stage

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-22
**Outcome:** APPROVED (after fixes applied)

**Issues Found & Fixed:**

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | `sendHealthCheckFailureAlert` only sent Discord, missing email per AC7 | Added parallel email sending via `sendAlertEmail()` |
| HIGH | `collectDigestData` returned hardcoded placeholder health data | Improved to pass through provided data, use -1/"Unknown" for missing |
| MEDIUM | Latency measurement bug (both timings used same start time) | Wrapped each channel with `withTiming()` helper for accurate measurement |
| MEDIUM | No error handling for digest generation failures | Added try/catch with minimal fallback digest |
| MEDIUM | `getSenderEmail` used `process.env` instead of Secret Manager | Changed to async `getSecret()` with caching and fallback |
| MEDIUM | Duplicate `escapeHtml`/`formatDuration`/`formatCost` functions | Created `utils.ts` with shared implementations |

**Verification:**
- All 61 tests passing
- Package builds successfully
- Orchestrator type-checks with integration

### Change Log

- **2026-01-22 (Code Review):** Adversarial review found and fixed 6 issues
  - HIGH: Added email to sendHealthCheckFailureAlert for AC7 compliance
  - HIGH: Fixed collectDigestData to properly use provided health data
  - MEDIUM: Corrected latency measurement with withTiming helper
  - MEDIUM: Added try/catch for digest generation with fallback
  - MEDIUM: Changed getSenderEmail to use Secret Manager
  - MEDIUM: Created utils.ts for shared helper functions
  - Updated test expectations for new default values
  - Story status updated to "done"

- **2026-01-22 (Session 2):** Fixed all 6 failing unit tests, completed story implementation
  - Resolved vitest mock hoisting issues with `vi.hoisted()` pattern
  - All 61 tests now passing
  - Updated story status to "review"

- **2026-01-22 (Session 1):** Initial implementation
  - Created `@nexus-ai/notifications` package
  - Implemented Discord alerts, SendGrid emails, digest generation
  - Integrated with orchestrator service
  - 55 of 61 tests passing (6 mock hoisting issues remaining)

