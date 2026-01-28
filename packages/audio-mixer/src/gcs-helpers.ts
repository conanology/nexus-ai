import { writeFile } from 'fs/promises';
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
 * Supports both gs:// and https:// URLs.
 */
export async function downloadFromGCS(
  gcsUrl: string,
  localPath: string
): Promise<void> {
  const httpUrl = toHttpsUrl(gcsUrl);

  log.info({ gcsUrl, localPath }, 'Downloading from GCS');

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

  log.info({ gcsUrl, localPath, bytes: arrayBuffer.byteLength }, 'Download complete');
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
    // Dynamic import - @google-cloud/storage is available at runtime (root devDependency)
    const modulePath = '@google-cloud/storage';
    const storageModule = await import(modulePath);
    const storage = new storageModule.Storage();
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
