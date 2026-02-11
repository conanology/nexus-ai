import { describe, it, expect } from 'vitest';
import { WORLD_MAP_PATHS, COUNTRY_BY_CODE } from '../world-map-paths.js';

describe('world-map-paths', () => {
  it('has entries for at least 50 countries', () => {
    expect(WORLD_MAP_PATHS.length).toBeGreaterThanOrEqual(50);
  });

  it('each entry has code, name, path (non-empty), and center (2-element array)', () => {
    for (const country of WORLD_MAP_PATHS) {
      expect(typeof country.code).toBe('string');
      expect(country.code.length).toBe(2);
      expect(typeof country.name).toBe('string');
      expect(country.name.length).toBeGreaterThan(0);
      expect(typeof country.path).toBe('string');
      expect(country.path.length).toBeGreaterThan(5);
      expect(country.path).toMatch(/^M/); // SVG path starts with M
      expect(Array.isArray(country.center)).toBe(true);
      expect(country.center).toHaveLength(2);
      expect(typeof country.center[0]).toBe('number');
      expect(typeof country.center[1]).toBe('number');
    }
  });

  it('US, GB, DE, JP, AU are all present', () => {
    const codes = WORLD_MAP_PATHS.map((c) => c.code);
    expect(codes).toContain('US');
    expect(codes).toContain('GB');
    expect(codes).toContain('DE');
    expect(codes).toContain('JP');
    expect(codes).toContain('AU');
  });

  it('no duplicate country codes', () => {
    const codes = WORLD_MAP_PATHS.map((c) => c.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it('COUNTRY_BY_CODE lookup map works correctly', () => {
    const us = COUNTRY_BY_CODE.get('US');
    expect(us).toBeDefined();
    expect(us!.name).toBe('United States');
    expect(us!.code).toBe('US');
  });

  it('center coordinates are within frame bounds (1920x1080)', () => {
    for (const country of WORLD_MAP_PATHS) {
      expect(country.center[0]).toBeGreaterThanOrEqual(0);
      expect(country.center[0]).toBeLessThanOrEqual(1920);
      expect(country.center[1]).toBeGreaterThanOrEqual(0);
      expect(country.center[1]).toBeLessThanOrEqual(1080);
    }
  });

  it('contains required countries from the spec', () => {
    const required = [
      'US', 'CA', 'MX', 'BR', 'AR', 'GB', 'FR', 'DE', 'ES', 'IT',
      'NL', 'SE', 'NO', 'FI', 'DK', 'PL', 'RU', 'UA', 'TR', 'IN',
      'CN', 'JP', 'KR', 'AU', 'NZ', 'ZA', 'NG', 'EG', 'SA', 'AE',
      'IL', 'SG', 'ID', 'TH', 'VN', 'PH', 'MY', 'CO', 'CL', 'PE',
      'CH', 'AT', 'BE', 'IE', 'PT', 'CZ', 'HU', 'RO', 'GR', 'TW',
    ];
    const codes = new Set(WORLD_MAP_PATHS.map((c) => c.code));
    for (const code of required) {
      expect(codes.has(code), `Missing country: ${code}`).toBe(true);
    }
  });
});
