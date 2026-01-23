# Outputs for Cloud Scheduler Configuration

output "job_name" {
  description = "Name of the Cloud Scheduler job"
  value       = google_cloud_scheduler_job.daily_pipeline.name
}

output "job_id" {
  description = "Full resource ID of the Cloud Scheduler job"
  value       = google_cloud_scheduler_job.daily_pipeline.id
}

output "schedule" {
  description = "Cron schedule of the job"
  value       = google_cloud_scheduler_job.daily_pipeline.schedule
}

output "target_uri" {
  description = "Target URI for the scheduler job"
  value       = google_cloud_scheduler_job.daily_pipeline.http_target[0].uri
}

output "state" {
  description = "Current state of the scheduler job"
  value       = google_cloud_scheduler_job.daily_pipeline.state
}
