# NEXUS-AI Orchestrator Service

Central orchestrator service that coordinates all pipeline stages for the NEXUS-AI video production pipeline.

## Overview

The orchestrator is a lightweight Cloud Run service that:
- Coordinates sequential execution of all 9 pipeline stages
- Manages pipeline state with Firestore persistence
- Handles scheduled and manual pipeline triggers
- Implements pre-publish quality gate logic
- Provides health check endpoint for service readiness

## Architecture

- **Service Type**: HTTP server (Express.js)
- **Deployment**: Google Cloud Run
- **Resources**: 1 CPU, 1GB RAM
- **Timeout**: 4 hours (14,400s) to support full pipeline duration
- **Concurrency**: 1 (one pipeline at a time)
- **Scaling**: Min 0, Max 1 (scale to zero for cost efficiency)

## API Endpoints

### Health Check
```
GET /health
```

Returns service health status. Used by Cloud Run health checks.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-19T12:00:00.000Z",
  "version": "0.1.0"
}
```

### Scheduled Trigger
```
POST /trigger/scheduled
```

Handles scheduled pipeline triggers from Cloud Scheduler (configured in Story 5.12).
Requires Authorization header with OIDC token.

**Response:**
```json
{
  "message": "Pipeline scheduled",
  "pipelineId": "2026-01-19"
}
```

### Manual Trigger
```
POST /trigger/manual
```

Handles manual pipeline triggers for testing or re-running specific dates.

**Request Body (optional):**
```json
{
  "date": "2026-01-19"
}
```

**Response:**
```json
{
  "message": "Pipeline triggered",
  "pipelineId": "2026-01-19"
}
```

## Development

### Prerequisites

- Node.js 20.x LTS
- pnpm 10.x
- GCP credentials (for Firestore access)

### Environment Variables

```bash
# Required
NEXUS_PROJECT_ID=your-gcp-project-id

# Optional
PORT=8080                    # HTTP server port (default: 8080)
NODE_ENV=development         # development | production
NEXUS_LOG_LEVEL=info        # silent | error | warn | info | debug | trace
```

### Commands

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Run in development mode (with auto-reload)
pnpm dev

# Start production server
pnpm start

# Run tests
pnpm test
```

## Deployment

### Build Docker Image

```bash
# Build image
docker build -t gcr.io/PROJECT_ID/nexus-orchestrator:latest -f apps/orchestrator/Dockerfile .

# Test locally
docker run -p 8080:8080 \
  -e NEXUS_PROJECT_ID=your-project \
  gcr.io/PROJECT_ID/nexus-orchestrator:latest
```

### Deploy to Cloud Run

```bash
# Push image to Container Registry
docker push gcr.io/PROJECT_ID/nexus-orchestrator:latest

# Deploy to Cloud Run
gcloud run deploy orchestrator \
  --image gcr.io/PROJECT_ID/nexus-orchestrator:latest \
  --platform managed \
  --region us-central1 \
  --cpu 1 \
  --memory 1Gi \
  --timeout 14400 \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 1 \
  --set-env-vars NEXUS_PROJECT_ID=your-project \
  --service-account orchestrator@PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated
```

### Service Account Permissions

The orchestrator service account requires:

- `roles/run.invoker` - To be invoked by Cloud Scheduler
- `roles/datastore.user` - For Firestore read/write
- `roles/storage.objectAdmin` - For Cloud Storage artifacts
- `roles/secretmanager.secretAccessor` - For API keys/tokens
- `roles/logging.logWriter` - For structured logging
- `roles/run.invoker` - To invoke render-service Cloud Run

## Stage Registry

The orchestrator imports and coordinates these stages:

1. **news-sourcing** - Topic selection from news sources
2. **research** - Research brief generation
3. **script-gen** - Multi-agent script generation
4. **pronunciation** - SSML tagging for TTS
5. **tts** - Audio synthesis
6. **visual-gen** - Scene timeline generation
7. **thumbnail** - Thumbnail generation
8. **youtube** - Video upload and scheduling
9. **twitter** - Social media promotion

Note: `notifications` stage will be added in Story 5.4.

## Pipeline State Management

Pipeline state is persisted to Firestore at:

```
pipelines/{YYYY-MM-DD}/state
```

State includes:
- Current pipeline status
- Stage-by-stage execution status
- Provider usage (primary vs fallback)
- Quality context (degraded stages, fallbacks used, flags)
- Error information if pipeline fails

## Quality Gate

Pre-publish quality gate evaluates pipeline output and returns one of:

- **AUTO_PUBLISH** - No quality issues detected
- **AUTO_PUBLISH_WITH_WARNING** - Minor issues (<= 2 degraded stages/fallbacks)
- **HUMAN_REVIEW** - Major quality issues (TTS fallback, >30% visual fallbacks, etc.)

Quality criteria enforced:
- TTS fallback used → HUMAN_REVIEW
- >30% visual fallbacks → HUMAN_REVIEW
- Word count outside range → HUMAN_REVIEW
- >3 pronunciation unknowns → HUMAN_REVIEW
- Thumbnail + visual fallback → HUMAN_REVIEW

Core principle: **NEVER publish low-quality content. Skip day > bad video.**

## Implementation Notes

### Story Scope

This is **Story 5.1: Create Orchestrator Service** - Foundation only.

Implemented in this story:
- ✅ Service structure and HTTP server
- ✅ Health endpoint
- ✅ Stage registry and imports
- ✅ State management with Firestore
- ✅ Quality gate decision logic
- ✅ Handler stubs for triggers
- ✅ Cloud Run deployment configuration

**NOT in this story** (Story 5.2):
- ❌ Pipeline execution logic
- ❌ Sequential stage execution
- ❌ Retry and fallback handling
- ❌ Error recovery

### References

- [Epic 5, Story 5.1](/_bmad-output/planning-artifacts/epics.md#L1527-L1565)
- [Architecture Document](/_bmad-output/planning-artifacts/architecture.md)
- [Project Context](/_bmad-output/project-context.md)

## Testing

### Unit Tests

```bash
pnpm test
```

Tests cover:
- HTTP server initialization
- Health endpoint response
- Route registration
- Stage registry configuration

### Integration Tests

Story 5.2 will add integration tests for:
- Full pipeline execution
- State persistence
- Quality gate evaluation
- Error handling

## Monitoring

Structured logging uses Pino with JSON output:

```typescript
logger.info({
  pipelineId: '2026-01-19',
  stage: 'orchestrator',
  event: 'pipeline_started'
}, 'Pipeline execution started');
```

Cloud Run automatically sends logs to Cloud Logging for:
- Request tracking
- Error monitoring
- Performance metrics

## License

Proprietary - NEXUS-AI Project
