const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const familyRoot = path.resolve(repoRoot, '..');
const platformPlaybooks = process.env.PLATFORM_PLAYBOOKS_PATH
  || path.join(familyRoot, 'platform', 'playbooks');
const targetDir = path.join(__dirname, '../dist/api/playbooks');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (!fs.existsSync(platformPlaybooks)) {
  console.warn(`⚠ Platform playbooks not found at ${platformPlaybooks}`);
  console.warn('  Set PLATFORM_PLAYBOOKS_PATH or clone casehubio/platform alongside this repo.');
  console.warn('  Skipping — 4 scenario samples will show empty dropdowns.');
  process.exit(0);
}

const manifest = path.join(platformPlaybooks, 'manifest.json');
if (!fs.existsSync(manifest)) {
  console.warn('⚠ manifest.json not found in platform playbooks directory. Skipping.');
  process.exit(0);
}

console.log(`Copying playbooks from ${platformPlaybooks}...`);
fs.mkdirSync(targetDir, { recursive: true });

fs.copyFileSync(manifest, path.join(targetDir, 'manifest.json'));
console.log('  manifest.json');

let fileCount = 0;
for (const entry of fs.readdirSync(platformPlaybooks)) {
  const entryPath = path.join(platformPlaybooks, entry);
  if (fs.statSync(entryPath).isDirectory()) {
    copyRecursive(entryPath, path.join(targetDir, entry));
    const count = fs.readdirSync(entryPath).filter(f => f.endsWith('.yaml')).length;
    fileCount += count;
    console.log(`  ${entry}/ (${count} playbooks)`);
  }
}

console.log(`Copied ${fileCount} playbook files + manifest.json`);
