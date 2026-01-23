# NEXUS-AI Configuration Status

**Last Updated:** 2026-01-23
**Project ID:** `nexus-ai-conan-01`
**Region:** `us-central1`

---

## Configuration Summary

| Component | Status | Notes |
|-----------|--------|-------|
| GCP APIs | ✅ Enabled | All required APIs active |
| Orchestrator | ✅ Deployed | Cloud Run service running |
| Firestore | ✅ Ready | Database created |
| Cloud Storage | ✅ Ready | Bucket exists |
| Secret Manager | ✅ Configured | All secrets created |
| Cloud Scheduler | ✅ Active | Daily 6 AM UTC |

---

## GCP Services Enabled

All required Google Cloud APIs are enabled:

| API | Status | Purpose |
|-----|--------|---------|
| `generativelanguage.googleapis.com` | ✅ | Gemini API (LLM + Images) |
| `youtube.googleapis.com` | ✅ | YouTube Data API (uploads) |
| `firestore.googleapis.com` | ✅ | State management |
| `secretmanager.googleapis.com` | ✅ | Credentials storage |
| `cloudscheduler.googleapis.com` | ✅ | Automated triggers |
| `run.googleapis.com` | ✅ | Orchestrator hosting |
| `cloudbuild.googleapis.com` | ✅ | Container builds |
| `storage.googleapis.com` | ✅ | Artifact storage |
| `monitoring.googleapis.com` | ✅ | Observability |
| `logging.googleapis.com` | ✅ | Log aggregation |

---

## Infrastructure

### Cloud Run - Orchestrator

| Property | Value |
|----------|-------|
| **Service Name** | `nexus-orchestrator` |
| **URL** | `https://nexus-orchestrator-408744545530.us-central1.run.app` |
| **Region** | `us-central1` |
| **Status** | ✅ Running |

**Endpoints:**
- `GET /health` - Health check
- `POST /trigger/manual` - Manual pipeline trigger
- `POST /trigger/scheduled` - Scheduler trigger (auth required)
- `POST /trigger/resume` - Resume failed pipeline

### Firestore Database

| Property | Value |
|----------|-------|
| **Database ID** | `(default)` |
| **Location** | `us-central1` |
| **Mode** | `FIRESTORE_NATIVE` |
| **Status** | ✅ Ready |

**Collections:**
- `pipelines` - Pipeline state and history
- `costs` - Cost tracking data
- `buffers` - Buffer video inventory
- `reviews` - Human review queue
- `pronunciation` - TTS dictionary

### Cloud Storage

| Property | Value |
|----------|-------|
| **Bucket Name** | `nexus-ai-artifacts` |
| **Location** | `us-central1` |
| **Storage Class** | `STANDARD` |
| **Lifecycle** | 90-day auto-delete |
| **Versioning** | Enabled |
| **Status** | ✅ Ready |

**Contents:**
- `/videos/` - Rendered video files
- `/audio/` - TTS audio files
- `/images/` - Generated images
- `/scripts/` - Generated scripts

---

## Secret Manager Configuration

All secrets are stored in GCP Secret Manager.

### Core Secrets (Required)

| Secret Name | Status | Description |
|-------------|--------|-------------|
| `nexus-gemini-api-key` | ✅ Configured | Gemini API key for LLM and image generation |
| `nexus-youtube-oauth` | ✅ Configured | YouTube OAuth2 credentials with refresh token |
| `nexus-github-token` | ✅ Configured | GitHub PAT for news sourcing |
| `nexus-discord-webhook` | ✅ Configured | Discord webhook for notifications |

### Social Media Secrets

| Secret Name | Status | Description |
|-------------|--------|-------------|
| `nexus-twitter-oauth` | ✅ Configured | Twitter/X API credentials for social posting |
| `nexus-reddit-client-id` | ✅ Configured | Reddit API client ID |
| `nexus-reddit-client-secret` | ✅ Configured | Reddit API client secret |

### Secret Values Reference

#### Gemini API Key
```
Secret: nexus-gemini-api-key
Value: AIzaSyCMCnsYkdE6lR2ubA7IcG2uqtIUxBDi1EA
```

#### YouTube OAuth (JSON)
```json
{
  "client_id": "408744545530-t1002u4eispl44eisqcbi87lup7vr776.apps.googleusercontent.com",
  "client_secret": "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",
  "refresh_token": "1//04cFgQuy_9gGXCgYIARAAGAQSNwF-L9IrcmsqSr2JoIZ9-P4rngNzzczW2SX-Rs5QfZ1KoV32NteDJb5gn7MEUaLe8G-VOgfFbg0",
  "access_token": "ya29.a0AUMWg_JVOkRd240...",
  "token_type": "Bearer",
  "expiry_date": 1737590443000
}
```

#### GitHub Token
```
Secret: nexus-github-token
Value: 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
```

#### Discord Webhook
```
Secret: nexus-discord-webhook
Value: https://discordapp.com/api/webhooks/1463961888047108364/ZW3ruwlQt--ak8gveCzokIAFux1WL3ppwkTrFQzFof9p0XYSKvwGRUU9ISCpgjzR3Wfr
```

#### Twitter OAuth (JSON)
```json
{
  "appKey": "BUO53C0qiCTiBDASOHL4NglWD",
  "appSecret": "dOA4naZTGWIAAQvE3gukSNPIE6k0jCzjTXgvZXQVfuwRdM2z3N",
  "accessToken": "2013015186655866880-qMh0rvwwwRVOatPxL5A4V8IM2K2OB9",
  "accessSecret": "LrH7q7ikVBt2XkTkN3sqI8RMZ9uetKEdKqvhfhCXgPDuw"
}
```

---

## Service Accounts

| Service Account | Purpose | Roles |
|-----------------|---------|-------|
| `nexus-ai-runtime@nexus-ai-conan-01.iam.gserviceaccount.com` | Cloud Run runtime | Secret accessor, Firestore user, Storage admin |
| `nexus-scheduler-sa@nexus-ai-conan-01.iam.gserviceaccount.com` | Cloud Scheduler | Cloud Run invoker |
| `408744545530-compute@developer.gserviceaccount.com` | Default compute | Default GCE service account |

---

## OAuth Clients

### YouTube Web Application (for OAuth Playground)
| Property | Value |
|----------|-------|
| **Name** | NEXUS YouTube Web |
| **Client ID** | `408744545530-t1002u4eispl44eisqcbi87lup7vr776.apps.googleusercontent.com` |
| **Type** | Web Application |
| **Redirect URIs** | `https://developers.google.com/oauthplayground` |
| **Status** | ✅ Active |

### YouTube Desktop Application (original)
| Property | Value |
|----------|-------|
| **Name** | NEXUS YouTube Desktop |
| **Client ID** | `408744545530-gc9es0chs4nthu12vb15d933i2p98gmi.apps.googleusercontent.com` |
| **Type** | Desktop |
| **Status** | ⚠️ Not used (Desktop apps don't support custom redirect URIs) |

---

## Cloud Scheduler

The scheduler is deployed and actively triggering the daily pipeline.

| Property | Value |
|----------|-------|
| **Job Name** | `nexus-daily-pipeline` |
| **Schedule** | `0 6 * * *` (6:00 AM UTC daily) |
| **Time Zone** | `UTC` |
| **State** | ✅ ENABLED |
| **Target** | `POST /trigger` |
| **Next Run** | 2026-01-23 06:00 UTC |
| **Last Run** | 2026-01-22 06:00 UTC |

**Management Commands:**
```bash
# Check status
nexus scheduler status

# Pause automatic triggers
nexus scheduler pause

# Resume automatic triggers
nexus scheduler resume

# Manually trigger via scheduler
nexus scheduler run
```

---

## External Services

### YouTube Channel
| Property | Value |
|----------|-------|
| **Account** | conangaming007@gmail.com |
| **Scopes** | `youtube.upload` |
| **Status** | ✅ OAuth configured |

### Twitter/X Account
| Property | Value |
|----------|-------|
| **Account** | a.conan.dev@gmail.com |
| **API Access** | OAuth 1.0a User Context |
| **Status** | ✅ Configured |

### Reddit Account
| Property | Value |
|----------|-------|
| **Username** | devconan |
| **API Access** | Script app credentials |
| **Status** | ✅ Configured |

### Discord
| Property | Value |
|----------|-------|
| **Webhook** | Configured |
| **Purpose** | Pipeline notifications and alerts |
| **Status** | ✅ Active |

---

## Verification Commands

### Check All Secrets
```bash
for secret in nexus-gemini-api-key nexus-youtube-oauth nexus-github-token nexus-discord-webhook nexus-twitter-oauth; do
  echo -n "$secret: "
  gcloud secrets versions access latest --secret=$secret --project=nexus-ai-conan-01 2>/dev/null | head -c 50
  echo "..."
done
```

### Check Orchestrator Health
```bash
curl -s https://nexus-orchestrator-408744545530.us-central1.run.app/health | jq .
```

### Check Firestore
```bash
gcloud firestore databases list --project=nexus-ai-conan-01
```

### Check Storage Bucket
```bash
gcloud storage buckets describe gs://nexus-ai-artifacts --project=nexus-ai-conan-01
```

### Check Enabled APIs
```bash
gcloud services list --enabled --project=nexus-ai-conan-01 --format="value(config.name)"
```

---

## Remaining Setup Tasks

1. **Create Buffer Videos** (recommended for reliability)
   ```bash
   nexus buffer create "AI Safety" --video-id <id> --title "AI Safety Explained"
   ```

2. **Test Full Pipeline**
   ```bash
   nexus trigger --wait
   ```

3. **Verify Scheduler is Working**
   ```bash
   nexus scheduler status
   ```

---

## Updating Secrets

### Rotate YouTube OAuth Token
If the refresh token expires, regenerate via OAuth Playground:

1. Go to https://developers.google.com/oauthplayground/
2. Use credentials from `NEXUS YouTube Web` OAuth client
3. Authorize `youtube.upload` scope
4. Exchange for tokens
5. Update secret:
   ```bash
   cat << 'EOF' | gcloud secrets versions add nexus-youtube-oauth --data-file=- --project=nexus-ai-conan-01
   {
     "client_id": "...",
     "client_secret": "...",
     "refresh_token": "NEW_TOKEN",
     ...
   }
   EOF
   ```

### Update Any Secret
```bash
echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=- --project=nexus-ai-conan-01
```

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Cloud Scheduler │────▶│   Orchestrator   │────▶│    YouTube      │
│  (6 AM UTC)     │     │   (Cloud Run)    │     │   (Upload)      │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Firestore   │     │  Secret Manager  │     │  Cloud Storage  │
│   (State)     │     │  (Credentials)   │     │  (Artifacts)    │
└───────────────┘     └──────────────────┘     └─────────────────┘
        │
        ▼
┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Gemini     │     │   GitHub API     │     │    Discord      │
│  (LLM/Images) │     │  (News Source)   │     │  (Notifications)│
└───────────────┘     └──────────────────┘     └─────────────────┘
```

---

## Contact & Support

- **GCP Project**: nexus-ai-conan-01
- **Discord Notifications**: Configured webhook
- **Logs**: GCP Cloud Logging
