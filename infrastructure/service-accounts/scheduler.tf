# Cloud Scheduler Service Account
# Creates a dedicated service account for Cloud Scheduler to invoke the orchestrator
#
# This enables secure OIDC authentication between Cloud Scheduler and Cloud Run

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

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "orchestrator_service_name" {
  description = "Name of the orchestrator Cloud Run service"
  type        = string
  default     = "nexus-orchestrator"
}

# Service account for Cloud Scheduler
resource "google_service_account" "scheduler_sa" {
  account_id   = "nexus-scheduler-sa"
  display_name = "NEXUS Cloud Scheduler Service Account"
  description  = "Service account for Cloud Scheduler to invoke the NEXUS orchestrator"
  project      = var.project_id
}

# Grant Cloud Run Invoker role to the scheduler service account
# This allows Cloud Scheduler to invoke the orchestrator Cloud Run service
resource "google_cloud_run_service_iam_member" "scheduler_invoker" {
  project  = var.project_id
  location = var.region
  service  = var.orchestrator_service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler_sa.email}"
}

# Optional: Grant Cloud Scheduler Admin role for CLI management
# This is used by the operator CLI to manage scheduler jobs
resource "google_project_iam_member" "scheduler_admin" {
  project = var.project_id
  role    = "roles/cloudscheduler.admin"
  member  = "serviceAccount:${google_service_account.scheduler_sa.email}"
}

# Output the service account email for use in scheduler job config
output "scheduler_service_account_email" {
  description = "Email of the scheduler service account"
  value       = google_service_account.scheduler_sa.email
}

output "scheduler_service_account_id" {
  description = "ID of the scheduler service account"
  value       = google_service_account.scheduler_sa.id
}
