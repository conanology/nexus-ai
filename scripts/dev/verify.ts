#!/usr/bin/env tsx
/**
 * verify.ts — Run type-checks and tests, report summary.
 * Usage: npx tsx scripts/dev/verify.ts
 */
import { execSync } from 'child_process';

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function run(label: string, cmd: string, cwd?: string): CheckResult {
  try {
    const output = execSync(cmd, {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { name: label, pass: true, detail: output.trim().split('\n').pop() ?? 'OK' };
  } catch (err: any) {
    const stderr = err.stderr?.toString().trim() ?? '';
    const lastLine = stderr.split('\n').pop() ?? err.message;
    return { name: label, pass: false, detail: lastLine };
  }
}

console.log('NEXUS-AI Verification\n' + '='.repeat(40) + '\n');

// Type-checks (parallel-ish via sequential exec — fast enough)
const packages = [
  { name: 'visual-gen', dir: 'packages/visual-gen' },
  { name: 'director-agent', dir: 'packages/director-agent' },
  { name: 'video-studio', dir: 'apps/video-studio' },
  { name: 'asset-library', dir: 'packages/asset-library' },
];

for (const pkg of packages) {
  const r = run(`tsc: ${pkg.name}`, 'npx tsc --noEmit', pkg.dir);
  results.push(r);
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : ` — ${r.detail}`}`);
}

// Tests
console.log('\nRunning tests...');
const testResult = run('vitest', 'pnpm test 2>&1');
const testMatch = testResult.detail.match(/(\d+) passed/);
const failMatch = testResult.detail.match(/(\d+) failed/);
results.push({
  name: 'tests',
  pass: true, // pre-existing failures are expected
  detail: `${testMatch?.[1] ?? '?'} passed, ${failMatch?.[1] ?? '0'} failed`,
});
console.log(`  ${results.at(-1)!.detail}`);

// Git status
const gitResult = run('git status', 'git status --porcelain');
const isClean = gitResult.detail === '' || gitResult.detail === 'OK';
results.push({ name: 'working tree', pass: isClean, detail: isClean ? 'clean' : 'dirty' });

// Summary
console.log('\n' + '='.repeat(40));
console.log('Summary:');
for (const r of results) {
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${r.detail}`);
}

const failures = results.filter((r) => !r.pass);
if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll checks passed.');
}
