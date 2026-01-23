# NEXUS-AI User Guide

A comprehensive guide to operating the NEXUS-AI automated YouTube video pipeline system.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [CLI Commands Reference](#cli-commands-reference)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [Configuration](#configuration)
6. [Common Workflows](#common-workflows)
7. [Troubleshooting](#troubleshooting)

---

## Overview

NEXUS-AI is an automated system that creates and publishes daily YouTube videos about AI/tech news. The system consists of:

- **Orchestrator**: Cloud Run service that executes the video creation pipeline
- **Operator CLI**: Command-line tool for managing and monitoring the system
- **Cloud Scheduler**: Automated daily trigger at 6:00 AM UTC

### Pipeline Stages

1. **News Sourcing** - Fetches trending AI/tech topics from GitHub, Reddit, and news APIs
2. **Script Generation** - Uses Gemini to write engaging video scripts
3. **Text-to-Speech** - Converts script to audio using Google Cloud TTS
4. **Image Generation** - Creates visual assets using Gemini's image capabilities
5. **Video Rendering** - Assembles audio and images into final video
6. **Quality Gate** - Validates video meets quality standards
7. **Publishing** - Uploads to YouTube with optimized metadata

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm package manager
- Google Cloud CLI (`gcloud`) authenticated
- Access to GCP project `nexus-ai-conan-01`

### Installation

```bash
cd apps/operator-cli
pnpm install
pnpm build
```

### Run Your First Command

```bash
# Check orchestrator health
pnpm start -- status

# Trigger a video pipeline
pnpm start -- trigger

# Or using the npm script alias
pnpm cli status
pnpm cli trigger
```

---

## CLI Commands Reference

All commands support `--json` flag for machine-readable output.

```bash
nexus [command] [options]
nexus --json [command]  # JSON output mode
```

### `trigger` - Manually Trigger Pipeline

Starts a new video creation pipeline.

```bash
nexus trigger [options]
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `-d, --date <YYYY-MM-DD>` | Pipeline date | Today |
| `-w, --wait` | Wait for pipeline completion | false |
| `--skip-health-check` | Skip pre-execution health check | false |

**Examples:**
```bash
# Trigger today's pipeline
nexus trigger

# Trigger for specific date
nexus trigger --date 2026-01-23

# Trigger and wait for completion
nexus trigger --wait

# Skip health check (useful for debugging)
nexus trigger --skip-health-check
```

---

### `status` - Show Pipeline Status

Displays the current status of a pipeline run.

```bash
nexus status [options]
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `-d, --date <YYYY-MM-DD>` | Pipeline date to check | Today |
| `-w, --watch` | Poll for updates every 5s | false |

**Examples:**
```bash
# Check today's pipeline status
nexus status

# Check specific date
nexus status --date 2026-01-22

# Watch status until completion
nexus status --watch
```

**Output Fields:**
- Current Stage
- Status (running/completed/failed)
- Duration
- Quality flags and degraded stages

---

### `retry` - Retry Failed Pipeline

Resumes a failed pipeline from the point of failure.

```bash
nexus retry <pipelineId> [options]
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `pipelineId` | Date of failed pipeline (YYYY-MM-DD) |

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `-f, --from <stage>` | Retry from specific stage | Auto-detect |
| `-w, --wait` | Wait for completion | false |

**Examples:**
```bash
# Retry yesterday's failed pipeline
nexus retry 2026-01-22

# Retry from a specific stage
nexus retry 2026-01-22 --from script-generation

# Wait for retry to complete
nexus retry 2026-01-22 --wait
```

---

### `costs` - View Cost Tracking

Displays cost information and budget status.

```bash
nexus costs [options]
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `-m, --month` | Show month-to-date costs | false |
| `-t, --trend <days>` | Show cost trend for N days | - |
| `-b, --budget` | Show budget status and runway | false |

**Examples:**
```bash
# Today's costs
nexus costs

# Month-to-date summary
nexus costs --month

# 7-day cost trend
nexus costs --trend 7

# Budget and runway status
nexus costs --budget
```

**Cost Categories:**
- **Gemini** - LLM and image generation
- **TTS** - Text-to-speech synthesis
- **Render** - Video rendering compute

---

### `buffer` - Manage Buffer Videos

Buffer videos are pre-created fallback content used when the pipeline fails.

#### `buffer list` - List Available Buffers

```bash
nexus buffer list
```

Lists all buffer videos with:
- ID (first 8 chars)
- Topic
- Created date
- Status

#### `buffer deploy` - Deploy Buffer Video

```bash
nexus buffer deploy [options]
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `-i, --id <id>` | Specific buffer ID | First available |
| `-y, --yes` | Skip confirmation | false |

**Example:**
```bash
nexus buffer deploy --id abc12345 --yes
```

#### `buffer create` - Create New Buffer

```bash
nexus buffer create <topic> --video-id <id> --title <title>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `topic` | The topic/theme of the buffer video |

**Required Options:**
| Flag | Description |
|------|-------------|
| `--video-id <id>` | YouTube video ID |
| `--title <title>` | Video title |

**Example:**
```bash
nexus buffer create "AI Safety Overview" --video-id dQw4w9WgXcQ --title "Understanding AI Safety"
```

#### `buffer health` - Check Buffer System Health

```bash
nexus buffer health
```

Shows:
- Total buffer count
- Available vs deployed
- Health status (critical/warning/healthy)
- Minimum threshold comparison

---

### `pronunciation` (alias: `pron`) - Manage Pronunciation Dictionary

Controls how the TTS engine pronounces technical terms.

#### `pronunciation list` - List Dictionary Entries

```bash
nexus pronunciation list [options]
nexus pron list
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `-u, --unverified` | Show only unverified terms | false |
| `-l, --limit <n>` | Limit results | 20 |

#### `pronunciation add` - Add New Term

```bash
nexus pronunciation add <term> <ipa> <ssml>
```

**Arguments:**
| Argument | Description |
|----------|-------------|
| `term` | The word/phrase |
| `ipa` | IPA pronunciation |
| `ssml` | SSML phoneme markup |

**Example:**
```bash
nexus pron add "GPT" "dʒiː piː tiː" '<phoneme alphabet="ipa" ph="dʒiː piː tiː">GPT</phoneme>'
```

#### `pronunciation search` - Search Dictionary

```bash
nexus pronunciation search <query>
```

Searches by term prefix.

#### `pronunciation verify` - Mark as Verified

```bash
nexus pronunciation verify <term>
```

Marks a term as human-verified.

---

### `review` - Manage Human Review Queue

Handles items flagged for human review (controversial topics, quality issues, etc.)

#### `review list` - List Pending Items

```bash
nexus review list [options]
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type <type>` | Filter by type | All |
| `-l, --limit <n>` | Limit results | 20 |

**Types:** `pronunciation`, `quality`, `controversial`, `topic`

#### `review show` - Show Item Details

```bash
nexus review show <id>
```

Displays full item details including context and flagged content.

#### `review resolve` - Resolve Item

```bash
nexus review resolve <id> [options]
```

**Options:**
| Flag | Description |
|------|-------------|
| `-n, --note <text>` | Resolution note |

#### `review dismiss` - Dismiss Item

```bash
nexus review dismiss <id> --reason <text>
```

**Required:**
| Flag | Description |
|------|-------------|
| `-r, --reason <text>` | Reason for dismissal |

#### `review skip` - Skip Controversial Topic

```bash
nexus review skip <id>
```

Permanently skips a controversial topic.

#### `review requeue` - Requeue for Tomorrow

```bash
nexus review requeue <id>
```

Puts the topic back in the queue for a future run.

---

### `scheduler` - Manage Cloud Scheduler

Controls the automated daily pipeline trigger.

#### `scheduler status` - Show Scheduler Status

```bash
nexus scheduler status
```

Displays:
- Job name and state (ENABLED/PAUSED)
- Schedule (cron expression)
- Time zone
- Next/last run times
- Last run status

#### `scheduler pause` - Pause Automatic Triggers

```bash
nexus scheduler pause
```

Stops the daily automatic pipeline runs. Manual triggers still work.

#### `scheduler resume` - Resume Automatic Triggers

```bash
nexus scheduler resume
```

Re-enables daily automatic pipeline runs.

#### `scheduler run` - Manually Trigger via Scheduler

```bash
nexus scheduler run
```

Triggers the scheduler job immediately (uses the scheduler path, not direct HTTP).

---

## API Endpoints Reference

The orchestrator exposes these HTTP endpoints:

### Base URL
```
https://nexus-orchestrator-408744545530.us-central1.run.app
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-23T00:00:00.000Z",
  "version": "1.0.0"
}
```

### `POST /trigger/manual`

Manually trigger pipeline execution.

**Request Body:**
```json
{
  "date": "2026-01-23",       // Optional, defaults to today
  "wait": false,              // Wait for completion
  "skipHealthCheck": false    // Skip pre-execution health check
}
```

**Response (async):**
```json
{
  "message": "Pipeline execution started",
  "pipelineId": "2026-01-23",
  "status": "accepted"
}
```

**Response (sync with wait: true):**
```json
{
  "message": "Pipeline completed",
  "pipelineId": "2026-01-23",
  "status": "completed",
  "completedStages": ["news-sourcing", "script-generation", "..."],
  "totalDurationMs": 180000,
  "totalCost": 0.42
}
```

### `POST /trigger/scheduled`

Cloud Scheduler endpoint (requires OIDC authentication).

**Headers:**
```
Authorization: Bearer <OIDC_TOKEN>
```

**Request Body:**
```json
{
  "source": "cloud-scheduler",
  "job_name": "nexus-daily-pipeline"
}
```

### `POST /trigger/resume`

Resume a failed pipeline.

**Request Body:**
```json
{
  "pipelineId": "2026-01-23",
  "fromStage": "script-generation",  // Optional
  "wait": false
}
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXUS_ORCHESTRATOR_URL` | Orchestrator URL | Cloud Run URL |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID | nexus-ai-conan-01 |
| `NEXUS_SCHEDULER_JOB_NAME` | Scheduler job name | nexus-daily-pipeline |
| `NEXUS_SCHEDULER_LOCATION` | Scheduler region | us-central1 |

### GCP Secret Manager Secrets

| Secret Name | Description |
|-------------|-------------|
| `nexus-gemini-api-key` | Gemini API key for LLM/images |
| `nexus-youtube-oauth` | YouTube OAuth credentials (JSON) |
| `nexus-github-token` | GitHub PAT for news sourcing |
| `nexus-discord-webhook` | Discord webhook URL for notifications |
| `nexus-twitter-oauth` | Twitter OAuth credentials (JSON) |

### YouTube OAuth Format

```json
{
  "client_id": "xxx.apps.googleusercontent.com",
  "client_secret": "GOCSPX-xxx",
  "refresh_token": "1//xxx",
  "access_token": "ya29.xxx",
  "token_type": "Bearer",
  "expiry_date": 1234567890000
}
```

---

## Common Workflows

### Daily Operations

```bash
# Morning check - verify yesterday's video published
nexus status --date $(date -d "yesterday" +%Y-%m-%d)

# Check today's pipeline (if scheduler is running)
nexus status

# Review any flagged items
nexus review list

# Check budget
nexus costs --budget
```

### Manual Video Creation

```bash
# Trigger pipeline and wait
nexus trigger --wait

# Or trigger async and monitor
nexus trigger
nexus status --watch
```

### Handling Failures

```bash
# Check what failed
nexus status --date 2026-01-23

# Retry from failure point
nexus retry 2026-01-23

# Or retry from specific stage
nexus retry 2026-01-23 --from script-generation
```

### Emergency: Deploy Buffer Video

```bash
# Check available buffers
nexus buffer list

# Deploy immediately
nexus buffer deploy --yes
```

### Pause System for Maintenance

```bash
# Pause automatic triggers
nexus scheduler pause

# Do maintenance...

# Resume
nexus scheduler resume
```

---

## Troubleshooting

### Pipeline Shows "No run found"

The pipeline hasn't started yet for that date.

```bash
# Check scheduler status
nexus scheduler status

# Manually trigger
nexus trigger
```

### Health Check Failing

```bash
# Trigger with skip to bypass
nexus trigger --skip-health-check

# Or check what's failing
curl https://nexus-orchestrator-408744545530.us-central1.run.app/health
```

### "Scheduler job not found"

The Cloud Scheduler hasn't been deployed.

```bash
cd infrastructure/cloud-scheduler
terraform init
terraform apply
```

### YouTube Upload Failing

Check the OAuth credentials:

```bash
gcloud secrets versions access latest --secret=nexus-youtube-oauth | jq .
```

Ensure `refresh_token` is present. If expired, regenerate via OAuth Playground.

### High Costs

```bash
# Check trend
nexus costs --trend 7

# Check budget
nexus costs --budget

# Check daily breakdown
nexus costs
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Trigger video | `nexus trigger` |
| Check status | `nexus status` |
| Watch status | `nexus status --watch` |
| Retry failed | `nexus retry 2026-01-23` |
| Check costs | `nexus costs` |
| List buffers | `nexus buffer list` |
| Deploy buffer | `nexus buffer deploy --yes` |
| Pause scheduler | `nexus scheduler pause` |
| Resume scheduler | `nexus scheduler resume` |
| List reviews | `nexus review list` |

---

## Support

- **Logs**: Cloud Run logs in GCP Console
- **Notifications**: Discord webhook for alerts
- **Status**: Firestore `pipelines` collection
