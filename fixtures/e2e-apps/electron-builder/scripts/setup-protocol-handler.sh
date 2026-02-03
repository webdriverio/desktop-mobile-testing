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

    # Look for the executable in the expected Linux unpacked directory
    # electron-builder with "target": "dir" creates dist-electron/linux-unpacked/
    SEARCH_PATHS=(
        "$APP_DIR/dist-electron/linux-unpacked/electron-builder-e2e-app"
        "$APP_DIR/dist-electron/linux-arm64-unpacked/electron-builder-e2e-app"
        "$APP_DIR/dist-electron/linux-x64-unpacked/electron-builder-e2e-app"
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
        APP_EXECUTABLE=$(find "$APP_DIR/dist-electron" -name "electron-builder-e2e-app" -type f -executable 2>/dev/null | head -n 1)
    fi

    if [ -z "$APP_EXECUTABLE" ]; then
        echo "Error: Could not find electron-builder-e2e-app executable"
        echo "Searched paths:"
        for path in "${SEARCH_PATHS[@]}"; do
            echo "  - $path"
        done
        echo "Directory contents:"
        ls -la "$APP_DIR/dist-electron/" || true
        exit 1
    fi

    echo "Found executable: $APP_EXECUTABLE"

    # Verify the executable works
    if ! "$APP_EXECUTABLE" --version 2>/dev/null; then
        echo "Warning: Executable exists but may not be functional"
    fi

    # IDEMPOTENCY CHECK: Check if protocol handler is already registered
    DESKTOP_FILE_BASENAME="electron-builder-e2e-app-testapp.desktop"
    if command -v xdg-mime &> /dev/null; then
        CURRENT_HANDLER=$(xdg-mime query default x-scheme-handler/testapp 2>/dev/null || echo "")
        if [ "$CURRENT_HANDLER" = "$DESKTOP_FILE_BASENAME" ]; then
            echo "Protocol handler already registered correctly (handler: $CURRENT_HANDLER), skipping..."
            exit 0
        fi
        echo "Current handler: $CURRENT_HANDLER, will update to: $DESKTOP_FILE_BASENAME"
    fi

    # Create .desktop file for protocol handler
    DESKTOP_FILE="$HOME/.local/share/applications/electron-builder-e2e-app-testapp.desktop"
    mkdir -p "$(dirname "$DESKTOP_FILE")"

    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Electron Builder E2E Test App
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
        xdg-mime default electron-builder-e2e-app-testapp.desktop x-scheme-handler/testapp
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
