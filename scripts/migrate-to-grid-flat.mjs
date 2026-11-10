#!/usr/bin/env node
/**
 * Migrate .page.yaml files to the grid:/flat:/at: canonical format.
 *
 * Handles three input generations:
 *   Gen 1: rows:/columns: → grid: with at:
 *   Gen 2: items: with placement:/component: → grid: with at: (inline component)
 *   Gen 3: components: (flat) → flat:
 *
 * Also migrates nested grids (type: "grid" components with items: → grid:).
 *
 * Usage:
 *   node scripts/migrate-to-grid-flat.mjs <path-or-glob>
 *   node scripts/migrate-to-grid-flat.mjs examples/samples/
 *   node scripts/migrate-to-grid-flat.mjs --dry-run examples/samples/
 *
 * Reusable across repos — pass any directory containing .page.yaml files.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { stringify, parse, parseDocument, visit, isMap } from "yaml";

function findYamlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findYamlFiles(full));
    } else if (entry.name.endsWith(".page.yaml") || entry.name.endsWith(".page.yml")) {
      results.push(full);
    }
  }
  return results;
}

function migrateEntry(entry) {
  if (typeof entry !== "object" || entry == null) return entry;

  const result = {};

  // Migrate at:/placement:
  const atRaw = entry.at ?? entry.placement;
  if (atRaw) {
    const at = {};
    if ("x" in atRaw) at.x = atRaw.x;
    if ("y" in atRaw) at.y = atRaw.y;
    if ("w" in atRaw) at.w = atRaw.w;
    if ("h" in atRaw) at.h = atRaw.h;
    result.at = at;
  }

  // Inline the component (unwrap component: wrapper)
  const comp = entry.component;
  if (comp && typeof comp === "object") {
    if (comp.type) result.type = comp.type;
    if (comp.id) result.id = comp.id;
    if (comp.properties) result.properties = comp.properties;
    if (comp.style) result.style = comp.style;
    if (comp.visibleWhen) result.visibleWhen = comp.visibleWhen;
    if (comp.access) result.access = comp.access;
    if (comp.slots) result.slots = comp.slots;
    // Recursively migrate nested grid items
    if (comp.items) {
      result.grid = comp.items.map(migrateEntry);
    } else if (comp.grid) {
      result.grid = comp.grid.map(migrateEntry);
    }
  } else {
    // Already inline format — copy type, properties, etc.
    if (entry.type) result.type = entry.type;
    if (entry.id) result.id = entry.id;
    if (entry.properties) result.properties = entry.properties;
    if (entry.style) result.style = entry.style;
    if (entry.visibleWhen) result.visibleWhen = entry.visibleWhen;
    if (entry.access) result.access = entry.access;
    if (entry.slots) result.slots = entry.slots;
    // Nested grid
    if (entry.items) {
      result.grid = entry.items.map(migrateEntry);
    } else if (entry.grid) {
      result.grid = entry.grid.map(migrateEntry);
    }
  }

  return result;
}

function migrateComponent(comp) {
  if (typeof comp !== "object" || comp == null) return comp;
  const result = { ...comp };
  // Migrate nested grid items within any component
  if (result.items) {
    result.grid = result.items.map(migrateEntry);
    delete result.items;
  }
  if (result.slots) {
    const newSlots = {};
    for (const [k, v] of Object.entries(result.slots)) {
      if (Array.isArray(v)) {
        newSlots[k] = v.map(migrateComponent);
      } else {
        newSlots[k] = v;
      }
    }
    result.slots = newSlots;
  }
  return result;
}

function migratePage(page) {
  const result = {};
  // Copy non-layout keys
  for (const [k, v] of Object.entries(page)) {
    if (!["items", "components", "rows", "columns", "grid", "flat"].includes(k)) {
      result[k] = v;
    }
  }

  if (page.grid) {
    // Already canonical — but check for nested items:
    result.grid = page.grid.map(migrateEntry);
    return result;
  }

  if (page.items) {
    // Gen 2: items + placement/component → grid + at + inline
    result.grid = page.items.map(migrateEntry);
    return result;
  }

  if (page.rows) {
    // Gen 1: rows/columns → grid
    const entries = [];
    let y = 0;
    for (const row of page.rows) {
      const cols = row.columns ?? row.layoutColumns;
      if (!cols) { y++; continue; }
      let x = 0;
      let maxComps = 1;
      for (const col of cols) {
        const span = Number(col.span ?? 12);
        const comps = col.components ?? col.layoutComponents ?? [];
        if (comps.length > maxComps) maxComps = comps.length;
        for (let ci = 0; ci < comps.length; ci++) {
          const migrated = migrateComponent(comps[ci]);
          entries.push({
            at: { x, y: y + ci, w: span, h: 1 },
            ...migrated,
          });
        }
        x += span;
      }
      y += maxComps;
    }
    result.grid = entries;
    return result;
  }

  if (page.columns) {
    // Gen 1 variant: columns without rows
    const entries = [];
    let x = 0;
    for (const col of page.columns) {
      const span = Number(col.span ?? 12);
      const comps = col.components ?? [];
      for (let ci = 0; ci < comps.length; ci++) {
        const migrated = migrateComponent(comps[ci]);
        entries.push({
          at: { x, y: ci, w: span, h: 1 },
          ...migrated,
        });
      }
      x += span;
    }
    result.grid = entries;
    return result;
  }

  if (page.components) {
    // Gen 1/3: flat component list → flat:
    result.flat = page.components.map(migrateComponent);
    return result;
  }

  return result;
}

function migrateYaml(yaml) {
  const parsed = parse(yaml);
  if (!parsed || typeof parsed !== "object") return null;

  const pages = parsed.pages;
  if (!Array.isArray(pages)) return null;

  let changed = false;
  const migratedPages = pages.map(page => {
    const migrated = migratePage(page);
    if (JSON.stringify(migrated) !== JSON.stringify(page)) changed = true;
    return migrated;
  });

  // Always apply flow-style formatting on at: even if content unchanged
  const result = { ...parsed, pages: migratedPages };
  const doc = parseDocument(stringify(result, { lineWidth: 0 }));
  visit(doc, {
    Pair(_, pair) {
      if (pair.key && pair.key.value === "at" && isMap(pair.value)) {
        pair.value.flow = true;
      }
    },
  });
  const output = doc.toString({ lineWidth: 0 });
  if (output === yaml) return null;
  return output;
}

// CLI
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const paths = args.filter(a => a !== "--dry-run");

if (paths.length === 0) {
  console.log("Usage: node scripts/migrate-to-grid-flat.mjs [--dry-run] <dir-or-file> ...");
  process.exit(1);
}

let total = 0;
let migrated = 0;
let skipped = 0;

for (const p of paths) {
  const stat = statSync(p);
  const files = stat.isDirectory() ? findYamlFiles(p) : [p];

  for (const file of files) {
    total++;
    try {
      const yaml = readFileSync(file, "utf-8");
      const result = migrateYaml(yaml);
      if (result == null) {
        skipped++;
        continue;
      }
      migrated++;
      if (dryRun) {
        console.log(`[migrate] ${relative(process.cwd(), file)}`);
      } else {
        writeFileSync(file, result, "utf-8");
        console.log(`[migrated] ${relative(process.cwd(), file)}`);
      }
    } catch (err) {
      console.error(`[error] ${relative(process.cwd(), file)}: ${err.message}`);
    }
  }
}

console.log(`\nTotal: ${total}, Migrated: ${migrated}, Skipped: ${skipped}${dryRun ? " (dry run)" : ""}`);
