# NEXUS-AI Operations Guide

Operational procedures for managing the NEXUS-AI automated video pipeline.

## Cloud Scheduler Management

The pipeline is triggered automatically at 6:00 AM UTC daily via Cloud Scheduler.

### Viewing Scheduler Status

```bash
# Using nexus CLI
nexus scheduler status

# Using gcloud
gcloud scheduler jobs describe nexus-daily-pipeline \
  --location=us-central1 \
  --format="table(name,state,schedule,scheduleTime,lastAttemptTime,status.code)"
```

### Pausing the Scheduler

Pause to temporarily stop automatic pipeline triggers (e.g., during maintenance):

```bash
# Using nexus CLI
nexus scheduler pause

# Using gcloud
gcloud scheduler jobs pause nexus-daily-pipeline --location=us-central1
```

**Note:** Pausing does NOT affect manual triggers via `nexus trigger`.

### Resuming the Scheduler

Resume automatic pipeline triggers:

```bash
# Using nexus CLI
nexus scheduler resume

# Using gcloud
gcloud scheduler jobs resume nexus-daily-pipeline --location=us-central1
```

### Manual Trigger via Scheduler

Trigger the scheduler job immediately (useful for testing scheduler path):

```bash
# Using nexus CLI
nexus scheduler run

# Using gcloud
gcloud scheduler jobs run nexus-daily-pipeline --location=us-central1
```

### Direct Manual Trigger

Trigger the pipeline directly (bypasses scheduler):

```bash
# Using nexus CLI
nexus trigger

# With specific date
nexus trigger --date 2026-01-22

# Wait for completion
nexus trigger --wait
```

## Common Operations

### Check Pipeline Status

```bash
# Today's pipeline
nexus status

# Specific date
nexus status --date 2026-01-22
```

### View Costs

```bash
# Today's costs
nexus costs

# Date range
nexus costs --from 2026-01-01 --to 2026-01-22
```

### Manage Buffer Videos

```bash
# List buffer videos
nexus buffer list

# Deploy buffer video manually
nexus buffer deploy

# Add a new buffer video
nexus buffer add --path /path/to/video.mp4 --title "Buffer Video Title"
```

### Review Queue Management

```bash
# List items pending review
nexus review list

# Approve an item
nexus review approve <pipeline-id>

# Reject an item
nexus review reject <pipeline-id> --reason "Quality issues"
```

## Troubleshooting

### Scheduler Job Failing

1. Check scheduler job status:
   ```bash
   nexus scheduler status
   # or
   gcloud scheduler jobs describe nexus-daily-pipeline --location=us-central1
   ```

2. Check orchestrator service health:
   ```bash
   gcloud run services describe nexus-orchestrator --region=us-central1
   ```

3. View scheduler execution logs:
   ```bash
   gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=nexus-daily-pipeline" --limit=50
   ```

4. View orchestrator logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=nexus-orchestrator" --limit=100
   ```

### Pipeline Stuck or Failed

1. Check pipeline status:
   ```bash
   nexus status --date <YYYY-MM-DD>
   ```

2. Retry from a specific stage:
   ```bash
   nexus retry --date <YYYY-MM-DD> --from-stage <stage-name>
   ```

3. Skip the day and deploy buffer:
   ```bash
   nexus buffer deploy --date <YYYY-MM-DD>
   ```

### Service Account Issues

Verify service account has correct permissions:

```bash
# List service account IAM bindings
gcloud iam service-accounts get-iam-policy \
  nexus-scheduler-sa@${PROJECT_ID}.iam.gserviceaccount.com

# Verify Cloud Run invoker role
gcloud run services get-iam-policy nexus-orchestrator --region=us-central1
```

## Monitoring & Alerts

### Alert Destinations

- **Discord:** Real-time alerts for scheduler failures and pipeline issues
- **Email:** Backup notifications for critical alerts

### Alert Types

| Alert | Severity | Condition |
|-------|----------|-----------|
| Scheduler Job Failure | Critical | Job fails after all retries |
| Repeated Scheduler Failures | High | 3+ failures in 24 hours |
| Health Check Failure | Critical | Critical services unavailable |
| Pipeline Failure | Critical | Pipeline fails to complete |
| Quality Gate Failure | Warning | Quality thresholds not met |

### Viewing Alerts

```bash
# GCP Console
# Navigate to: Monitoring > Alerting > Incidents

# CLI
gcloud alpha monitoring policies list --project=${PROJECT_ID}
```

## Infrastructure Management

### Deploy Scheduler Infrastructure

```bash
cd infrastructure

# Initialize Terraform
terraform init

# Apply service account
cd service-accounts
terraform apply -var="project_id=${PROJECT_ID}"

# Apply scheduler
cd ../cloud-scheduler
terraform apply \
  -var="project_id=${PROJECT_ID}" \
  -var="orchestrator_url=${ORCHESTRATOR_URL}"

# Apply monitoring
cd ../monitoring
terraform apply \
  -var="project_id=${PROJECT_ID}" \
  -var="discord_webhook_url=${DISCORD_WEBHOOK_URL}"
```

### Update Scheduler Schedule

Modify `infrastructure/cloud-scheduler/variables.tf` or pass as variable:

```bash
terraform apply -var="schedule=0 7 * * *"  # Change to 7 AM UTC
```

## Emergency Procedures

### Complete Service Outage

1. Immediately deploy a buffer video:
   ```bash
   nexus buffer deploy
   ```

2. Pause the scheduler to prevent retry attempts:
   ```bash
   nexus scheduler pause
   ```

3. Investigate and fix the root cause

4. Resume normal operations:
   ```bash
   nexus scheduler resume
   nexus trigger  # Test manual trigger
   ```

### Rollback Scheduler Changes

```bash
cd infrastructure/cloud-scheduler
terraform plan -destroy
terraform apply -destroy  # Removes scheduler job
terraform apply           # Recreates with previous state
```
