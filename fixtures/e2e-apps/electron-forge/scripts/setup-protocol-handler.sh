#!/bin/bash
# Setup script to register the testapp:// protocol handler for Electron Forge E2E testing
# Wrapper for shared setup script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

"$PROJECT_ROOT/scripts/protocol-handlers/setup-protocol-handler.sh" \
    "$APP_DIR" \
    "electron-forge-e2e-app" \
    "out/electron-forge-e2e-app-linux-x64,out/electron-forge-e2e-app-linux-arm64,out/electron-forge-e2e-app-linux-ia32" \
    "electron-forge-testapp" \
    "Electron Forge Test App"
