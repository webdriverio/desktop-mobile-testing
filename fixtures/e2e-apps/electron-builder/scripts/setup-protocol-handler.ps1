# Setup script to register the testapp:// protocol handler for E2E testing on Windows
# This script adds the necessary registry keys for protocol handler support

$ErrorActionPreference = "Stop"

Write-Host "Setting up testapp:// protocol handler on Windows..."

# Get the script directory and app directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir

Write-Host "App directory: $AppDir"

# Look for the executable in the expected Windows unpacked directory
# electron-builder with "target": "dir" creates dist/win-unpacked/
$SearchPaths = @(
    "$AppDir\dist\win-unpacked\electron-builder.exe",
    "$AppDir\dist\win-ia32-unpacked\electron-builder.exe",
    "$AppDir\dist\win-x64-unpacked\electron-builder.exe",
    "$AppDir\dist\win-arm64-unpacked\electron-builder.exe"
)

$AppExecutable = $null
foreach ($path in $SearchPaths) {
    if (Test-Path $path) {
        $AppExecutable = Get-Item $path
        break
    }
}

# Fallback: search recursively if not found in expected locations
if (-not $AppExecutable) {
    Write-Host "Searching recursively for executable..."
    $AppExecutable = Get-ChildItem -Path "$AppDir\dist" -Filter "electron-builder.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not $AppExecutable) {
    Write-Host "Error: Could not find electron-builder.exe"
    Write-Host "Searched paths:"
    foreach ($path in $SearchPaths) {
        Write-Host "  - $path"
    }
    Write-Host "Directory contents:"
    Get-ChildItem -Path "$AppDir\dist" -ErrorAction SilentlyContinue | Format-Table -AutoSize
    exit 1
}

$ExePath = $AppExecutable.FullName
Write-Host "Found executable: $ExePath"

# Verify the executable exists and is accessible
if (-not (Test-Path $ExePath)) {
    Write-Error "Executable path is not accessible: $ExePath"
    exit 1
}

# Registry path for protocol handler
$RegistryPath = "HKCU:\Software\Classes\testapp"

# Create the protocol registry key
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
    Write-Host "Created registry key: $RegistryPath"
}

# Set the URL Protocol value
Set-ItemProperty -Path $RegistryPath -Name "(Default)" -Value "URL:testapp Protocol"
Set-ItemProperty -Path $RegistryPath -Name "URL Protocol" -Value ""
Write-Host "Set URL Protocol values"

# Create the command registry key
$CommandPath = "$RegistryPath\shell\open\command"
if (-not (Test-Path $CommandPath)) {
    New-Item -Path $CommandPath -Force | Out-Null
    Write-Host "Created command registry key"
}

# Set the command to launch the app with the URL
$CommandValue = "`"$ExePath`" `"%1`""
Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value $CommandValue
Write-Host "Set command value: $CommandValue"

Write-Host ""
Write-Host "Registered testapp:// protocol handler"
Write-Host "Registry key: $RegistryPath"
Write-Host "Executable: $ExePath"

# Verify registration
$RegisteredCommand = Get-ItemProperty -Path $CommandPath -Name "(Default)" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty "(Default)"
if ($RegisteredCommand -eq $CommandValue) {
    Write-Host "Verification successful: Command registered correctly"
} else {
    Write-Warning "Verification failed: Registered command does not match expected value"
    Write-Host "Expected: $CommandValue"
    Write-Host "Got: $RegisteredCommand"
}

Write-Host ""
Write-Host "Setup complete!"
