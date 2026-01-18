
import { describe, it, expect, vi } from 'vitest';
import { loadAffiliateLinks } from '../metadata.js';
import { readFile } from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises');

describe('Affiliate Loading', () => {
    it('should load and parse affiliates', async () => {
        const mockJson = JSON.stringify({
            links: [{ name: 'Test', url: 'http://test.com', category: 'tools' }],
            utmParams: { utm_source: 'youtube' },
            disclosureText: 'Ad'
        });
        
        vi.mocked(readFile).mockResolvedValue(mockJson);
        
        // We might need to pass a mock path if the function expects one, or it uses a default.
        // Assuming it uses a default relative to project root or similar.
        const config = await loadAffiliateLinks();
        expect(config.links).toHaveLength(1);
        expect(config.links[0].name).toBe('Test');
    });

    it('should generate full URLs with UTM params', async () => {
        const mockJson = JSON.stringify({
            links: [{ name: 'Test', url: 'http://test.com', category: 'tools' }],
            utmParams: { utm_source: 'test' },
            disclosureText: 'Ad'
        });
        
        vi.mocked(readFile).mockResolvedValue(mockJson);
        
        const config = await loadAffiliateLinks();
        expect(config.links[0].fullUrl).toContain('utm_source=test');
        expect(config.links[0].fullUrl).toContain('http://test.com');
    });
});
