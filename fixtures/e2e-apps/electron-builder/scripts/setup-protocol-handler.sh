#!/bin/bash
# Setup script to register the testapp:// protocol handler for Electron Builder E2E testing
# Wrapper for shared setup script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

"$PROJECT_ROOT/scripts/protocol-handlers/setup-protocol-handler.sh" \
    "$APP_DIR" \
    "electron-builder-e2e-app" \
    "dist-electron/linux-unpacked,dist-electron/linux-arm64-unpacked,dist-electron/linux-x64-unpacked" \
    "electron-builder-e2e-app-testapp" \
    "Electron Builder E2E Test App"
