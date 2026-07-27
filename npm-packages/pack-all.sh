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

echo "=== Done — $(ls "$OUTPUT_DIR/packages/" | wc -l | tr -d ' ') packages unpacked to $OUTPUT_DIR/packages/ ==="
