#!/usr/bin/env bash
set -euo pipefail

# Pack all publishable @casehubio packages into individual tarballs,
# then unpack each into a flat directory structure for the Maven artifact.
#
# Yarn pack resolves workspace:* → real versions automatically.
#
# Usage: ./pack-all.sh <output-dir>
#   output-dir: directory where packages/<name>/ dirs will be created

OUTPUT_DIR="${1:?Usage: pack-all.sh <output-dir>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$OUTPUT_DIR/tarballs"

echo "=== Packing @casehubio packages ==="

# Pack each non-private workspace package
for pkg_json in "$REPO_ROOT"/packages/*/package.json "$REPO_ROOT"/components/*/package.json; do
    pkg_dir="$(dirname "$pkg_json")"
    pkg_name="$(basename "$pkg_dir")"

    # Skip private packages
    if grep -q '"private":\s*true' "$pkg_json" 2>/dev/null; then
        echo "  SKIP $pkg_name (private)"
        continue
    fi

    echo "  PACK $pkg_name"
    tarball="$OUTPUT_DIR/tarballs/$pkg_name.tgz"
    GH_PACKAGES_TOKEN="${GH_PACKAGES_TOKEN:-dummy}" \
        yarn --cwd "$REPO_ROOT" workspace "@casehubio/$pkg_name" pack --out "$tarball" 2>/dev/null

    # Unpack tarball to packages/<name>/
    mkdir -p "$OUTPUT_DIR/packages/$pkg_name"
    tar xzf "$tarball" -C "$OUTPUT_DIR/packages/$pkg_name" --strip-components=1
done

# Rewrite exports/main from src/ to dist/ — consumers need compiled JS, not TS source
echo "=== Rewriting src/ → dist/ in exports and main fields ==="
python3 -c '
import json, sys
from pathlib import Path

packages_dir = Path(sys.argv[1]) / "packages"
count = 0
for pkg_json in sorted(packages_dir.glob("*/package.json")):
    with open(pkg_json) as f:
        pkg = json.load(f)
    changed = False
    if "main" in pkg and "/src/" in pkg["main"]:
        pkg["main"] = pkg["main"].replace("/src/", "/dist/").replace(".ts", ".js")
        changed = True
    if "exports" in pkg and isinstance(pkg["exports"], dict):
        for key, val in pkg["exports"].items():
            if isinstance(val, str) and "/src/" in val:
                pkg["exports"][key] = val.replace("/src/", "/dist/").replace(".ts", ".js")
                changed = True
    if changed:
        with open(pkg_json, "w") as f:
            json.dump(pkg, f, indent=2)
            f.write("\n")
        count += 1
print(f"  Rewrote {count} package.json files")
' "$OUTPUT_DIR"

echo "=== Done — $(ls "$OUTPUT_DIR/packages/" | wc -l | tr -d ' ') packages unpacked to $OUTPUT_DIR/packages/ ==="
