/**
 * Logo Fetcher Integration Tests
 *
 * These tests make REAL HTTP requests to Clearbit and Google APIs.
 * They will fail if the machine has no internet access.
 */

import { describe, it, expect } from 'vitest';
import {
  fetchLogo,
  fetchLogosForScene,
  logoBufferToDataUri,
  getLogoDomain,
  getLogoEntry,
} from '../index.js';

// Generous timeout for network requests
const NETWORK_TIMEOUT = 30_000;

describe('getLogoDomain', () => {
  it('returns domain for known company (lowercase)', () => {
    expect(getLogoDomain('google')).toBe('google.com');
  });

  it('returns domain for known company (mixed case)', () => {
    expect(getLogoDomain('Google')).toBe('google.com');
  });

  it('returns domain for known company (uppercase)', () => {
    expect(getLogoDomain('GOOGLE')).toBe('google.com');
  });

  it('returns domain with trimmed whitespace', () => {
    expect(getLogoDomain('  google  ')).toBe('google.com');
  });

  it('returns null for unknown company', () => {
    expect(getLogoDomain('NonexistentCompany123')).toBeNull();
  });

  it('returns correct domains for all registered companies', () => {
    expect(getLogoDomain('salesforce')).toBe('salesforce.com');
    expect(getLogoDomain('slack')).toBe('slack.com');
    expect(getLogoDomain('notion')).toBe('notion.so');
    expect(getLogoDomain('openai')).toBe('openai.com');
    expect(getLogoDomain('nvidia')).toBe('nvidia.com');
    expect(getLogoDomain('stripe')).toBe('stripe.com');
  });
});

describe('getLogoEntry', () => {
  it('returns full entry with domain field', () => {
    const entry = getLogoEntry('google');
    expect(entry).toBeDefined();
    expect(entry!.domain).toBe('google.com');
    expect(entry!.name).toBe('Google');
    expect(entry!.abbreviation).toBe('G');
    expect(entry!.color).toBe('#4285F4');
  });
});

describe('logoBufferToDataUri', () => {
  it('converts a buffer to a valid data URI', () => {
    const fakeImageData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const dataUri = logoBufferToDataUri(fakeImageData);
    expect(dataUri).toMatch(/^data:image\/png;base64,/);
    expect(dataUri.length).toBeGreaterThan('data:image/png;base64,'.length);
  });

  it('produces valid base64 that can be decoded back', () => {
    const original = Buffer.from('hello world');
    const dataUri = logoBufferToDataUri(original);
    const base64Part = dataUri.replace('data:image/png;base64,', '');
    const decoded = Buffer.from(base64Part, 'base64');
    expect(decoded.toString()).toBe('hello world');
  });
});

describe('fetchLogo (network)', () => {
  it('fetches a logo for google.com', async () => {
    const buffer = await fetchLogo('google.com');
    expect(buffer).not.toBeNull();
    expect(buffer!.length).toBeGreaterThan(100);
  }, NETWORK_TIMEOUT);

  it('returns null for a nonexistent domain', async () => {
    const buffer = await fetchLogo('this-domain-does-not-exist-zzz123.fake');
    expect(buffer).toBeNull();
  }, NETWORK_TIMEOUT);
});

describe('fetchLogosForScene (network)', () => {
  it('fetches logos for multiple companies including unknown ones', async () => {
    const results = await fetchLogosForScene(['Google', 'OpenAI', 'NonexistentCompany123']);

    // Google should succeed
    const googleBuffer = results.get('Google');
    expect(googleBuffer).not.toBeNull();
    expect(googleBuffer!.length).toBeGreaterThan(100);

    // OpenAI should succeed
    const openaiBuffer = results.get('OpenAI');
    expect(openaiBuffer).not.toBeNull();

    // Unknown company has no domain → null
    const unknownBuffer = results.get('NonexistentCompany123');
    expect(unknownBuffer).toBeNull();
  }, NETWORK_TIMEOUT);
});
