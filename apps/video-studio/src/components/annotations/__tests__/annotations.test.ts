/**
 * Hand-drawn Annotation Component Tests
 *
 * Tests the pure SVG path generation functions extracted from annotation components.
 * Validates wobble determinism, circle gap, arrow curves, and underline styles.
 */

import { describe, it, expect } from 'vitest';
import { generateCirclePath } from '../HanddrawnCircle.js';
import { generateArrowPaths } from '../HanddrawnArrow.js';
import { generateUnderlinePath, generateSquigglyPath } from '../HanddrawnUnderline.js';
import { generateXPaths } from '../HanddrawnX.js';

// ---------------------------------------------------------------------------
// HanddrawnCircle
// ---------------------------------------------------------------------------

describe('HanddrawnCircle — generateCirclePath', () => {
  it('generates a path with ~48 points', () => {
    const { d } = generateCirclePath(960, 420, 200, 80, 4);
    // Count L commands (one per point after the M command)
    const lCount = (d.match(/ L /g) || []).length;
    // Should have 47 L commands (48 points - 1 M command)
    expect(lCount).toBe(47);
  });

  it('wobble offsets are deterministic (same props → same path)', () => {
    const path1 = generateCirclePath(960, 420, 200, 80, 4);
    const path2 = generateCirclePath(960, 420, 200, 80, 4);
    expect(path1.d).toBe(path2.d);
    expect(path1.length).toBe(path2.length);
  });

  it('different center coords produce different wobble patterns', () => {
    const path1 = generateCirclePath(100, 100, 50, 50, 4);
    const path2 = generateCirclePath(500, 800, 50, 50, 4);
    expect(path1.d).not.toBe(path2.d);
  });

  it('circle path has a gap (does not perfectly close)', () => {
    const { d } = generateCirclePath(960, 540, 100, 100, 4);
    // Parse the first point (after M) and the last point (last L)
    const mMatch = d.match(/^M ([\d.-]+) ([\d.-]+)/);
    const lMatches = [...d.matchAll(/L ([\d.-]+) ([\d.-]+)/g)];
    const lastL = lMatches[lMatches.length - 1];

    expect(mMatch).not.toBeNull();
    expect(lastL).not.toBeNull();

    const startX = parseFloat(mMatch![1]);
    const startY = parseFloat(mMatch![2]);
    const endX = parseFloat(lastL[1]);
    const endY = parseFloat(lastL[2]);

    // Gap should exist — end point should NOT be the same as start
    const gapDistance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    expect(gapDistance).toBeGreaterThan(2); // At least a few pixels apart
  });

  it('path length is a positive number', () => {
    const { length } = generateCirclePath(960, 420, 200, 80, 4);
    expect(length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// HanddrawnArrow
// ---------------------------------------------------------------------------

describe('HanddrawnArrow — generateArrowPaths', () => {
  it('generates body and head paths', () => {
    const { bodyD, bodyLength, headD, headLength } = generateArrowPaths(
      400, 540, 1520, 540, 3, true, 14,
    );
    expect(bodyD).toBeTruthy();
    expect(bodyLength).toBeGreaterThan(0);
    expect(headD).toBeTruthy();
    expect(headLength).toBeGreaterThan(0);
  });

  it('curved=true produces a path that deviates from a straight line', () => {
    const curved = generateArrowPaths(0, 0, 1000, 0, 3, true, 14);
    const straight = generateArrowPaths(0, 0, 1000, 0, 3, false, 14);

    // The body paths should differ when curved vs straight
    expect(curved.bodyD).not.toBe(straight.bodyD);
  });

  it('arrowhead path contains 2 line segments from the tip', () => {
    const { headD } = generateArrowPaths(100, 100, 500, 100, 3, true, 14);
    // Head should have M + L + L pattern
    const mCount = (headD.match(/M /g) || []).length;
    const lCount = (headD.match(/L /g) || []).length;
    expect(mCount).toBe(1);
    expect(lCount).toBe(2);
  });

  it('is deterministic', () => {
    const a = generateArrowPaths(400, 540, 1520, 540, 3, true, 14);
    const b = generateArrowPaths(400, 540, 1520, 540, 3, true, 14);
    expect(a.bodyD).toBe(b.bodyD);
    expect(a.headD).toBe(b.headD);
  });
});

// ---------------------------------------------------------------------------
// HanddrawnUnderline
// ---------------------------------------------------------------------------

describe('HanddrawnUnderline — path generation', () => {
  it('single underline generates a wobbly line path', () => {
    const { d, length } = generateUnderlinePath(460, 620, 1000, 2);
    expect(d).toBeTruthy();
    expect(length).toBeGreaterThan(0);
    // Should span roughly the width
    expect(length).toBeGreaterThan(900);
    expect(length).toBeLessThan(1200);
  });

  it('squiggly style generates sine wave pattern', () => {
    const { d, length } = generateSquigglyPath(460, 620, 1000);
    expect(d).toBeTruthy();
    // Squiggly should be longer than the straight width due to the sine wave
    expect(length).toBeGreaterThan(1000);

    // Parse Y values from the path to check they oscillate
    const yValues: number[] = [];
    const matches = [...d.matchAll(/([\d.-]+) ([\d.-]+)/g)];
    for (const m of matches) {
      yValues.push(parseFloat(m[2]));
    }

    // Find min and max Y — there should be a spread due to the sine wave
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    expect(maxY - minY).toBeGreaterThan(2); // amplitude is 3, so spread should be ~6
  });
});

// ---------------------------------------------------------------------------
// HanddrawnX
// ---------------------------------------------------------------------------

describe('HanddrawnX — generateXPaths', () => {
  it('generates two diagonal line paths', () => {
    const lines = generateXPaths(400, 300, 30);
    expect(lines.length).toBe(2);
    expect(lines[0].d).toBeTruthy();
    expect(lines[0].length).toBeGreaterThan(0);
    expect(lines[1].d).toBeTruthy();
    expect(lines[1].length).toBeGreaterThan(0);
  });

  it('lines cross near the center point', () => {
    const cx = 400;
    const cy = 300;
    const lines = generateXPaths(cx, cy, 30);

    // Each line should start and end roughly equidistant from center
    for (const line of lines) {
      const coords = [...line.d.matchAll(/([\d.-]+) ([\d.-]+)/g)];
      const startX = parseFloat(coords[0][1]);
      const startY = parseFloat(coords[0][2]);
      const endX = parseFloat(coords[1][1]);
      const endY = parseFloat(coords[1][2]);

      // Midpoint should be near center (within wobble tolerance)
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      expect(Math.abs(midX - cx)).toBeLessThan(10);
      expect(Math.abs(midY - cy)).toBeLessThan(10);
    }
  });

  it('is deterministic', () => {
    const a = generateXPaths(400, 300, 30);
    const b = generateXPaths(400, 300, 30);
    expect(a[0].d).toBe(b[0].d);
    expect(a[1].d).toBe(b[1].d);
  });
});
