import { generateTitle, generateDescription, generateTags, extractChapterMarkers, generateMetadata } from '../metadata.js';
import type { NewsItem } from '@nexus-ai/news-sourcing';
import type { AffiliateLink } from '../types.js';
import { vi, describe, it, expect } from 'vitest';

// Mock NewsItem factory
const createTopic = (overrides: Partial<NewsItem> = {}): NewsItem => ({
    id: '123',
    title: 'New AI Model Released',
    url: 'https://example.com',
    source: 'techcrunch',
    publishedAt: '2026-01-18',
    summary: 'A new model is here',
    relevanceScore: 10,
    viralityScore: 50,
    entities: [],
    sentiment: 'positive',
    category: 'AI',
    ...overrides
});

// Mock Firestore and Logger
const mockFirestore = {
    doc: vi.fn().mockReturnThis(),
    set: vi.fn().mockResolvedValue({})
};

// Mock fs/promises to return affiliate config
vi.mock('fs/promises', () => ({
    readFile: vi.fn().mockResolvedValue(JSON.stringify({
        links: [
            { name: 'Tool1', url: 'https://example.com/tool1', category: 'AI' },
            { name: 'Tool2', url: 'https://example.com/tool2', category: 'ML' }
        ],
        utmParams: { utm_source: 'nexus', utm_medium: 'video', utm_campaign: 'affiliate' },
        disclosureText: 'Some links are affiliate links.'
    }))
}));

vi.mock('@nexus-ai/core', async () => {
    // Mock NexusError class with static factory methods
    class NexusError extends Error {
        code: string;
        severity: string;
        stage?: string;
        context?: Record<string, unknown>;
        
        constructor(code: string, message: string, severity: string, stage?: string, context?: Record<string, unknown>) {
            super(message);
            this.code = code;
            this.severity = severity;
            this.stage = stage;
            this.context = context;
            this.name = 'NexusError';
        }
        
        static retryable(code: string, message: string, stage?: string, context?: Record<string, unknown>): NexusError {
            return new NexusError(code, message, 'RETRYABLE', stage, context);
        }
        
        static fallback(code: string, message: string, stage?: string, context?: Record<string, unknown>): NexusError {
            return new NexusError(code, message, 'FALLBACK', stage, context);
        }
        
        static degraded(code: string, message: string, stage?: string, context?: Record<string, unknown>): NexusError {
            return new NexusError(code, message, 'DEGRADED', stage, context);
        }
        
        static recoverable(code: string, message: string, stage?: string, context?: Record<string, unknown>): NexusError {
            return new NexusError(code, message, 'RECOVERABLE', stage, context);
        }
        
        static critical(code: string, message: string, stage?: string, context?: Record<string, unknown>): NexusError {
            return new NexusError(code, message, 'CRITICAL', stage, context);
        }
        
        static fromError(error: unknown, stage?: string): NexusError {
            if (error instanceof NexusError) {
                return error;
            }
            const message = error instanceof Error ? error.message : String(error);
            return new NexusError('NEXUS_UNKNOWN_ERROR', message, 'CRITICAL', stage);
        }
    }
    
    return {
        FirestoreClient: {
            getInstance: () => mockFirestore
        },
        createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
        NexusError
    };
});

describe('Metadata Generation', () => {
    describe('generateTitle', () => {
        it('should generate a title within 100 characters', () => {
            const longTitleTopic = createTopic({ title: 'A'.repeat(200) });
            const title = generateTitle(longTitleTopic, '');
            expect(title.length).toBeLessThanOrEqual(100);
        });

        it('should sanitize < and > characters', () => {
            const badTopic = createTopic({ title: 'New <AI> Model > GPT-4' });
            const title = generateTitle(badTopic, '');
            expect(title).not.toContain('<');
            expect(title).not.toContain('>');
        });

        it('should use engaging patterns', () => {
            const title = generateTitle(createTopic(), '');
            expect(title.length).toBeGreaterThan(0);
        });
        
        it('should handle high virality topics with BREAKING prefix', () => {
             const viralTopic = createTopic({ viralityScore: 101, title: 'Super Big News' });
             const title = generateTitle(viralTopic, '');
             expect(title).toContain('BREAKING');
        });
        
        it('should handle research papers (arxiv/huggingface)', () => {
             const paperTopic = createTopic({ source: 'arxiv', title: 'Attention Is All You Need' });
             const title = generateTitle(paperTopic, '');
             expect(title).toContain('Explained');
        });
    });

    describe('generateDescription', () => {
        const mockAffiliates: AffiliateLink[] = [
            { name: 'Test Tool', url: 'https://tool.com', category: 'tools', fullUrl: 'https://tool.com?ref=me' }
        ];

        it('should validate byte length < 5000', () => {
             const longScript = '👋'.repeat(1500); 
             const desc = generateDescription(createTopic(), longScript, [], mockAffiliates);
             expect(Buffer.byteLength(desc, 'utf8')).toBeLessThanOrEqual(5000);
        });

        it('should include required sections', () => {
            const desc = generateDescription(createTopic(), 'Hook. Intro. Content.', ['http://test.com'], []);
            expect(desc).toContain("Today's Topics:");
            expect(desc).toContain("Links Mentioned:");
            expect(desc).toContain("#NEXUSAI");
        });

        it('should include affiliate links with disclosure when provided', () => {
            const desc = generateDescription(createTopic(), 'Script', [], mockAffiliates);
            expect(desc).toContain('Affiliate Links (support the channel):');
            expect(desc).toContain('Some links are affiliate links');
            expect(desc).toContain('https://tool.com?ref=me');
        });

        it('should NOT include affiliate section if no links provided', () => {
            const desc = generateDescription(createTopic(), 'Script', [], []);
            expect(desc).not.toContain('Affiliate Links');
        });
    });

    describe('generateTags', () => {
        it('should include base tags', () => {
             const tags = generateTags(createTopic(), '');
             expect(tags).toContain('AI');
             expect(tags).toContain('NEXUSAI');
        });

        it('should include source-specific tags', () => {
             const hfTopic = createTopic({ source: 'huggingface' });
             const tags = generateTags(hfTopic, '');
             expect(tags).toContain('HuggingFace');
        });

        it('should not exceed 500 characters constraint', () => {
            const tags = generateTags(createTopic({ title: "Very Long ".repeat(10) }), "keyword ".repeat(100));
            const totalLen = tags.reduce((sum, tag, idx) => {
                const quote = tag.includes(' ') ? 2 : 0;
                const comma = idx > 0 ? 1 : 0;
                return sum + tag.length + quote + comma;
            }, 0);
            expect(totalLen).toBeLessThanOrEqual(500);
        });
    });

    describe('extractChapterMarkers', () => {
        const mockScript = `
        Start info.
        [VISUAL: Show logo]
        Intro text here.
        [VISUAL: Show chart]
        Topic 1 detail.
        [VISUAL: Show code]
        Topic 2 detail.
        `;

        it('should start with 0:00 Introduction', () => {
            const markers = extractChapterMarkers(mockScript, 60);
            expect(markers[0].timestamp).toBe('0:00');
            expect(markers[0].title).toBe('Introduction');
        });

        it('should extract markers from visual cues', () => {
            const markers = extractChapterMarkers(mockScript, 60);
            expect(markers.length).toBeGreaterThan(1);
        });

        it('should calculate timestamps proportionally', () => {
            const markers = extractChapterMarkers(mockScript, 60);
            expect(markers[1].timestamp).toMatch(/^\d+:\d{2}$/);
        });
    });

    describe('generateMetadata', () => {
        it('should orchestrate generation and return complete metadata', async () => {
            const options = {
                topic: createTopic(),
                script: "Intro.\n[VISUAL: Cue]\nContent.",
                sourceUrls: ['http://source.com'],
                pipelineId: '2026-01-18',
                audioDuration: 120
            };
            
            const metadata = await generateMetadata(options);
            
            expect(metadata.title).toBeDefined();
            expect(metadata.description).toBeDefined();
            expect(metadata.tags).toBeTruthy(); 
            expect(metadata.madeForKids).toBe(false);
            expect(metadata.containsSyntheticMedia).toBe(true);
            
            // Verify Firestore call
            expect(mockFirestore.doc).toHaveBeenCalledWith('pipelines/2026-01-18/youtube/metadata');
            expect(mockFirestore.set).toHaveBeenCalled();
        });
    });
});
