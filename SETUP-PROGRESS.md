# NEXUS-AI GCP Configuration Summary
**Date:** 2026-01-22
**Project:** nexus-ai-conan-01

## ✅ COMPLETED

### Phase 1: Authentication & Environment
- ✅ Authenticated with GCP (conangaming007@gmail.com)
- ✅ Set project to nexus-ai-conan-01
- ✅ Created environment variables

### Phase 2: Enable GCP APIs
- ✅ Cloud Run API
- ✅ Cloud Scheduler API
- ✅ Firestore API
- ✅ Cloud Storage API
- ✅ Secret Manager API
- ✅ Cloud Monitoring API
- ✅ Cloud Logging API
- ✅ Cloud Build API
- ✅ IAM API
- ✅ YouTube Data API v3

### Phase 3: Firestore Configuration
- ✅ Firestore Native mode database created
- ✅ Location: us-central1
- ✅ Free tier enabled

### Phase 4: Cloud Storage
- ✅ Bucket created: gs://nexus-ai-artifacts
- ✅ Versioning enabled
- ✅ Lifecycle policy: Delete after 90 days

### Phase 5: Secrets Configuration
- ✅ nexus-gemini-api-key (configured)
- ✅ nexus-discord-webhook-url (configured)
- ✅ nexus-twitter-oauth (fully configured with credentials)
- ⚠️  nexus-youtube-oauth (placeholder - needs manual setup)
- ⚠️  nexus-reddit-client-id/secret (marked as skipped)

### Phase 7: Terraform Infrastructure
- ✅ Service Accounts deployed
  - nexus-scheduler-sa@nexus-ai-conan-01.iam.gserviceaccount.com
  - Permissions: Cloud Run Invoker, Cloud Scheduler Admin

## ⏳ REMAINING TASKS

### Phase 6: Deploy Orchestrator to Cloud Run
**Status:** Postponed due to Docker build complexity  
**Next Steps:**
1. Fix monorepo Docker build (pnpm workspace dependencies)
2. Build Docker image locally or via Cloud Build
3. Deploy to Cloud Run with environment variables
4. Get orchestrator URL for scheduler configuration

### Phase 7.2-7.3: Complete Terraform Deployment
**Cloud Scheduler:**
- Requires orchestrator URL (from Phase 6)
- Will create daily 6:00 AM UTC trigger
- OIDC authentication configured

**Monitoring & Alerts:**
- Discord webhook already configured
- Alert policies for scheduler failures
- Requires deployment after orchestrator is live

### Phase 8: Testing & Validation
- Health endpoint verification
- Manual pipeline trigger test
- Scheduler job execution test
- Secret access verification

### Phase 9: Operator CLI Setup
- Build CLI locally
- Configure environment variables
- Test commands (status, trigger, costs, etc.)

### Phase 10: Final Configuration
- **YouTube OAuth:** Manual browser-based OAuth flow
  - OAuth consent screen: ✅ Configured (in production)
  - Scopes added: ✅ youtube, youtube.upload
  - Desktop app credentials: ✅ Created
  - **Issue:** Authorization keeps failing with scope errors
  - **Workaround:** Can be configured later when needed

## 🔑 CREDENTIALS CONFIGURED

### Working Credentials:
1. **Gemini API:** AIzaSyCMCnsYkdE6lR2ubA7IcG2uqtIUxBDi1EA
2. **Discord Webhook:** Configured
3. **Twitter/X OAuth:** 
   - App Key: BUO53C0qiCTiBDASOHL4NglWD
   - Access Token: 2013015186655866880-qMh0rvwwRVOatPxL5A4V8IM2K2OB9
   - (Full credentials stored in Secret Manager)

### Pending Configuration:
1. **YouTube OAuth:** Requires manual OAuth flow completion
2. **Reddit API:** Optional (can skip)

## 📋 QUICK START GUIDE FOR NEXT SESSION

### 1. Deploy Orchestrator
```bash
cd /mnt/d/05_Work/NEXUS-AI-PROJECT
source /tmp/nexus-env.sh

# Option A: Build with Docker locally
docker build -t gcr.io/${PROJECT_ID}/nexus-orchestrator \
  -f apps/orchestrator/Dockerfile .
docker push gcr.io/${PROJECT_ID}/nexus-orchestrator

# Option B: Fix Cloud Build config and retry
# See /home/acona/.claude/plans/joyful-orbiting-truffle.md

# Then deploy to Cloud Run
gcloud run deploy nexus-orchestrator \
  --image gcr.io/${PROJECT_ID}/nexus-orchestrator \
  --platform managed \
  --region us-central1 \
  --memory 1Gi \
  --set-env-vars "NEXUS_PROJECT_ID=${PROJECT_ID},NEXUS_BUCKET_NAME=${BUCKET_NAME}"
```

### 2. Complete YouTube OAuth
```bash
# Open this URL in browser:
https://accounts.google.com/o/oauth2/v2/auth?client_id=408744545530-gc9es0chs4nthu12vb15d933i2p98gmi.apps.googleusercontent.com&redirect_uri=urn%3Aietf%3Awg%3Aoauth%3A2.0%3Aoob&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube&access_type=offline&prompt=consent

# Log in with: conangaming007@gmail.com
# Get authorization code and exchange for tokens
# Store in Secret Manager: nexus-youtube-oauth
```

### 3. Deploy Remaining Terraform
```bash
cd /mnt/d/05_Work/NEXUS-AI-PROJECT/infrastructure

# Get orchestrator URL first
export ORCHESTRATOR_URL=$(gcloud run services describe nexus-orchestrator \
  --region us-central1 --format 'value(status.url)')

# Deploy Cloud Scheduler
cd cloud-scheduler
terraform init
terraform apply \
  -var="project_id=${PROJECT_ID}" \
  -var="orchestrator_url=${ORCHESTRATOR_URL}"

# Deploy Monitoring
cd ../monitoring
terraform init
terraform apply \
  -var="project_id=${PROJECT_ID}" \
  -var="discord_webhook_url=${DISCORD_WEBHOOK}"
```

## 📊 COST ESTIMATE
- **Setup:** Free (within GCP free tier)
- **Monthly:** ~$7-18/month
  - Cloud Run: $5-10
  - Cloud Scheduler: $0.10
  - Firestore: $1-5
  - Cloud Storage: $1-3
  - Secret Manager: $0.06

## 🔗 IMPORTANT LINKS
- GCP Console: https://console.cloud.google.com/home/dashboard?project=nexus-ai-conan-01
- Secrets: https://console.cloud.google.com/security/secret-manager?project=nexus-ai-conan-01
- Cloud Run: https://console.cloud.google.com/run?project=nexus-ai-conan-01
- OAuth Consent: https://console.cloud.google.com/apis/credentials/consent?project=nexus-ai-conan-01

## 📝 NOTES
- Reddit API skipped (optional news source)
- YouTube OAuth needs manual completion
- Orchestrator deployment postponed to next session
- All infrastructure code ready in `/mnt/d/05_Work/NEXUS-AI-PROJECT/infrastructure/`
- Environment variables saved in `/tmp/nexus-env.sh`

