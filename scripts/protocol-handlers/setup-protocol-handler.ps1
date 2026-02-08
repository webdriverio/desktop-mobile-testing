# Generic protocol handler setup script for Windows
# Idempotent: safe to run multiple times
#
# Usage: setup-protocol-handler.ps1 -AppDir <path> -ExecutableName <name> -SearchPaths @(...) -AppDisplayName <name>
# Example: .\setup-protocol-handler.ps1 -AppDir "." -ExecutableName "electron-builder-e2e-app.exe" -SearchPaths @("dist-electron\win-unpacked", "dist-electron\win-x64-unpacked") -AppDisplayName "Electron Builder E2E Test App"

param(
    [Parameter(Mandatory=$true)]
    [string]$AppDir,

    [Parameter(Mandatory=$true)]
    [string]$ExecutableName,

    [Parameter(Mandatory=$true)]
    [string[]]$SearchPaths,

    [Parameter(Mandatory=$true)]
    [string]$AppDisplayName
)

$ErrorActionPreference = "Stop"

$ProtocolName = "testapp"

Write-Host "Setting up ${ProtocolName}:// protocol handler on Windows..."
Write-Host "App directory: $AppDir"

# Build full search paths
$FullSearchPaths = @()
foreach ($path in $SearchPaths) {
    $FullSearchPaths += Join-Path (Join-Path $AppDir $path) $ExecutableName
}

$AppExecutable = $null
foreach ($path in $FullSearchPaths) {
    if (Test-Path $path) {
        $AppExecutable = Get-Item $path
        break
    }
}

# Fallback: search recursively if not found in expected locations
if (-not $AppExecutable) {
    Write-Host "Searching recursively for executable..."
    $BaseDir = Join-Path $AppDir ($SearchPaths[0] -split '\\')[0]
    $AppExecutable = Get-ChildItem -Path $BaseDir -Filter $ExecutableName -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
}

if (-not $AppExecutable) {
    Write-Host "Error: Could not find $ExecutableName"
    Write-Host "Searched paths:"
    foreach ($path in $FullSearchPaths) {
        Write-Host "  - $path"
    }
    exit 1
}

$ExePath = $AppExecutable.FullName
Write-Host "Found executable: $ExePath"

# Verify the executable exists and is accessible
if (-not (Test-Path $ExePath)) {
    Write-Error "Executable path is not accessible: $ExePath"
    exit 1
}

# IDEMPOTENCY CHECK: Check if protocol handler is already registered correctly
$RegistryPath = "HKCU:\Software\Classes\$ProtocolName"
$CommandPath = "$RegistryPath\shell\open\command"
$ExistingCommand = $null

if (Test-Path $CommandPath) {
    $ExistingCommand = Get-ItemProperty -Path $CommandPath -Name "(Default)" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty "(Default)"
}

# Define command value with environment variable for single-instance mode
# Use cmd /c to set ENABLE_SINGLE_INSTANCE before launching the app
$CommandValue = "cmd /c `"set ENABLE_SINGLE_INSTANCE=true && `"`"$ExePath`"`" `"%1`"`""

# Skip if already registered correctly
if ($ExistingCommand -eq $CommandValue) {
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
if (-not (Test-Path $CommandPath)) {
    New-Item -Path $CommandPath -Force | Out-Null
    Write-Host "Created command registry key"
}

# Set the command to launch the app with the URL
Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value $CommandValue
Write-Host "Set command value: $CommandValue"

Write-Host ""
Write-Host "Registered ${ProtocolName}:// protocol handler"
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
