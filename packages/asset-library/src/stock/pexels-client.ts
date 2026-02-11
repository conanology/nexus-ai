/**
 * Pexels API Client — searches for stock videos and photos.
 *
 * Free tier: 200 requests/hour.
 * Auth: API key in "Authorization" header.
 *
 * Priority: videos first (natural movement is 10x better than stills),
 * then fall back to photos.
 *
 * @module @nexus-ai/asset-library/stock/pexels-client
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PexelsVideo {
  id: number;
  url: string;
  /** Direct download URL for the HD video file */
  videoFileUrl: string;
  width: number;
  height: number;
  duration: number;
}

export interface PexelsPhoto {
  id: number;
  url: string;
  /** Direct download URL for the large photo */
  photoUrl: string;
  width: number;
  height: number;
  photographer: string;
}

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideoResult {
  id: number;
  url: string;
  duration: number;
  video_files: PexelsVideoFile[];
}

interface PexelsVideoSearchResponse {
  videos: PexelsVideoResult[];
  total_results: number;
}

interface PexelsPhotoSrc {
  original: string;
  large2x: string;
  large: string;
  medium: string;
}

interface PexelsPhotoResult {
  id: number;
  url: string;
  width: number;
  height: number;
  photographer: string;
  src: PexelsPhotoSrc;
}

interface PexelsPhotoSearchResponse {
  photos: PexelsPhotoResult[];
  total_results: number;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Search Pexels for stock videos matching a query.
 * Returns the best HD video file URL, or null if no results.
 */
export async function searchVideos(
  query: string,
  apiKey: string,
): Promise<PexelsVideo | null> {
  try {
    const params = new URLSearchParams({
      query,
      per_page: '5',
      size: 'medium',
    });

    const res = await fetch(
      `https://api.pexels.com/videos/search?${params}`,
      {
        headers: { Authorization: apiKey },
      },
    );

    if (!res.ok) {
      console.log(`Pexels video search failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as PexelsVideoSearchResponse;

    if (!data.videos || data.videos.length === 0) {
      return null;
    }

    // Pick the first video result
    const video = data.videos[0];

    // Find HD file (prefer 1920x1080, accept 1280x720)
    const hdFile = video.video_files
      .filter((f) => f.file_type === 'video/mp4')
      .sort((a, b) => {
        // Prefer HD (1920w or 1280w), avoid 4K (>1920)
        const scoreA = a.width <= 1920 ? a.width : 1920 - (a.width - 1920);
        const scoreB = b.width <= 1920 ? b.width : 1920 - (b.width - 1920);
        return scoreB - scoreA;
      })[0];

    if (!hdFile) return null;

    return {
      id: video.id,
      url: video.url,
      videoFileUrl: hdFile.link,
      width: hdFile.width,
      height: hdFile.height,
      duration: video.duration,
    };
  } catch (err) {
    console.log(`Pexels video search error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Search Pexels for stock photos matching a query.
 * Returns the best large photo, or null if no results.
 */
export async function searchPhotos(
  query: string,
  apiKey: string,
): Promise<PexelsPhoto | null> {
  try {
    const params = new URLSearchParams({
      query,
      per_page: '5',
      size: 'large',
      orientation: 'landscape',
    });

    const res = await fetch(
      `https://api.pexels.com/v1/search?${params}`,
      {
        headers: { Authorization: apiKey },
      },
    );

    if (!res.ok) {
      console.log(`Pexels photo search failed: HTTP ${res.status}`);
      return null;
    }

    const data = (await res.json()) as PexelsPhotoSearchResponse;

    if (!data.photos || data.photos.length === 0) {
      return null;
    }

    const photo = data.photos[0];

    return {
      id: photo.id,
      url: photo.url,
      photoUrl: photo.src.large2x || photo.src.large,
      width: photo.width,
      height: photo.height,
      photographer: photo.photographer,
    };
  } catch (err) {
    console.log(`Pexels photo search error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Download an image from a URL and return as a data URI.
 */
export async function downloadAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

/**
 * Search for stock media: tries videos first, falls back to photos.
 * Downloads the result and returns a data URI.
 *
 * For videos: downloads and returns as video data URI (for Remotion OffthreadVideo).
 * For photos: downloads and returns as image data URI.
 */
export async function searchStockMedia(
  query: string,
  apiKey: string,
): Promise<{ dataUri: string; type: 'video' | 'photo'; attribution: string } | null> {
  // Try photos (more reliable as scene backgrounds than short video clips)
  const photo = await searchPhotos(query, apiKey);
  if (photo) {
    const dataUri = await downloadAsDataUri(photo.photoUrl);
    if (dataUri) {
      return {
        dataUri,
        type: 'photo',
        attribution: `Photo by ${photo.photographer} on Pexels`,
      };
    }
  }

  // Video fallback — download the thumbnail frame instead of the whole video
  // (video backgrounds as data URIs are too heavy for Remotion inputProps)
  const video = await searchVideos(query, apiKey);
  if (video) {
    // Pexels video thumbnails: replace file extension with .jpg for poster
    const posterUrl = video.videoFileUrl.replace(/\.[^.]+$/, '.jpg');
    const dataUri = await downloadAsDataUri(posterUrl);
    if (dataUri) {
      return {
        dataUri,
        type: 'photo', // Using poster frame as still image
        attribution: `Video still from Pexels`,
      };
    }
  }

  return null;
}
