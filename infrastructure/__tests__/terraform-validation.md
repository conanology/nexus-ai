# Terraform Validation Tests

This document describes how to validate the Terraform configurations for Cloud Scheduler infrastructure.

## Prerequisites

1. Terraform >= 1.0 installed
2. Google Cloud SDK (gcloud) installed
3. Authenticated to GCP: `gcloud auth application-default login`
4. Set environment variables:
   ```bash
   export TF_VAR_project_id="your-project-id"
   export TF_VAR_orchestrator_url="https://your-orchestrator.run.app"
   export TF_VAR_discord_webhook_url="https://discord.com/api/webhooks/..."
   ```

## Validation Steps

### 1. Validate Service Account Configuration

```bash
cd infrastructure/service-accounts

# Initialize
terraform init

# Validate syntax
terraform validate

# Expected output: Success! The configuration is valid.

# Review plan (dry run)
terraform plan -var="project_id=${TF_VAR_project_id}"

# Expected resources:
# - google_service_account.scheduler_sa
# - google_cloud_run_service_iam_member.scheduler_invoker
# - google_project_iam_member.scheduler_admin
```

### 2. Validate Cloud Scheduler Configuration

```bash
cd infrastructure/cloud-scheduler

# Initialize
terraform init

# Validate syntax
terraform validate

# Expected output: Success! The configuration is valid.

# Review plan (dry run)
terraform plan \
  -var="project_id=${TF_VAR_project_id}" \
  -var="orchestrator_url=${TF_VAR_orchestrator_url}"

# Expected resources:
# - google_cloud_scheduler_job.daily_pipeline
```

### 3. Validate Monitoring Configuration

```bash
cd infrastructure/monitoring

# Initialize
terraform init

# Validate syntax
terraform validate

# Expected output: Success! The configuration is valid.

# Review plan (dry run)
terraform plan \
  -var="project_id=${TF_VAR_project_id}" \
  -var="discord_webhook_url=${TF_VAR_discord_webhook_url}"

# Expected resources:
# - google_monitoring_notification_channel.discord_webhook
# - google_monitoring_alert_policy.scheduler_failure
# - google_monitoring_alert_policy.scheduler_repeated_failure
```

## Full Deployment Test

### Deploy to Test Environment

```bash
# 1. Deploy service account first
cd infrastructure/service-accounts
terraform apply -var="project_id=${TF_VAR_project_id}"

# 2. Deploy scheduler
cd ../cloud-scheduler
terraform apply \
  -var="project_id=${TF_VAR_project_id}" \
  -var="orchestrator_url=${TF_VAR_orchestrator_url}"

# 3. Deploy monitoring
cd ../monitoring
terraform apply \
  -var="project_id=${TF_VAR_project_id}" \
  -var="discord_webhook_url=${TF_VAR_discord_webhook_url}"
```

### Verify Deployment

```bash
# Check service account
gcloud iam service-accounts describe nexus-scheduler-sa@${TF_VAR_project_id}.iam.gserviceaccount.com

# Check scheduler job
gcloud scheduler jobs describe nexus-daily-pipeline --location=us-central1

# Check alert policies
gcloud alpha monitoring policies list --filter="displayName:NEXUS"
```

### Manual Trigger Test

```bash
# Trigger job manually
gcloud scheduler jobs run nexus-daily-pipeline --location=us-central1

# Check logs
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=nexus-daily-pipeline" --limit=10
```

### Cleanup Test Environment

```bash
cd infrastructure/monitoring
terraform destroy -var="project_id=${TF_VAR_project_id}" -var="discord_webhook_url=${TF_VAR_discord_webhook_url}"

cd ../cloud-scheduler
terraform destroy -var="project_id=${TF_VAR_project_id}" -var="orchestrator_url=${TF_VAR_orchestrator_url}"

cd ../service-accounts
terraform destroy -var="project_id=${TF_VAR_project_id}"
```

## Automated CI Validation (Optional)

Add to CI pipeline (e.g., GitHub Actions):

```yaml
- name: Validate Terraform
  run: |
    cd infrastructure/service-accounts && terraform init -backend=false && terraform validate
    cd ../cloud-scheduler && terraform init -backend=false && terraform validate
    cd ../monitoring && terraform init -backend=false && terraform validate
```

## Expected Outputs

After successful deployment:

| Resource | Expected Value |
|----------|---------------|
| Service Account | nexus-scheduler-sa@{project}.iam.gserviceaccount.com |
| Scheduler Job | nexus-daily-pipeline |
| Schedule | 0 6 * * * (6 AM UTC) |
| Alert Policy | NEXUS Scheduler Job Failure |
| Notification Channel | NEXUS Discord Alerts |
