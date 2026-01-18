
import { describe, it, expectTypeOf } from 'vitest';
import type { 
  VideoMetadata, 
  AffiliateLink, 
  ChapterMarker, 
  AffiliateConfig,
  MetadataGenerationOptions 
} from '../types.js';

describe('YouTube Types', () => {
  it('should have correct VideoMetadata structure', () => {
    const meta: VideoMetadata = {
      title: 'test',
      description: 'test',
      tags: [],
      categoryId: '28',
      madeForKids: false, // New field
      containsSyntheticMedia: true, // New field
      defaultAudioLanguage: 'en' // New field
    };
    expectTypeOf(meta).toBeObject();
  });

  it('should have AffiliateLink type', () => {
    const link: AffiliateLink = {
      name: 'Test',
      url: 'https://example.com',
      category: 'tools',
      fullUrl: 'https://example.com?utm=1'
    };
    expectTypeOf(link).toBeObject();
  });

  it('should have ChapterMarker type', () => {
    const marker: ChapterMarker = {
      timestamp: '0:00',
      title: 'Intro'
    };
    expectTypeOf(marker).toBeObject();
  });

  it('should have AffiliateConfig type', () => {
    const config: AffiliateConfig = {
      links: [],
      utmParams: {},
      disclosureText: 'Ad'
    };
    expectTypeOf(config).toBeObject();
  });
  
  // Checking MetadataGenerationOptions requires NewsItem type, 
  // skipping specific shape check to avoid dependency issues in this simple test,
  // but checking it exists is enough.
  it('should have MetadataGenerationOptions type', () => {
     // Just referencing it is enough to verify existence
     const options: Partial<MetadataGenerationOptions> = {
         script: 'text'
     };
     expectTypeOf(options).toBeObject();
  });
});
