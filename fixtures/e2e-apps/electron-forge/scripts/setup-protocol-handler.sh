#!/bin/bash
# Setup script to register the testapp:// protocol handler for E2E testing
# This script handles both Linux and macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Setting up testapp:// protocol handler..."
echo "App directory: $APP_DIR"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Platform: Linux"

    # Look for the executable in the expected Forge output directory
    # electron-forge package creates out/{package-name}-{platform}-{arch}/
    SEARCH_PATHS=(
        "$APP_DIR/out/electron-forge-e2e-app-linux-x64/electron-forge-e2e-app"
        "$APP_DIR/out/electron-forge-e2e-app-linux-arm64/electron-forge-e2e-app"
        "$APP_DIR/out/electron-forge-e2e-app-linux-ia32/electron-forge-e2e-app"
    )

    APP_EXECUTABLE=""
    for path in "${SEARCH_PATHS[@]}"; do
        if [ -f "$path" ] && [ -x "$path" ]; then
            APP_EXECUTABLE="$path"
            break
        fi
    done

    # Fallback: search recursively if not found in expected locations
    if [ -z "$APP_EXECUTABLE" ]; then
        echo "Searching recursively for executable..."
        APP_EXECUTABLE=$(find "$APP_DIR/out" -name "electron-forge-e2e-app" -type f -executable 2>/dev/null | head -n 1)
    fi

    if [ -z "$APP_EXECUTABLE" ]; then
        echo "Error: Could not find electron-forge-e2e-app executable"
        echo "Searched paths:"
        for path in "${SEARCH_PATHS[@]}"; do
            echo "  - $path"
        done
        echo "Directory contents:"
        ls -la "$APP_DIR/out/" || true
        find "$APP_DIR/out" -type f -executable 2>/dev/null || true
        exit 1
    fi

    echo "Found executable: $APP_EXECUTABLE"

    # Verify the executable works
    if ! "$APP_EXECUTABLE" --version 2>/dev/null; then
        echo "Warning: Executable exists but may not be functional"
    fi

    # Create .desktop file for protocol handler
    DESKTOP_FILE="$HOME/.local/share/applications/electron-forge-testapp.desktop"
    mkdir -p "$(dirname "$DESKTOP_FILE")"

    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Electron Forge Test App
Comment=Test application for protocol handler E2E tests
Exec=$APP_EXECUTABLE %u
Terminal=false
Type=Application
Categories=Utility;
MimeType=x-scheme-handler/testapp;
EOF

    echo "Created .desktop file: $DESKTOP_FILE"

    # Update desktop database
    if command -v update-desktop-database &> /dev/null; then
        update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
    else
        echo "Warning: update-desktop-database not found, skipping"
    fi

    # Register the protocol handler
    if command -v xdg-mime &> /dev/null; then
        xdg-mime default electron-forge-testapp.desktop x-scheme-handler/testapp
        echo "Registered testapp:// protocol handler"

        # Verify registration
        HANDLER=$(xdg-mime query default x-scheme-handler/testapp)
        echo "Current handler for testapp://: $HANDLER"
    else
        echo "Error: xdg-mime not found, cannot register protocol handler"
        exit 1
    fi

elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Platform: macOS"
    echo "Protocol handler registration on macOS is handled by the app itself via setAsDefaultProtocolClient"
    echo "No additional setup required"
else
    echo "Unsupported platform: $OSTYPE"
    exit 1
fi

echo "Setup complete!"
