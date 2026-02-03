#!/bin/bash
# Protocol handler installer for Electron Forge - wrapper for shared script
# Idempotent: safe to run multiple times

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

"$PROJECT_ROOT/scripts/protocol-handlers/protocol-install.sh" "electron-forge" "$APP_DIR"
