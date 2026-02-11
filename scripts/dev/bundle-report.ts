#!/usr/bin/env tsx
/**
 * bundle-report.ts — Report source file and line counts per package.
 * Usage: npx tsx scripts/dev/bundle-report.ts
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT = process.cwd();
const DIRS = ['packages', 'apps'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);

interface PkgStats {
  name: string;
  dir: string;
  files: number;
  lines: number;
  testFiles: number;
  testLines: number;
}

function countDir(dir: string, isTest: boolean = false): { files: number; lines: number } {
  let files = 0;
  let lines = 0;
  if (!existsSync(dir)) return { files, lines };

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') continue;
    if (entry.isDirectory()) {
      const sub = countDir(full, isTest || entry.name === '__tests__');
      files += sub.files;
      lines += sub.lines;
    } else if (EXTENSIONS.has(extname(entry.name))) {
      files++;
      lines += readFileSync(full, 'utf-8').split('\n').length;
    }
  }
  return { files, lines };
}

function analyzePackage(base: string, name: string): PkgStats {
  const dir = join(ROOT, base, name);
  const srcDir = join(dir, 'src');
  const testDir = join(srcDir, '__tests__');

  const total = countDir(srcDir);
  const tests = countDir(testDir);

  return {
    name: `@nexus-ai/${name}`,
    dir: `${base}/${name}`,
    files: total.files - tests.files,
    lines: total.lines - tests.lines,
    testFiles: tests.files,
    testLines: tests.lines,
  };
}

console.log('NEXUS-AI Bundle Report\n' + '='.repeat(70) + '\n');
console.log(
  'Package'.padEnd(24) +
  'Src Files'.padStart(10) +
  'Src Lines'.padStart(12) +
  'Test Files'.padStart(11) +
  'Test Lines'.padStart(12)
);
console.log('-'.repeat(70));

let totalFiles = 0;
let totalLines = 0;
let totalTestFiles = 0;
let totalTestLines = 0;

for (const base of DIRS) {
  const baseDir = join(ROOT, base);
  if (!existsSync(baseDir)) continue;
  for (const entry of readdirSync(baseDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    if (!existsSync(join(baseDir, entry.name, 'package.json'))) continue;
    const stats = analyzePackage(base, entry.name);
    console.log(
      stats.name.replace('@nexus-ai/', '').padEnd(24) +
      String(stats.files).padStart(10) +
      String(stats.lines).padStart(12) +
      String(stats.testFiles).padStart(11) +
      String(stats.testLines).padStart(12)
    );
    totalFiles += stats.files;
    totalLines += stats.lines;
    totalTestFiles += stats.testFiles;
    totalTestLines += stats.testLines;
  }
}

console.log('-'.repeat(70));
console.log(
  'TOTAL'.padEnd(24) +
  String(totalFiles).padStart(10) +
  String(totalLines).padStart(12) +
  String(totalTestFiles).padStart(11) +
  String(totalTestLines).padStart(12)
);
console.log(`\nTest-to-source ratio: ${(totalTestLines / totalLines * 100).toFixed(1)}%`);
