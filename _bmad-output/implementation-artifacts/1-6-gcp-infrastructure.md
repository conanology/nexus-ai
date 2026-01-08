# Story 1.6: Set Up GCP Infrastructure

Status: done

## Story

As a developer,
I want GCP storage and secrets infrastructure configured,
So that pipeline state persists and credentials are securely managed.

## Acceptance Criteria

1. **Given** provider abstraction from Story 1.5
   **When** I implement GCP infrastructure clients
   **Then** `FirestoreClient` class provides:
   - `getDocument(collection, docId)` returns typed document
   - `setDocument(collection, docId, data)` creates/updates document
   - `updateDocument(collection, docId, updates)` partial update
   - `queryDocuments(collection, filters)` returns matching documents
   - Connection uses `NEXUS_PROJECT_ID` environment variable

2. **And** `CloudStorageClient` class provides:
   - `uploadFile(bucket, path, content, contentType)` returns public URL
   - `downloadFile(bucket, path)` returns file content
   - `getSignedUrl(bucket, path, expiration)` returns temporary access URL
   - `deleteFile(bucket, path)` removes file
   - Default bucket from `NEXUS_BUCKET_NAME` environment variable

3. **And** `getSecret(secretName)` function:
   - Retrieves secret from GCP Secret Manager
   - Caches secrets in memory for duration of process
   - Secret names follow `nexus-{service}-{purpose}` convention
   - Falls back to environment variable `NEXUS_{SECRET_NAME}` for local dev

4. **And** Firestore document paths follow architecture:
   - `pipelines/{YYYY-MM-DD}/state`
   - `pronunciation/{term}`
   - `topics/{YYYY-MM-DD}`
   - `buffer-videos/{id}`
   - `incidents/{id}`

5. **And** Cloud Storage paths follow: `gs://nexus-ai-artifacts/{date}/{stage}/{file}`

## Tasks / Subtasks

- [x] Task 1: Implement FirestoreClient (AC: #1, #4)
  - [x] Create FirestoreClient class with Firestore SDK
  - [x] Implement getDocument with typing
  - [x] Implement setDocument for create/update
  - [x] Implement updateDocument for partial updates
  - [x] Implement queryDocuments with filters
  - [x] Use NEXUS_PROJECT_ID for connection

- [x] Task 2: Implement CloudStorageClient (AC: #2, #5)
  - [x] Create CloudStorageClient class with Storage SDK
  - [x] Implement uploadFile returning public URL
  - [x] Implement downloadFile returning Buffer
  - [x] Implement getSignedUrl for temporary access
  - [x] Implement deleteFile
  - [x] Use NEXUS_BUCKET_NAME for default bucket

- [x] Task 3: Implement getSecret (AC: #3)
  - [x] Create Secret Manager client
  - [x] Implement in-memory caching
  - [x] Add local dev fallback to env vars
  - [x] Follow nexus-{service}-{purpose} naming

- [x] Task 4: Export from gcp module
  - [x] Create gcp/index.ts with all exports
  - [x] Add to main package exports

## Dev Notes

### Firestore Collections

| Collection | Document ID | Purpose |
|------------|-------------|---------|
| pipelines | YYYY-MM-DD | Pipeline state, costs |
| pronunciation | term | Pronunciation dictionary |
| topics | YYYY-MM-DD | Daily topic selection |
| buffer-videos | uuid | Emergency buffer videos |
| incidents | uuid | Error/incident records |

### Cloud Storage Structure

```
gs://nexus-ai-artifacts/
├── 2026-01-08/
│   ├── research/research.md
│   ├── script-drafts/v1-writer.md
│   ├── tts/audio.wav
│   ├── visual-gen/scenes.json
│   ├── render/video.mp4
│   └── thumbnails/{1,2,3}.png
```

### Secret Naming

Format: `nexus-{service}-{purpose}`
- `nexus-gemini-api-key`
- `nexus-youtube-oauth`
- `nexus-discord-webhook`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- Implemented FirestoreClient with full CRUD operations
- Implemented CloudStorageClient with upload, download, signed URLs
- Implemented getSecret with in-memory caching and local fallback
- All clients use NEXUS_PROJECT_ID environment variable
- Storage uses NEXUS_BUCKET_NAME for default bucket
- Added type-safe document operations

### File List

**Created/Modified:**
- `nexus-ai/packages/core/src/gcp/firestore.ts` - FirestoreClient
- `nexus-ai/packages/core/src/gcp/storage.ts` - CloudStorageClient
- `nexus-ai/packages/core/src/gcp/secrets.ts` - getSecret function
- `nexus-ai/packages/core/src/gcp/index.ts` - Exports

### Dependencies

- **Upstream Dependencies:** Story 1.5 (Provider Abstraction uses getSecret)
- **Downstream Dependencies:** All stages that persist data
