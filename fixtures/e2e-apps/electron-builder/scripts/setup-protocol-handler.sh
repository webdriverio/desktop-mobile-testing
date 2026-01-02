#!/bin/bash
# Setup script to register the testapp:// protocol handler for E2E testing
# This script handles both Linux and macOS

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Setting up testapp:// protocol handler..."

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "Platform: Linux"

    # Find the built app executable
    APP_EXECUTABLE=$(find "$APP_DIR/dist" -name "electron-builder" -type f -executable | head -n 1)

    if [ -z "$APP_EXECUTABLE" ]; then
        echo "Error: Could not find electron-builder executable in dist/"
        exit 1
    fi

    echo "Found executable: $APP_EXECUTABLE"

    # Create .desktop file for protocol handler
    DESKTOP_FILE="$HOME/.local/share/applications/electron-builder-testapp.desktop"
    mkdir -p "$(dirname "$DESKTOP_FILE")"

    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Electron Builder Test App
Comment=Test application for protocol handler E2E tests
Exec=$APP_EXECUTABLE %u
Terminal=false
Type=Application
Categories=Utility;
MimeType=x-scheme-handler/testapp;
EOF

    echo "Created .desktop file: $DESKTOP_FILE"

    # Update desktop database
    update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

    # Register the protocol handler
    xdg-mime default electron-builder-testapp.desktop x-scheme-handler/testapp

    echo "Registered testapp:// protocol handler"

    # Verify registration
    HANDLER=$(xdg-mime query default x-scheme-handler/testapp)
    echo "Current handler for testapp://: $HANDLER"

elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "Platform: macOS"
    echo "Protocol handler registration on macOS is handled by the app itself via setAsDefaultProtocolClient"
    echo "No additional setup required"
else
    echo "Unsupported platform: $OSTYPE"
    exit 1
fi

echo "Setup complete!"
