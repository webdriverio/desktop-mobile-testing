# Setup script to register the testapp:// protocol handler for Electron Forge E2E testing on Windows
# Wrapper for shared setup script

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir)))

$SharedScript = Join-Path $ProjectRoot "scripts" "protocol-handlers" "setup-protocol-handler.ps1"

& $SharedScript `
    -AppDir $AppDir `
    -ExecutableName "electron-forge-e2e-app.exe" `
    -SearchPaths @("out\electron-forge-e2e-app-win32-x64", "out\electron-forge-e2e-app-win32-ia32", "out\electron-forge-e2e-app-win32-arm64") `
    -AppDisplayName "Electron Forge Test App"
