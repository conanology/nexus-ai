/**
 * Integration tests for GCP Infrastructure
 *
 * These tests require real GCP credentials and will be skipped in CI
 * unless NEXUS_PROJECT_ID and NEXUS_BUCKET_NAME are set.
 *
 * To run locally:
 * 1. Set NEXUS_PROJECT_ID to your GCP project
 * 2. Set NEXUS_BUCKET_NAME to your test bucket
 * 3. Ensure Application Default Credentials are configured:
 *    gcloud auth application-default login
 * 4. Run: pnpm test:run tests/integration/gcp-infrastructure.test.ts
 */
export {};
//# sourceMappingURL=gcp-infrastructure.test.d.ts.map