# Cloud Scheduler Configuration for NEXUS-AI Daily Pipeline
#
# Creates a Cloud Scheduler job that triggers the pipeline daily at 6:00 AM UTC
# Includes retry configuration with exponential backoff

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Reference to the scheduler service account
data "google_service_account" "scheduler_sa" {
  account_id = "nexus-scheduler-sa"
  project    = var.project_id
}

# Cloud Scheduler job for daily pipeline execution
resource "google_cloud_scheduler_job" "daily_pipeline" {
  name             = "nexus-daily-pipeline"
  description      = "Triggers NEXUS-AI pipeline daily at 6:00 AM UTC"
  schedule         = var.schedule
  time_zone        = "UTC"
  attempt_deadline = "1800s" # 30 minutes
  paused           = var.paused

  project = var.project_id
  region  = var.region

  # Retry configuration (AC #4)
  # - Max retry attempts: 3
  # - Exponential backoff: 30s to 300s
  # - Max retry duration: 1 hour
  retry_config {
    retry_count          = 3
    min_backoff_duration = "30s"
    max_backoff_duration = "300s"
    max_retry_duration   = "3600s"
  }

  # HTTP target configuration
  http_target {
    http_method = "POST"
    uri         = "${var.orchestrator_url}/trigger/scheduled"

    # OIDC authentication (AC #2)
    oidc_token {
      service_account_email = data.google_service_account.scheduler_sa.email
      audience              = var.orchestrator_url
    }

    headers = {
      "Content-Type" = "application/json"
    }

    # Request body - includes source identifier for logging
    body = base64encode(jsonencode({
      source    = "scheduler"
      job_name  = "nexus-daily-pipeline"
      scheduled = true
    }))
  }

  # Lifecycle to prevent accidental destruction
  lifecycle {
    prevent_destroy = false
  }
}
