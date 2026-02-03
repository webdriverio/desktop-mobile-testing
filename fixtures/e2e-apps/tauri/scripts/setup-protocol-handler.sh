#!/bin/bash
# Setup script to register testapp:// protocol handler for Tauri E2E testing
# Idempotent: safe to run multiple times

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PROTOCOL_NAME="testapp"
DESKTOP_FILE="$HOME/.local/share/applications/tauri-e2e-app-${PROTOCOL_NAME}.desktop"

echo "Setting up ${PROTOCOL_NAME}:// protocol handler for Tauri..."

# IDEMPOTENCY CHECK
if command -v xdg-mime &> /dev/null; then
    CURRENT_HANDLER=$(xdg-mime query default x-scheme-handler/${PROTOCOL_NAME} 2>/dev/null || echo "")
    EXPECTED_HANDLER="$(basename "$DESKTOP_FILE")"
    if [ "$CURRENT_HANDLER" = "$EXPECTED_HANDLER" ]; then
        echo "Protocol handler already registered correctly (handler: $CURRENT_HANDLER), skipping..."
        exit 0
    fi
    echo "Current handler: $CURRENT_HANDLER, will update to: $EXPECTED_HANDLER"
fi

# Find Tauri binary
SEARCH_PATHS=(
    "$APP_DIR/src-tauri/target/release/tauri-e2e-app"
    "$APP_DIR/src-tauri/target/debug/tauri-e2e-app"
    "$APP_DIR/src-tauri/target/release/tauri-e2e-app.exe"
    "$APP_DIR/src-tauri/target/debug/tauri-e2e-app.exe"
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
    APP_EXECUTABLE=$(find "$APP_DIR/src-tauri/target" -name "tauri-e2e-app" -type f -executable 2>/dev/null | head -n 1)
fi

if [ -z "$APP_EXECUTABLE" ]; then
    echo "Error: Could not find tauri-e2e-app executable"
    echo "Searched paths:"
    for path in "${SEARCH_PATHS[@]}"; do
        echo "  - $path"
    done
    echo "Directory contents:"
    ls -la "$APP_DIR/src-tauri/target/" || true
    exit 1
fi

echo "Found executable: $APP_EXECUTABLE"

# Verify the executable works (optional, for debug builds this may fail)
if ! "$APP_EXECUTABLE" --version 2>/dev/null; then
    echo "Note: Executable exists but --version flag not supported (expected for Tauri apps)"
fi

# Create .desktop file
mkdir -p "$(dirname "$DESKTOP_FILE")"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Tauri E2E Test App
Comment=Test application for protocol handler E2E tests
Exec=$APP_EXECUTABLE %u
Terminal=false
Type=Application
Categories=Utility;
MimeType=x-scheme-handler/${PROTOCOL_NAME};
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
    xdg-mime default "$(basename "$DESKTOP_FILE")" x-scheme-handler/${PROTOCOL_NAME}
    echo "Registered ${PROTOCOL_NAME}:// protocol handler"

    # Verify registration
    HANDLER=$(xdg-mime query default x-scheme-handler/${PROTOCOL_NAME})
    echo "Current handler for ${PROTOCOL_NAME}://: $HANDLER"
else
    echo "Error: xdg-mime not found, cannot register protocol handler"
    exit 1
fi

echo "Setup complete!"
