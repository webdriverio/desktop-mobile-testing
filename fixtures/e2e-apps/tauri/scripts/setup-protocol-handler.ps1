# Setup script to register testapp:// protocol handler for Tauri E2E testing on Windows
# Idempotent: safe to run multiple times

$ErrorActionPreference = "Stop"

Write-Host "Setting up testapp:// protocol handler for Tauri..."

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir

Write-Host "App directory: $AppDir"

$ProtocolName = "testapp"
$RegistryPath = "HKCU:\Software\Classes\$ProtocolName"

# IDEMPOTENCY CHECK
$ExistingCommand = $null
if (Test-Path "$RegistryPath\shell\open\command") {
    $ExistingCommand = Get-ItemProperty -Path "$RegistryPath\shell\open\command" -Name "(Default)" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty "(Default)"
}

# Find Tauri binary
$SearchPaths = @(
    "$AppDir\src-tauri\target\release\tauri-e2e-app.exe",
    "$AppDir\src-tauri\target\debug\tauri-e2e-app.exe"
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
    $AppExecutable = Get-ChildItem -Path "$AppDir\src-tauri\target" -Filter "tauri-e2e-app.exe" -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not $AppExecutable) {
    Write-Host "Error: Could not find tauri-e2e-app.exe"
    Write-Host "Searched paths:"
    foreach ($path in $SearchPaths) {
        Write-Host "  - $path"
    }
    Write-Host "Directory contents:"
    Get-ChildItem -Path "$AppDir\src-tauri\target" -ErrorAction SilentlyContinue | Format-Table -AutoSize
    exit 1
}

$ExePath = $AppExecutable.FullName
Write-Host "Found executable: $ExePath"

$ExpectedCommand = "`"$ExePath`" `"%1`""

# Skip if already registered correctly
if ($ExistingCommand -eq $ExpectedCommand) {
    Write-Host "Protocol handler already registered correctly, skipping..."
    exit 0
}

Write-Host "Registering protocol handler..."

# Create the protocol registry key
if (-not (Test-Path $RegistryPath)) {
    New-Item -Path $RegistryPath -Force | Out-Null
    Write-Host "Created registry key: $RegistryPath"
}

# Set the URL Protocol value
Set-ItemProperty -Path $RegistryPath -Name "(Default)" -Value "URL:${ProtocolName} Protocol"
Set-ItemProperty -Path $RegistryPath -Name "URL Protocol" -Value ""
Write-Host "Set URL Protocol values"

# Create the command registry key
$CommandPath = "$RegistryPath\shell\open\command"
if (-not (Test-Path $CommandPath)) {
    New-Item -Path $CommandPath -Force | Out-Null
    Write-Host "Created command registry key"
}

# Set the command to launch the app with the URL
Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value $ExpectedCommand
Write-Host "Set command value: $ExpectedCommand"

Write-Host ""
Write-Host "Registered ${ProtocolName}:// protocol handler"
Write-Host "Registry key: $RegistryPath"
Write-Host "Executable: $ExePath"

# Verify registration
$RegisteredCommand = Get-ItemProperty -Path $CommandPath -Name "(Default)" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty "(Default)"
if ($RegisteredCommand -eq $ExpectedCommand) {
    Write-Host "Verification successful: Command registered correctly"
} else {
    Write-Warning "Verification failed: Registered command does not match expected value"
    Write-Host "Expected: $ExpectedCommand"
    Write-Host "Got: $RegisteredCommand"
}

Write-Host ""
Write-Host "Setup complete!"
