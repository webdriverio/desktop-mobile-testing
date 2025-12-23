#!/bin/bash
set -e

echo "========== PUBLISHING RUST CRATE TO CRATES.IO =========="

# Read inputs
CRATES_IO_TOKEN="${INPUT_CRATES_IO_TOKEN:-}"
DRY_RUN="${INPUT_DRY_RUN:-false}"
WORKSPACE_ROOT="${GITHUB_WORKSPACE:-.}"

if [ -z "$CRATES_IO_TOKEN" ]; then
  echo "Error: INPUT_CRATES_IO_TOKEN is required"
  exit 1
fi

echo "Dry Run: $DRY_RUN"

cd "$WORKSPACE_ROOT/packages/tauri-plugin"

# Check if Cargo.toml exists
if [ ! -f "Cargo.toml" ]; then
  echo "Error: Cargo.toml not found in packages/tauri-plugin"
  exit 1
fi

# Extract crate info
CRATE_NAME=$(grep "^name = " Cargo.toml | head -n 1 | cut -d'"' -f2)
CRATE_VERSION=$(grep "^version = " Cargo.toml | head -n 1 | cut -d'"' -f2)

echo "📦 Crate: $CRATE_NAME"
echo "📌 Version: $CRATE_VERSION"

# Check if version already exists on crates.io
echo ""
echo "Checking if version already published..."
if cargo search "$CRATE_NAME" --limit 1 | grep -q "^$CRATE_NAME = \"$CRATE_VERSION\""; then
  echo "⚠️  Version $CRATE_VERSION is already published to crates.io"
  echo "Skipping publish..."
  exit 0
fi

# Publish
if [ "$DRY_RUN" = "true" ]; then
  echo ""
  echo "🔍 Dry run - would publish to crates.io"
  cargo publish --dry-run --token "$CRATES_IO_TOKEN"
  echo "✅ Dry run completed successfully"
else
  echo ""
  echo "Publishing to crates.io..."
  cargo publish --token "$CRATES_IO_TOKEN"
  echo "✅ Published successfully!"
fi

echo ""
echo "=========================================="

