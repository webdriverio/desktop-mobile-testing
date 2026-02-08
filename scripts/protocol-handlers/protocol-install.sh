#!/bin/bash
# Generic protocol handler installer - detects platform and runs appropriate setup
# Idempotent: safe to run multiple times
#
# Usage: protocol-install.sh <framework-type> <app-base-dir>
# Example: protocol-install.sh electron-builder ./fixtures/e2e-apps/electron-builder

set -e

FRAMEWORK_TYPE="${1:-}"
APP_BASE_DIR="${2:-}"

if [ -z "$FRAMEWORK_TYPE" ] || [ -z "$APP_BASE_DIR" ]; then
    echo "Error: Missing required arguments"
    echo "Usage: $0 <framework-type> <app-base-dir>"
    echo "Example: $0 electron-builder ./fixtures/e2e-apps/electron-builder"
    exit 1
fi

OS_TYPE=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$OS_TYPE" in
  linux*)
    echo "[protocol-install] Detected Linux - running $FRAMEWORK_TYPE protocol handler setup..."
    chmod +x "$APP_BASE_DIR/scripts/setup-protocol-handler.sh"
    "$APP_BASE_DIR/scripts/setup-protocol-handler.sh"
    ;;
  darwin*)
    echo "[protocol-install] Detected macOS - protocol handler registered by app on launch (no setup needed)"
    ;;
  mingw*|msys*|cygwin*|windows*)
    echo "[protocol-install] Detected Windows - checking PowerShell availability..."
    # Check for PowerShell Core (pwsh)
    if command -v pwsh &> /dev/null; then
      echo "[protocol-install] PowerShell Core (pwsh) found - running setup..."
      pwsh -ExecutionPolicy Bypass -File "$APP_BASE_DIR/scripts/setup-protocol-handler.ps1"
    # Check for Windows PowerShell (powershell)
    elif command -v powershell &> /dev/null; then
      echo "[protocol-install] Windows PowerShell found - running setup..."
      powershell -ExecutionPolicy Bypass -File "$APP_BASE_DIR/scripts/setup-protocol-handler.ps1"
    else
      echo "[protocol-install] ERROR: PowerShell not found!"
      echo ""
      echo "Please install PowerShell to continue:"
      echo "  - PowerShell Core: https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell"
      echo "  - Windows PowerShell: Usually pre-installed on Windows"
      echo ""
      echo "Or run the setup script manually:"
      echo "  pwsh -ExecutionPolicy Bypass -File $APP_BASE_DIR/scripts/setup-protocol-handler.ps1"
      exit 1
    fi
    ;;
  *)
    echo "[protocol-install] ERROR: Unsupported OS: $OS_TYPE"
    echo ""
    echo "Please run the appropriate protocol handler setup script manually:"
    echo "  Linux:   $APP_BASE_DIR/scripts/setup-protocol-handler.sh"
    echo "  Windows: $APP_BASE_DIR/scripts/setup-protocol-handler.ps1"
    echo "  macOS:   No setup needed (app registers on first launch)"
    exit 1
    ;;
esac
