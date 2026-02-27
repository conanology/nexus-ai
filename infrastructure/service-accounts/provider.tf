provider "google" {
  project      = var.project_id
  region       = var.region
  # Use ADC/service-account auth from environment; never hardcode tokens in source
}
