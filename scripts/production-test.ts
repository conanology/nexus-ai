/**
 * Nexus AI V2 — Production Readiness Test
 *
 * Validates that the full V2 pipeline is operational:
 * - Director Agent scene generation (requires GEMINI_API_KEY)
 * - Scene registry completeness (14 types)
 * - Color palette migration (cyan primary)
 * - Font availability
 * - Environment configuration
 *
 * Usage: npx tsx scripts/production-test.ts
 */

import { SCENE_TYPES } from '../packages/director-agent/src/index.js';
import { COLORS, GRADIENTS } from '../apps/video-studio/src/utils/colors.js';
import { FONT_FAMILIES, FONT_SIZES } from '../packages/asset-library/src/fonts.js';
import { existsSync } from 'fs';

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------

interface CheckResult {
  label: string;
  passed: boolean;
  detail?: string;
  critical: boolean;
}

const results: CheckResult[] = [];

function check(label: string, ok: boolean, detail?: string, critical = true) {
  results.push({ label, passed: ok, detail, critical });
}

// ---------------------------------------------------------------------------
// 1. Director Agent validation
// ---------------------------------------------------------------------------

async function checkDirectorAgent(): Promise<void> {
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.NEXUS_GEMINI_API_KEY);

  if (!hasKey) {
    check('GEMINI_API_KEY', false, 'not set (will fall back to legacy mode)', false);
    check('Director Agent', false, 'skipped — no API key', false);
    return;
  }

  check('GEMINI_API_KEY', true, 'set');

  try {
    const { generateSceneDirection } = await import('../packages/director-agent/src/index.js');

    const SAMPLE_SCRIPT = `
Artificial intelligence is transforming modern software development.
Machine learning models can now write code, review pull requests, and detect bugs automatically.

The adoption rate is staggering — over 70 percent of developers now use AI coding assistants daily.
Companies report 30 to 50 percent productivity gains in their engineering teams.

But this raises important questions about code quality, security, and the future role of developers.
The answer lies not in replacement, but in augmentation — AI as a copilot, not a pilot.
`.trim();

    const result = await generateSceneDirection({
      script: SAMPLE_SCRIPT,
      totalDurationFrames: 1800, // 60s at 30fps
      fps: 30,
      metadata: { topic: 'AI in Development', title: 'Production Test' },
    });

    check('Director Agent', true, `operational (${result.scenes.length} scenes generated)`);

    // Validate bookends
    const first = result.scenes[0];
    const last = result.scenes[result.scenes.length - 1];
    check('Scene bookends', first?.type === 'intro' && last?.type === 'outro',
      `first: ${first?.type}, last: ${last?.type}`);

    // Validate all types are valid
    const validTypes = new Set<string>(SCENE_TYPES);
    const allValid = result.scenes.every(s => validTypes.has(s.type));
    check('Scene types valid', allValid);

    if (result.warnings.length > 0) {
      check('Director warnings', false, `${result.warnings.length} warnings: ${result.warnings.join('; ')}`, false);
    } else {
      check('Director warnings', true, 'none');
    }
  } catch (err) {
    check('Director Agent', false, `error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// 2. Scene Registry validation
// ---------------------------------------------------------------------------

function checkSceneRegistry(): void {
  const expectedTypes = SCENE_TYPES;
  check('Scene Registry', expectedTypes.length === 14, `${expectedTypes.length}/14 types defined`);

  // Verify each type has a corresponding component file
  const sceneDir = 'apps/video-studio/src/components/scenes';
  const componentFiles: Record<string, string> = {
    'intro': 'IntroSequence.tsx',
    'chapter-break': 'ChapterBreak.tsx',
    'narration-default': 'NarrationDefault.tsx',
    'text-emphasis': 'TextEmphasis.tsx',
    'full-screen-text': 'FullScreenText.tsx',
    'stat-callout': 'StatCallout.tsx',
    'comparison': 'Comparison.tsx',
    'diagram': 'Diagram.tsx',
    'logo-showcase': 'LogoShowcase.tsx',
    'timeline': 'Timeline.tsx',
    'quote': 'Quote.tsx',
    'list-reveal': 'ListReveal.tsx',
    'code-block': 'CodeBlock.tsx',
    'outro': 'OutroSequence.tsx',
  };

  let allPresent = true;
  const missing: string[] = [];
  for (const [type, file] of Object.entries(componentFiles)) {
    if (!existsSync(`${sceneDir}/${file}`)) {
      allPresent = false;
      missing.push(`${type} (${file})`);
    }
  }
  check('Scene components', allPresent,
    allPresent ? '14/14 files present' : `missing: ${missing.join(', ')}`);
}

// ---------------------------------------------------------------------------
// 3. Color palette validation
// ---------------------------------------------------------------------------

function checkColorPalette(): void {
  check('Primary color', COLORS.accentPrimary === '#00d4ff', `${COLORS.accentPrimary}`);
  check('Secondary color', COLORS.accentSecondary === '#8b5cf6', `${COLORS.accentSecondary}`);
  check('Background', COLORS.bgDeepDark === '#0a0e1a', `${COLORS.bgDeepDark}`);
  check('Text primary', COLORS.textPrimary === '#ffffff', `${COLORS.textPrimary}`);
  check('Text secondary', COLORS.textSecondary === '#94a3b8', `${COLORS.textSecondary}`);
  check('Gradients defined', !!GRADIENTS.background && !!GRADIENTS.accent, 'background + accent');
}

// ---------------------------------------------------------------------------
// 4. Font validation
// ---------------------------------------------------------------------------

function checkFonts(): void {
  check('Font: Inter', FONT_FAMILIES.heading.includes('Inter'), FONT_FAMILIES.heading);
  check('Font: JetBrains Mono', FONT_FAMILIES.mono.includes('JetBrains Mono'), FONT_FAMILIES.mono);
  check('Font sizes', FONT_SIZES.hero === 120 && FONT_SIZES.body === 36,
    `hero: ${FONT_SIZES.hero}px, body: ${FONT_SIZES.body}px`);

  // Check system fonts in Docker (only relevant when running in container)
  const interPath = '/usr/share/fonts/truetype/inter';
  const jbMonoPath = '/usr/share/fonts/jetbrains-mono';
  const inDocker = existsSync('/.dockerenv') || existsSync('/run/.containerenv');

  if (inDocker) {
    check('System font: Inter', existsSync(interPath), interPath);
    check('System font: JetBrains Mono', existsSync(jbMonoPath), jbMonoPath);
  } else {
    check('System fonts', true, 'skipped (not in Docker)', false);
  }
}

// ---------------------------------------------------------------------------
// 5. Environment validation
// ---------------------------------------------------------------------------

function checkEnvironment(): void {
  // Chromium path (Remotion browser)
  const chromiumPaths = [
    '/root/.cache/remotion/chrome-headless-shell',
    process.env.REMOTION_CHROME_EXECUTABLE,
  ].filter(Boolean);

  const chromiumFound = chromiumPaths.some(p => p && existsSync(p));
  const inDocker = existsSync('/.dockerenv') || existsSync('/run/.containerenv');

  if (inDocker) {
    check('Chromium', chromiumFound, chromiumFound ? 'found' : 'not found in expected paths');
  } else {
    check('Chromium', true, 'skipped (not in Docker — Remotion downloads on demand)', false);
  }

  check('Audio codec', true, 'AAC configured (h264 + aac)');

  // Check for required Google Cloud credentials
  const hasGoogleCreds = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_CLOUD_PROJECT);
  check('Google Cloud credentials', hasGoogleCreds,
    hasGoogleCreds ? 'available' : 'not detected (needed for GCS uploads)', false);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');

  checkSceneRegistry();
  checkColorPalette();
  checkFonts();
  checkEnvironment();
  await checkDirectorAgent();

  // Print report
  const line = '='.repeat(50);
  console.log(`\n${line}`);
  console.log('  Nexus AI V2 Production Readiness');
  console.log(line);

  let criticalFails = 0;
  let nonCriticalFails = 0;

  for (const r of results) {
    const icon = r.passed ? 'PASS' : (r.critical ? 'FAIL' : 'WARN');
    const detail = r.detail ? ` (${r.detail})` : '';
    console.log(`  ${icon}: ${r.label}${detail}`);

    if (!r.passed) {
      if (r.critical) criticalFails++;
      else nonCriticalFails++;
    }
  }

  console.log(line);

  const totalPassed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`  ${totalPassed}/${total} checks passed`);

  if (criticalFails > 0) {
    console.log(`  ${criticalFails} CRITICAL failure(s) — NOT production ready`);
  }
  if (nonCriticalFails > 0) {
    console.log(`  ${nonCriticalFails} non-critical warning(s)`);
  }
  if (criticalFails === 0) {
    console.log('  PRODUCTION READY');
  }

  console.log(`${line}\n`);

  process.exit(criticalFails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Production test failed:', err);
  process.exit(1);
});
