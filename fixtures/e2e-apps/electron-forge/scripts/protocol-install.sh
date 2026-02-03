#!/bin/bash
# Protocol handler installer for Electron Forge - detects platform
# Idempotent: safe to run multiple times

set -e

OS_TYPE=$(uname -s | tr '[:upper:]' '[:lower:]')

case "$OS_TYPE" in
  linux*)
    echo "[protocol-install] Detected Linux - running Electron Forge protocol handler setup..."
    chmod +x ./fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.sh
    ./fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.sh
    ;;
  darwin*)
    echo "[protocol-install] Detected macOS - protocol handler registered by app on launch (no setup needed)"
    ;;
  mingw*|msys*|cygwin*|windows*)
    echo "[protocol-install] Detected Windows - checking PowerShell availability..."
    # Check for PowerShell Core (pwsh)
    if command -v pwsh &> /dev/null; then
      echo "[protocol-install] PowerShell Core (pwsh) found - running setup..."
      pwsh -ExecutionPolicy Bypass -File ./fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.ps1
    # Check for Windows PowerShell (powershell)
    elif command -v powershell &> /dev/null; then
      echo "[protocol-install] Windows PowerShell found - running setup..."
      powershell -ExecutionPolicy Bypass -File ./fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.ps1
    else
      echo "[protocol-install] ERROR: PowerShell not found!"
      echo ""
      echo "Please install PowerShell to continue:"
      echo "  - PowerShell Core: https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell"
      echo "  - Windows PowerShell: Usually pre-installed on Windows"
      echo ""
      echo "Or run the setup script manually:"
      echo "  pwsh -ExecutionPolicy Bypass -File ./fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.ps1"
      exit 1
    fi
    ;;
  *)
    echo "[protocol-install] ERROR: Unsupported OS: $OS_TYPE"
    echo ""
    echo "Please run the appropriate protocol handler setup script manually:"
    echo "  Linux:   ./fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.sh"
    echo "  Windows: ./fixtures/e2e-apps/electron-forge/scripts/setup-protocol-handler.ps1"
    echo "  macOS:   No setup needed (app registers on first launch)"
    exit 1
    ;;
esac
