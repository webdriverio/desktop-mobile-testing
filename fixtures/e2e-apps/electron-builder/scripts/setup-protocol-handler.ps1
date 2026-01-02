# Setup script to register the testapp:// protocol handler for E2E testing on Windows
# This script adds the necessary registry keys for protocol handler support

$ErrorActionPreference = "Stop"

Write-Host "Setting up testapp:// protocol handler on Windows..."

# Get the script directory and app directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir

# Find the built app executable
$AppExecutable = Get-ChildItem -Path "$AppDir\dist" -Filter "electron-builder.exe" -Recurse -File | Select-Object -First 1

if (-not $AppExecutable) {
    Write-Error "Could not find electron-builder.exe in dist/"
    exit 1
}

$ExePath = $AppExecutable.FullName
Write-Host "Found executable: $ExePath"

# Registry path for protocol handler
$RegistryPath = "HKCU:\Software\Classes\testapp"

# Create the protocol registry key
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
}

# Set the URL Protocol value
Set-ItemProperty -Path $RegistryPath -Name "(Default)" -Value "URL:testapp Protocol"
Set-ItemProperty -Path $RegistryPath -Name "URL Protocol" -Value ""

# Create the command registry key
$CommandPath = "$RegistryPath\shell\open\command"
if (-not (Test-Path $CommandPath)) {
    New-Item -Path $CommandPath -Force | Out-Null
}

# Set the command to launch the app with the URL
Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value "`"$ExePath`" `"%1`""

Write-Host "Registered testapp:// protocol handler"
Write-Host "Registry key: $RegistryPath"
Write-Host "Command: $ExePath %1"

# Verify registration
$RegisteredCommand = Get-ItemProperty -Path $CommandPath -Name "(Default)" | Select-Object -ExpandProperty "(Default)"
Write-Host "Verified command: $RegisteredCommand"

Write-Host "Setup complete!"
