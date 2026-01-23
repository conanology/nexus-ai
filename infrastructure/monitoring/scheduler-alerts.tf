# Cloud Monitoring Alerts for Cloud Scheduler
#
# Configures alerting policies for scheduler job failures
# Alerts are sent to Discord via a webhook notification channel

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0"
    }
  }
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "discord_webhook_url" {
  description = "Discord webhook URL for alerts"
  type        = string
  sensitive   = true
}

variable "notification_email" {
  description = "Email address for backup notifications"
  type        = string
  default     = ""
}

# Discord webhook notification channel
resource "google_monitoring_notification_channel" "discord_webhook" {
  project      = var.project_id
  display_name = "NEXUS Discord Alerts"
  type         = "webhook_tokenauth"

  labels = {
    url = var.discord_webhook_url
  }

  description = "Discord webhook for NEXUS-AI alerts"
}

# Email notification channel (backup)
resource "google_monitoring_notification_channel" "email_backup" {
  count        = var.notification_email != "" ? 1 : 0
  project      = var.project_id
  display_name = "NEXUS Email Alerts"
  type         = "email"

  labels = {
    email_address = var.notification_email
  }

  description = "Backup email notifications for NEXUS-AI alerts"
}

# Alert policy for scheduler job failures
resource "google_monitoring_alert_policy" "scheduler_failure" {
  project      = var.project_id
  display_name = "NEXUS Scheduler Job Failure"
  combiner     = "OR"

  documentation {
    content   = <<-EOT
      ## Cloud Scheduler Job Failed

      The NEXUS daily pipeline scheduler job has failed after all retry attempts.

      ### Immediate Actions
      1. Check Cloud Scheduler logs: `gcloud scheduler jobs describe nexus-daily-pipeline`
      2. Check orchestrator service status: `gcloud run services describe nexus-orchestrator`
      3. Manually trigger if needed: `nexus trigger` or `gcloud scheduler jobs run nexus-daily-pipeline`

      ### Common Causes
      - Orchestrator service is down or unreachable
      - Authentication/IAM issues with service account
      - Network connectivity problems
      - Orchestrator returned error response

      ### Resolution
      1. Fix the underlying service issue
      2. Manually run the scheduler job or trigger pipeline directly
      3. Monitor next scheduled execution
    EOT
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Scheduler job execution failed"

    # Metric choice: attempt_count vs execution_count
    # - attempt_count: Counts each HTTP request attempt (including retries)
    # - execution_count: Counts each scheduled execution (one per cron trigger)
    # We use attempt_count to detect failures including retry attempts,
    # ensuring we alert when ANY attempt fails, not just final failures.
    condition_threshold {
      filter = <<-EOT
        resource.type="cloud_scheduler_job"
        AND resource.labels.job_id="nexus-daily-pipeline"
        AND metric.type="cloudscheduler.googleapis.com/job/attempt_count"
        AND metric.labels.status!="SUCCESS"
      EOT

      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_COUNT"
      }

      trigger {
        count = 1
      }
    }
  }

  # Send to Discord
  notification_channels = concat(
    [google_monitoring_notification_channel.discord_webhook.id],
    var.notification_email != "" ? [google_monitoring_notification_channel.email_backup[0].id] : []
  )

  alert_strategy {
    auto_close = "86400s" # 24 hours
  }

  user_labels = {
    service     = "nexus-scheduler"
    severity    = "critical"
    environment = "production"
  }
}

# Alert policy for scheduler job consistently failing
resource "google_monitoring_alert_policy" "scheduler_repeated_failure" {
  project      = var.project_id
  display_name = "NEXUS Scheduler Job Repeated Failures"
  combiner     = "OR"

  documentation {
    content   = <<-EOT
      ## Scheduler Job Repeatedly Failing

      The NEXUS daily pipeline scheduler job has failed multiple times in a 24-hour period.
      This indicates a persistent issue that needs investigation.

      ### Escalation Required
      This alert indicates the automated recovery is not working.
      Manual intervention is required to restore daily video publishing.
    EOT
    mime_type = "text/markdown"
  }

  conditions {
    display_name = "Scheduler job failed 3+ times in 24 hours"

    condition_threshold {
      filter = <<-EOT
        resource.type="cloud_scheduler_job"
        AND resource.labels.job_id="nexus-daily-pipeline"
        AND metric.type="cloudscheduler.googleapis.com/job/attempt_count"
        AND metric.labels.status!="SUCCESS"
      EOT

      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = 2

      aggregations {
        alignment_period   = "86400s" # 24 hours
        per_series_aligner = "ALIGN_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = concat(
    [google_monitoring_notification_channel.discord_webhook.id],
    var.notification_email != "" ? [google_monitoring_notification_channel.email_backup[0].id] : []
  )

  alert_strategy {
    auto_close = "172800s" # 48 hours
  }

  user_labels = {
    service     = "nexus-scheduler"
    severity    = "high"
    environment = "production"
  }
}

# Output notification channel IDs
output "discord_notification_channel_id" {
  description = "ID of the Discord notification channel"
  value       = google_monitoring_notification_channel.discord_webhook.id
}

output "email_notification_channel_id" {
  description = "ID of the email notification channel (if created)"
  value       = var.notification_email != "" ? google_monitoring_notification_channel.email_backup[0].id : null
}

output "scheduler_failure_alert_policy_id" {
  description = "ID of the scheduler failure alert policy"
  value       = google_monitoring_alert_policy.scheduler_failure.id
}
