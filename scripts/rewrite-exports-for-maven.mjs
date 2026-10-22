#!/usr/bin/env node
/**
 * Rewrites package.json "exports" from src/ to dist/ for Maven artifact packing.
 * Run after `yarn build` and before `mvn install` on the npm-packages artifact.
 * Source package.json stays at src/ for workspace development.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const packagesDir = join(import.meta.dirname, '..', 'packages');

for (const dir of readdirSync(packagesDir)) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  try { statSync(pkgPath); } catch { continue; }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const exports = pkg.exports;
  if (!exports) continue;

  let changed = false;
  const newExports = {};
  for (const [key, val] of Object.entries(exports)) {
    if (typeof val === 'string' && val.startsWith('./src/') && val.endsWith('.ts')) {
      const distPath = val.replace('./src/', './dist/').replace(/\.ts$/, '');
      newExports[key] = {
        types: distPath + '.d.ts',
        default: distPath + '.js',
      };
      changed = true;
    } else {
      newExports[key] = val;
    }
  }

  if (changed) {
    pkg.exports = newExports;
    if (pkg.main?.startsWith('src/')) {
      pkg.main = pkg.main.replace('src/', 'dist/').replace(/\.ts$/, '.js');
    }
    if (pkg.types?.startsWith('src/')) {
      pkg.types = pkg.types.replace('src/', 'dist/').replace(/\.ts$/, '.d.ts');
    }
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✓ ${dir}`);
  }
}
