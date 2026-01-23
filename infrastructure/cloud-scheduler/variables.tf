# Variables for Cloud Scheduler Configuration

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the scheduler job"
  type        = string
  default     = "us-central1"
}

variable "orchestrator_url" {
  description = "URL of the orchestrator Cloud Run service (e.g., https://nexus-orchestrator-xxxxx.run.app)"
  type        = string
}

variable "schedule" {
  description = "Cron schedule for the pipeline (default: 6:00 AM UTC daily)"
  type        = string
  default     = "0 6 * * *"
}

variable "paused" {
  description = "Whether the scheduler job should be paused"
  type        = bool
  default     = false
}
