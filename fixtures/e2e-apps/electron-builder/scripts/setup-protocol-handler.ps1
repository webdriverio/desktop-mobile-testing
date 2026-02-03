# Setup script to register the testapp:// protocol handler for Electron Builder E2E testing on Windows
# Wrapper for shared setup script

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir)))

$SharedScript = Join-Path $ProjectRoot "scripts\protocol-handlers\setup-protocol-handler.ps1"

& $SharedScript -AppDir $AppDir -ExecutableName "electron-builder-e2e-app.exe" -SearchPaths @("dist-electron\win-unpacked","dist-electron\win-ia32-unpacked","dist-electron\win-x64-unpacked","dist-electron\win-arm64-unpacked") -AppDisplayName "Electron Builder E2E Test App"
