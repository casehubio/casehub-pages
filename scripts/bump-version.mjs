#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));

const PACKAGE_DIRS = ["packages", "components"];

function findPackages() {
  const packages = [];
  for (const dir of PACKAGE_DIRS) {
    const base = join(root, dir);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(base, entry.name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      packages.push({ path: pkgPath, pkg });
    }
  }
  return packages;
}

function check() {
  const packages = findPackages();
  const publishable = [];
  const skipped = [];

  for (const { path, pkg } of packages) {
    const rel = relative(root, path);
    if (pkg.private) {
      skipped.push({ rel, name: pkg.name, version: pkg.version });
    } else {
      publishable.push({ rel, name: pkg.name, version: pkg.version });
    }
  }

  console.log("Publishable packages:");
  for (const p of publishable) {
    console.log(`  ${p.version.padEnd(8)} ${p.name}`);
  }
  console.log(`\nSkipped (private: true):`);
  for (const s of skipped) {
    console.log(`  ${s.version.padEnd(8)} ${s.name}`);
  }
}

function bump(version) {
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    console.error(`Invalid semver: ${version}`);
    process.exit(1);
  }

  const packages = findPackages();
  let updated = 0;
  let skipped = 0;

  for (const { path, pkg } of packages) {
    const rel = relative(root, path);
    if (pkg.private) {
      console.log(`  skip  ${pkg.name} (private)`);
      skipped++;
      continue;
    }
    const old = pkg.version;
    pkg.version = version;
    writeFileSync(path, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`  ${old} → ${version}  ${pkg.name}`);
    updated++;
  }

  console.log(`\n${updated} updated, ${skipped} skipped`);
}

const arg = process.argv[2];
if (!arg) {
  console.log("Usage: node scripts/bump-version.mjs <version>");
  console.log("       node scripts/bump-version.mjs --check");
  process.exit(1);
}

if (arg === "--check") {
  check();
} else {
  bump(arg);
}
