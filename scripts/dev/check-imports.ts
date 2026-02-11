#!/usr/bin/env tsx
/**
 * check-imports.ts — Detect circular dependencies between workspace packages.
 * Usage: npx tsx scripts/dev/check-imports.ts
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const DIRS = ['packages', 'apps'];

interface PkgInfo {
  name: string;
  dir: string;
  deps: string[];
}

function loadPackages(): PkgInfo[] {
  const pkgs: PkgInfo[] = [];
  for (const base of DIRS) {
    const baseDir = join(ROOT, base);
    if (!existsSync(baseDir)) continue;
    for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(baseDir, entry.name, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const workspaceDeps = Object.keys(allDeps)
        .filter((d) => d.startsWith('@nexus-ai/') && allDeps[d] === 'workspace:*');
      pkgs.push({ name: pkg.name, dir: join(base, entry.name), deps: workspaceDeps });
    }
  }
  return pkgs;
}

function findCycles(pkgs: PkgInfo[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const p of pkgs) graph.set(p.name, p.deps);

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push([...path.slice(cycleStart), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const dep of graph.get(node) ?? []) {
      dfs(dep, [...path, node]);
    }
    inStack.delete(node);
  }

  for (const p of pkgs) dfs(p.name, []);
  return cycles;
}

console.log('Checking workspace dependency graph for circular imports...\n');

const pkgs = loadPackages();
console.log(`Found ${pkgs.length} workspace packages.\n`);

// Print dependency summary
for (const p of pkgs) {
  const deps = p.deps.length > 0 ? p.deps.map((d) => d.replace('@nexus-ai/', '')).join(', ') : '(none)';
  console.log(`  ${p.name.replace('@nexus-ai/', '').padEnd(22)} → ${deps}`);
}

const cycles = findCycles(pkgs);

console.log('');
if (cycles.length === 0) {
  console.log('No circular dependencies found. Dependency graph is a clean DAG.');
} else {
  console.log(`Found ${cycles.length} circular dependency chain(s):`);
  for (const c of cycles) {
    console.log(`  ${c.map((n) => n.replace('@nexus-ai/', '')).join(' → ')}`);
  }
  process.exit(1);
}
