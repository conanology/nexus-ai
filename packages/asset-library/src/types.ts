/**
 * Shared type definitions for @nexus-ai/asset-library.
 */

export type { LogoEntry } from './logos.js';

/** A logo entry enriched with a fetched image data URI */
export interface FetchedLogo {
  name: string;
  abbreviation: string;
  color: string;
  /** Base64 data URI of the logo image, or null if fetch failed */
  dataUri: string | null;
}
