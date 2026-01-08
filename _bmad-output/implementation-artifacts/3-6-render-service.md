# Story 3.6: Create Render Service

Status: done

## Story

As a developer,
I want a dedicated render service,
So that videos are rendered with sufficient resources.

## Acceptance Criteria

1. **Given** Remotion video studio from Story 3.4
   **When** I create the render service
   **Then** `apps/render-service/` Cloud Run app is created

2. **And** service configuration per architecture:
   - 4 CPU, 8GB RAM allocation
   - Timeout: 45 minutes (NFR7)
   - Concurrency: 1 (one render at a time)
   - Min instances: 0 (scale to zero)

3. **And** render endpoint `/render` accepts:
   - `pipelineId`: string (YYYY-MM-DD)
   - `timelineUrl`: Cloud Storage URL to scenes.json
   - `audioUrl`: Cloud Storage URL to audio.wav

4. **And** render process:
   1. Download timeline and audio from Cloud Storage
   2. Execute Remotion render with timeline data
   3. Output MP4 1920x1080 @ 30fps
   4. Upload to `{date}/render/video.mp4`
   5. Return video URL and duration

5. **And** render quality gate checks per FR20:
   - Zero frame drops
   - Audio sync within 100ms
   - File size reasonable for duration

6. **And** render logs progress percentage

7. **And** health endpoint `/health` for monitoring

8. **And** Dockerfile configured for Remotion rendering

## Tasks / Subtasks

- [x] Task 1: Create render-service app (AC: #1)
  - [x] Create apps/render-service directory
  - [x] Set up Express/Hono server
  - [x] Add package.json

- [x] Task 2: Configure Cloud Run settings (AC: #2)
  - [x] Set CPU/RAM allocation
  - [x] Set 45-minute timeout
  - [x] Set concurrency to 1
  - [x] Configure min instances

- [x] Task 3: Implement /render endpoint (AC: #3, #4)
  - [x] Accept pipelineId, timelineUrl, audioUrl
  - [x] Download timeline and audio
  - [x] Execute Remotion render
  - [x] Upload to Cloud Storage
  - [x] Return video URL

- [x] Task 4: Implement quality checks (AC: #5)
  - [x] Check for frame drops
  - [x] Verify audio sync
  - [x] Validate file size

- [x] Task 5: Add progress logging (AC: #6)
  - [x] Log render progress percentage
  - [x] Log estimated time remaining

- [x] Task 6: Create health endpoint (AC: #7)
  - [x] /health returns service status
  - [x] Include memory/CPU usage

- [x] Task 7: Create Dockerfile (AC: #8)
  - [x] Base image with Chrome/Puppeteer
  - [x] Install Remotion dependencies
  - [x] Configure for headless rendering

## Dev Notes

### Service Configuration

```yaml
# Cloud Run config
cpu: 4
memory: 8Gi
timeout: 2700  # 45 minutes
concurrency: 1
minInstances: 0
```

### Render Endpoint Request

```typescript
interface RenderRequest {
  pipelineId: string;
  timelineUrl: string;
  audioUrl: string;
}
```

### Render Response

```typescript
interface RenderResponse {
  videoUrl: string;
  duration: number;
  fileSize: number;
  quality: {
    frameDrops: number;
    audioSyncMs: number;
  };
}
```

### Dockerfile

```dockerfile
FROM node:20-slim

# Install Chrome for Remotion
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-inter \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
CMD ["node", "dist/index.js"]
```

### Quality Thresholds

| Check | Threshold | Action |
|-------|-----------|--------|
| Frame drops | 0 | PASS |
| Frame drops | 1-5 | WARN |
| Frame drops | >5 | FAIL |
| Audio sync | <100ms | PASS |
| Audio sync | 100-200ms | WARN |
| Audio sync | >200ms | FAIL |

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Created apps/render-service Cloud Run app
- Configured for 4 CPU, 8GB RAM, 45min timeout
- Implemented /render endpoint
- Downloads timeline/audio, renders, uploads video
- Quality checks for frame drops and audio sync
- Progress logging during render
- Health endpoint for monitoring
- Dockerfile with Chrome for Remotion

### File List

**Created/Modified:**
- `nexus-ai/apps/render-service/package.json`
- `nexus-ai/apps/render-service/tsconfig.json`
- `nexus-ai/apps/render-service/Dockerfile`
- `nexus-ai/apps/render-service/src/types.ts`
- `nexus-ai/apps/render-service/src/renderer.ts`
- `nexus-ai/apps/render-service/src/index.ts`

### Dependencies

- **Upstream Dependencies:** Story 3.4 (Video Studio), Story 3.2 (Audio)
- **Downstream Dependencies:** Story 4.1 (YouTube Upload)
