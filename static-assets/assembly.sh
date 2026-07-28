#!/usr/bin/env bash
set -euo pipefail

# Assemble pre-built static assets for the casehub-pages-ui-static Maven artifact.
# Runs build:tokens and build:bundle, validates outputs, copies to META-INF structure.
#
# Usage: ./assembly.sh <output-dir>
#   output-dir: typically target/static (Maven resource directory)

OUTPUT_DIR="${1:?Usage: assembly.sh <output-dir>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export GH_PACKAGES_TOKEN="${GH_PACKAGES_TOKEN:-dummy}"

echo "=== Building static assets ==="

echo "  Building token CSS..."
yarn --cwd "$REPO_ROOT" workspace @casehubio/pages-ui-tokens run build:tokens

echo "  Building component bundle..."
yarn --cwd "$REPO_ROOT" workspace @casehubio/pages-ui-components run build:bundle

echo "  Validating component bundle..."
node "$REPO_ROOT/static-assets/validate-bundle.mjs" "$REPO_ROOT/packages/pages-ui-components/dist/components.js"

TOKENS_DIR="$REPO_ROOT/packages/pages-ui-tokens/dist/themes"
COMPONENTS_DIR="$REPO_ROOT/packages/pages-ui-components/dist"

for css in casehub-dark.css casehub-light.css default-dark.css default-light.css; do
  [ -s "$TOKENS_DIR/$css" ] || { echo "FAIL: $TOKENS_DIR/$css missing or empty"; exit 1; }
done
[ -s "$COMPONENTS_DIR/components.js" ] || { echo "FAIL: components.js missing or empty"; exit 1; }
[ -s "$COMPONENTS_DIR/components.js.map" ] || { echo "FAIL: components.js.map missing or empty"; exit 1; }
echo "  ✓ All expected files present"

TOKENS_OUT="$OUTPUT_DIR/META-INF/resources/pages/tokens"
UI_OUT="$OUTPUT_DIR/META-INF/resources/pages/ui"
mkdir -p "$TOKENS_OUT" "$UI_OUT"

cp "$TOKENS_DIR"/*.css "$TOKENS_OUT/"
cp "$COMPONENTS_DIR/components.js" "$UI_OUT/"
cp "$COMPONENTS_DIR/components.js.map" "$UI_OUT/"

echo "=== Done — static assets assembled to $OUTPUT_DIR/META-INF/resources/pages/ ==="
