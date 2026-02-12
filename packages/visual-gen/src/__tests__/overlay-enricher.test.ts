/**
 * Overlay Enricher Tests
 *
 * Validates that enrichScenesWithOverlays correctly adds contextual overlays:
 * - Corner logos for company mentions
 * - Source citations for stats
 * - Floating labels for comparisons
 * - Info badges for chapter breaks
 * - Respects max overlay limits and excluded scene types
 */

import { describe, it, expect } from 'vitest';
import { enrichScenesWithOverlays } from '../overlay-enricher.js';
import type { Scene } from '@nexus-ai/director-agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(overrides: Partial<Scene> & { type: Scene['type']; content: string }): Scene {
  return {
    id: `scene-${Math.random().toString(36).slice(2, 8)}`,
    startFrame: 0,
    endFrame: 150,
    visualData: {},
    transition: 'cut',
    ...overrides,
  };
}

const emptyLogos = new Map<string, string | null>();

// ---------------------------------------------------------------------------
// Corner Logo Overlays
// ---------------------------------------------------------------------------

describe('enrichScenesWithOverlays — corner logos', () => {
  it('adds a corner-logo overlay when scene mentions Klarna', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'Klarna replaced 700 full-time agents with AI.',
        visualData: { number: '700', label: 'agents replaced' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    expect(scenes[0].overlays).toBeDefined();
    const cornerLogo = scenes[0].overlays!.find((o) => o.type === 'corner-logo');
    expect(cornerLogo).toBeDefined();
    expect((cornerLogo as any).companyName).toBe('Klarna');
    expect((cornerLogo as any).brandColor).toBe('#FFB3C7');
    expect(cornerLogo!.position).toBe('top-right');
  });

  it('uses logoSrc from fetchedLogos map when available', () => {
    const scenes = [
      makeScene({
        type: 'narration-default',
        content: 'Salesforce is a major player in the CRM space.',
        visualData: { backgroundVariant: 'gradient' },
      }),
    ];

    const logos = new Map<string, string | null>([
      ['Salesforce', 'data:image/png;base64,fakeSalesforceData'],
    ]);

    enrichScenesWithOverlays(scenes, logos);

    const cornerLogo = scenes[0].overlays!.find((o) => o.type === 'corner-logo');
    expect(cornerLogo).toBeDefined();
    expect((cornerLogo as any).logoSrc).toBe('data:image/png;base64,fakeSalesforceData');
  });

  it('does NOT add corner-logo to logo-showcase scenes', () => {
    const scenes = [
      makeScene({
        type: 'logo-showcase',
        content: 'Think about giants like Salesforce, Slack, or Atlassian.',
        visualData: {
          logos: [{ name: 'Salesforce' }, { name: 'Slack' }],
          layout: 'sequential',
        },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const hasCornerLogo = scenes[0].overlays?.some((o) => o.type === 'corner-logo');
    expect(hasCornerLogo).toBeFalsy();
  });

  it('adds at most 1 corner-logo per scene (picks first/longest match)', () => {
    const scenes = [
      makeScene({
        type: 'text-emphasis',
        content: 'Microsoft and Google are competing in the AI space.',
        visualData: { phrase: 'Microsoft and Google competing', style: 'fade' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const cornerLogos = scenes[0].overlays?.filter((o) => o.type === 'corner-logo') ?? [];
    expect(cornerLogos.length).toBe(1);
    // Microsoft is longer than Google so should be picked first
    expect((cornerLogos[0] as any).companyName).toBe('Microsoft');
  });

  it('does not add corner-logo when no companies are mentioned', () => {
    const scenes = [
      makeScene({
        type: 'narration-default',
        content: 'The landscape of enterprise software is changing.',
        visualData: { backgroundVariant: 'gradient' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const hasCornerLogo = scenes[0].overlays?.some((o) => o.type === 'corner-logo');
    expect(hasCornerLogo).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// Source Citation Overlays
// ---------------------------------------------------------------------------

describe('enrichScenesWithOverlays — source citations', () => {
  it('adds a source-citation overlay to stat-callout scenes', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'The AI performed the work of 700 agents.',
        visualData: { number: '700', label: 'agents replaced' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const citation = scenes[0].overlays!.find((o) => o.type === 'source-citation');
    expect(citation).toBeDefined();
    expect(citation!.position).toBe('bottom-left');
    expect((citation as any).source).toContain('Source:');
  });

  it('extracts named citation from "according to" pattern', () => {
    const scenes = [
      makeScene({
        type: 'text-emphasis',
        content: 'According to McKinsey, AI will transform every industry.',
        visualData: { phrase: 'AI will transform every industry', style: 'fade' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const citation = scenes[0].overlays?.find((o) => o.type === 'source-citation');
    expect(citation).toBeDefined();
    expect((citation as any).source).toContain('McKinsey');
  });

  it('source-citation delay is 30 frames', () => {
    const scenes = [
      makeScene({
        type: 'stat-callout',
        content: 'Revenue reached 2 billion dollars.',
        visualData: { number: '2', label: 'billion in revenue', suffix: 'B' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const citation = scenes[0].overlays!.find((o) => o.type === 'source-citation');
    expect(citation!.delayFrames).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// Floating Label Overlays
// ---------------------------------------------------------------------------

describe('enrichScenesWithOverlays — floating labels', () => {
  it('adds floating labels to comparison scenes', () => {
    const scenes = [
      makeScene({
        type: 'comparison',
        content: 'Old approach vs new approach.',
        visualData: {
          left: { title: 'Legacy Monolith', items: ['Slow deploys'] },
          right: { title: 'Microservices', items: ['Fast iteration'] },
        },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const labels = scenes[0].overlays!.filter((o) => o.type === 'floating-label');
    expect(labels.length).toBe(2);

    const leftLabel = labels.find((l) => l.position === 'top-left');
    const rightLabel = labels.find((l) => l.position === 'top-right');
    expect(leftLabel).toBeDefined();
    expect(rightLabel).toBeDefined();
    expect((leftLabel as any).text).toBe('THE OLD WAY');
    expect((rightLabel as any).text).toBe('THE NEW WAY');
  });
});

// ---------------------------------------------------------------------------
// Info Badge Overlays
// ---------------------------------------------------------------------------

describe('enrichScenesWithOverlays — info badges', () => {
  it('adds chapter number badge to chapter-break scenes', () => {
    const scenes = [
      makeScene({
        type: 'chapter-break',
        content: 'The Rise of AI Agents',
        visualData: { title: 'The Rise of AI Agents', chapterNumber: 2 },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const badge = scenes[0].overlays!.find((o) => o.type === 'info-badge');
    expect(badge).toBeDefined();
    expect((badge as any).label).toBe('Chapter 2');
    expect((badge as any).icon).toBe('📖');
  });

  it('does not add chapter badge when no chapter number', () => {
    const scenes = [
      makeScene({
        type: 'chapter-break',
        content: 'New Section',
        visualData: { title: 'New Section' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    const badge = scenes[0].overlays?.find((o) => o.type === 'info-badge');
    expect(badge).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Excluded Scene Types & Max Overlays
// ---------------------------------------------------------------------------

describe('enrichScenesWithOverlays — exclusions and limits', () => {
  it('does NOT add overlays to intro scenes', () => {
    const scenes = [
      makeScene({
        type: 'intro',
        content: 'Welcome to the show about Salesforce and Google.',
        visualData: { episodeTitle: 'Tech Giants' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);
    expect(scenes[0].overlays).toBeUndefined();
  });

  it('does NOT add overlays to outro scenes', () => {
    const scenes = [
      makeScene({
        type: 'outro',
        content: 'Thanks for watching. According to Google, AI is here.',
        visualData: { nextTopicTeaser: 'Next up: AI Revolution' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);
    expect(scenes[0].overlays).toBeUndefined();
  });

  it('does NOT add overlays to code-block scenes', () => {
    const scenes = [
      makeScene({
        type: 'code-block',
        content: 'Salesforce API example code.',
        visualData: { code: 'const sf = new Salesforce();', language: 'javascript' },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);
    expect(scenes[0].overlays).toBeUndefined();
  });

  it('enforces max 4 overlays per scene', () => {
    // comparison + company mention = floating-label x2 + corner-logo + source-citation = 4
    const scenes = [
      makeScene({
        type: 'comparison',
        content: 'According to Gartner, Klarna vs Stripe in the payments space.',
        visualData: {
          left: { title: 'Klarna', items: ['Buy now pay later'] },
          right: { title: 'Stripe', items: ['Developer-first'] },
        },
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    expect(scenes[0].overlays!.length).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Multiple scenes
// ---------------------------------------------------------------------------

describe('enrichScenesWithOverlays — multi-scene', () => {
  it('enriches multiple scenes independently', () => {
    const scenes = [
      makeScene({
        type: 'intro',
        content: 'Welcome',
        visualData: {},
      }),
      makeScene({
        type: 'stat-callout',
        content: 'Klarna replaced 700 agents.',
        visualData: { number: '700', label: 'agents replaced' },
      }),
      makeScene({
        type: 'comparison',
        content: 'Old vs New',
        visualData: {
          left: { title: 'Old', items: [] },
          right: { title: 'New', items: [] },
        },
      }),
      makeScene({
        type: 'outro',
        content: 'Goodbye',
        visualData: {},
      }),
    ];

    enrichScenesWithOverlays(scenes, emptyLogos);

    // intro: no overlays
    expect(scenes[0].overlays).toBeUndefined();

    // stat-callout about Klarna: should have corner-logo + source-citation
    expect(scenes[1].overlays).toBeDefined();
    expect(scenes[1].overlays!.some((o) => o.type === 'corner-logo')).toBe(true);
    expect(scenes[1].overlays!.some((o) => o.type === 'source-citation')).toBe(true);

    // comparison: should have floating labels
    expect(scenes[2].overlays).toBeDefined();
    expect(scenes[2].overlays!.filter((o) => o.type === 'floating-label').length).toBe(2);

    // outro: no overlays
    expect(scenes[3].overlays).toBeUndefined();
  });
});
