import { describe, it, expect } from 'vitest';
import { enrichScenesWithGeoData, resolveCountriesFromText } from '../geo-enricher.js';
import type { Scene } from '@nexus-ai/director-agent';

/** Helper to create a map-animation scene */
function makeMapScene(overrides: Partial<Scene> & { visualData?: Record<string, unknown> } = {}): Scene {
  return {
    id: 'map-1',
    type: 'map-animation',
    startFrame: 0,
    endFrame: 150,
    content: 'The company operates globally.',
    visualData: {
      mapType: 'world',
      highlightedCountries: [],
      animationStyle: 'simultaneous',
    },
    ...overrides,
  } as Scene;
}

describe('resolveCountriesFromText', () => {
  it('resolves "United States" to US', () => {
    const result = resolveCountriesFromText('Expanding to the United States market.');
    expect(result).toContain('US');
  });

  it('resolves "UK and Germany" to GB and DE', () => {
    const result = resolveCountriesFromText('Operating in the UK and Germany.');
    expect(result).toContain('GB');
    expect(result).toContain('DE');
  });

  it('resolves "South Korea" before "Korea"', () => {
    const result = resolveCountriesFromText('South Korea is a tech hub.');
    expect(result).toContain('KR');
    expect(result).toHaveLength(1);
  });

  it('returns empty array for text with no country names', () => {
    const result = resolveCountriesFromText('The algorithm is fast and efficient.');
    expect(result).toHaveLength(0);
  });
});

describe('enrichScenesWithGeoData', () => {
  it('keeps existing valid ISO codes', () => {
    const scene = makeMapScene({
      visualData: {
        mapType: 'world',
        highlightedCountries: ['US', 'GB', 'DE'],
        animationStyle: 'simultaneous',
      },
    });
    enrichScenesWithGeoData([scene]);
    const vd = scene.visualData as { highlightedCountries: string[] };
    expect(vd.highlightedCountries).toContain('US');
    expect(vd.highlightedCountries).toContain('GB');
    expect(vd.highlightedCountries).toContain('DE');
  });

  it('resolves country names from text when no codes set', () => {
    const scene = makeMapScene({
      content: 'The company expanded to the United States and Japan.',
    });
    enrichScenesWithGeoData([scene]);
    const vd = scene.visualData as { highlightedCountries: string[] };
    expect(vd.highlightedCountries).toContain('US');
    expect(vd.highlightedCountries).toContain('JP');
  });

  it('sets animationStyle to simultaneous for 3 countries', () => {
    const scene = makeMapScene({
      visualData: {
        mapType: 'world',
        highlightedCountries: ['US', 'GB', 'DE'],
        animationStyle: 'sequential', // will be overridden
      },
    });
    enrichScenesWithGeoData([scene]);
    const vd = scene.visualData as { animationStyle: string };
    expect(vd.animationStyle).toBe('simultaneous');
  });

  it('sets animationStyle to sequential for 10 countries', () => {
    const scene = makeMapScene({
      visualData: {
        mapType: 'world',
        highlightedCountries: ['US', 'GB', 'DE', 'FR', 'JP', 'KR', 'IN', 'AU', 'BR', 'CA'],
        animationStyle: 'simultaneous',
      },
    });
    enrichScenesWithGeoData([scene]);
    const vd = scene.visualData as { animationStyle: string };
    expect(vd.animationStyle).toBe('sequential');
  });

  it('sets animationStyle to pulse for 20 countries', () => {
    const countries = [
      'US', 'GB', 'DE', 'FR', 'JP', 'KR', 'IN', 'AU', 'BR', 'CA',
      'MX', 'IT', 'ES', 'NL', 'SE', 'NO', 'FI', 'PL', 'RU', 'CN',
    ];
    const scene = makeMapScene({
      visualData: {
        mapType: 'world',
        highlightedCountries: countries,
        animationStyle: 'simultaneous',
      },
    });
    enrichScenesWithGeoData([scene]);
    const vd = scene.visualData as { animationStyle: string };
    expect(vd.animationStyle).toBe('pulse');
  });

  it('defaults to top 10 tech hubs when no countries can be resolved', () => {
    const scene = makeMapScene({
      content: 'The algorithm is very efficient.',
    });
    enrichScenesWithGeoData([scene]);
    const vd = scene.visualData as { highlightedCountries: string[] };
    expect(vd.highlightedCountries.length).toBe(10);
    expect(vd.highlightedCountries).toContain('US');
    expect(vd.highlightedCountries).toContain('JP');
    expect(vd.highlightedCountries).toContain('AU');
  });

  it('sets SFX to reveal', () => {
    const scene = makeMapScene();
    enrichScenesWithGeoData([scene]);
    expect(scene.sfx).toEqual(['reveal']);
  });

  it('does not modify non-map scenes', () => {
    const scene: Scene = {
      id: 'stat-1',
      type: 'stat-callout',
      startFrame: 0,
      endFrame: 150,
      content: 'Revenue grew 200%',
      visualData: { number: '200', label: 'growth', suffix: '%' },
    } as Scene;
    enrichScenesWithGeoData([scene]);
    expect(scene.sfx).toBeUndefined();
  });

  it('preserves existing SFX if already set', () => {
    const scene = makeMapScene({ sfx: ['whoosh-in'] });
    enrichScenesWithGeoData([scene]);
    expect(scene.sfx).toEqual(['whoosh-in']);
  });
});
