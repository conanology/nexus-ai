import { writeFile } from 'fs/promises';
import { Storage } from '@google-cloud/storage';
import { NexusError, logger } from '@nexus-ai/core';

const log = logger.child({ module: 'nexus.audio-mixer.gcs' });

/**
 * Convert a gs:// URL to an HTTPS URL for public download.
 */
function toHttpsUrl(gcsUrl: string): string {
  if (gcsUrl.startsWith('gs://')) {
    return gcsUrl.replace('gs://', 'https://storage.googleapis.com/');
  }
  return gcsUrl;
}

/**
 * Parse a gs:// URL into bucket and path components.
 */
function parseGcsUrl(gcsUrl: string): { bucket: string; path: string } {
  const match = gcsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw NexusError.critical(
      'NEXUS_AUDIO_MIXER_INVALID_GCS_URL',
      `Invalid GCS URL: ${gcsUrl}`,
      'audio-mixer'
    );
  }
  return { bucket: match[1], path: match[2] };
}

/**
 * Download a file from a GCS URL to a local path.
 * Uses authenticated GCS SDK first, falls back to public HTTPS URL if auth fails.
 * Supports both gs:// and https:// URLs.
 */
export async function downloadFromGCS(
  gcsUrl: string,
  localPath: string
): Promise<void> {
  log.info({ gcsUrl, localPath }, 'Downloading from GCS');

  // Try authenticated download first for gs:// URLs
  if (gcsUrl.startsWith('gs://')) {
    try {
      const { bucket, path } = parseGcsUrl(gcsUrl);
      const storage = new Storage();

      await storage.bucket(bucket).file(path).download({ destination: localPath });

      log.info({ gcsUrl, localPath }, 'Authenticated download complete');
      return;
    } catch (authError) {
      log.warn(
        { gcsUrl, error: authError instanceof Error ? authError.message : String(authError) },
        'Authenticated GCS download failed, falling back to public URL'
      );
      // Fall through to public URL attempt
    }
  }

  // Fallback: try public HTTPS URL
  const httpUrl = toHttpsUrl(gcsUrl);

  let response: Response;
  try {
    response = await fetch(httpUrl);
  } catch (error) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_DOWNLOAD_FAILED',
      `Failed to download from GCS: ${error instanceof Error ? error.message : String(error)}`,
      'audio-mixer',
      { gcsUrl }
    );
  }

  if (!response.ok) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_DOWNLOAD_FAILED',
      `GCS download failed with status ${response.status}: ${gcsUrl}`,
      'audio-mixer',
      { gcsUrl, status: response.status }
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(localPath, Buffer.from(arrayBuffer));

  log.info({ gcsUrl, localPath, bytes: arrayBuffer.byteLength }, 'Download complete (public URL)');
}

/**
 * Upload a local file to a GCS URL.
 * Returns the public HTTPS URL of the uploaded file.
 */
export async function uploadToGCS(
  localPath: string,
  gcsUrl: string
): Promise<string> {
  const { bucket, path } = parseGcsUrl(gcsUrl);

  log.info({ localPath, gcsUrl }, 'Uploading to GCS');

  try {
    const storage = new Storage();
    await storage.bucket(bucket).upload(localPath, { destination: path });

    const publicUrl = `https://storage.googleapis.com/${bucket}/${path}`;
    log.info({ publicUrl }, 'Upload complete');
    return publicUrl;
  } catch (error) {
    throw NexusError.retryable(
      'NEXUS_AUDIO_MIXER_UPLOAD_FAILED',
      `Failed to upload to GCS: ${error instanceof Error ? error.message : String(error)}`,
      'audio-mixer',
      { localPath, gcsUrl }
    );
  }
}
