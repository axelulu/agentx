#!/usr/bin/env bash
#
# Post-build hook: compile and embed the Share Extension into the .app bundle.
#
# Called automatically by Tauri's build pipeline via beforeBundleCommand,
# or manually after building.
#
# Usage:
#   ./scripts/embed-share-extension.sh [--app-path <path-to-AgentX.app>]
#
# If --app-path is not specified, searches for the app bundle in the
# standard Tauri build output directories.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARE_EXT_DIR="$PROJECT_DIR/share-extension"

APP_PATH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --app-path) APP_PATH="$2"; shift 2 ;;
        *) shift ;;
    esac
done

# Auto-detect app path if not provided
if [[ -z "$APP_PATH" ]]; then
    # Check common Tauri build output directories
    for candidate in \
        "$PROJECT_DIR/src-tauri/target/release/bundle/macos/AgentX.app" \
        "$PROJECT_DIR/src-tauri/target/debug/bundle/macos/AgentX.app" \
        "$PROJECT_DIR/src-tauri/target/release/bundle/dmg/AgentX.app" \
        "$PROJECT_DIR/src-tauri/target/debug/AgentX.app"; do
        if [[ -d "$candidate" ]]; then
            APP_PATH="$candidate"
            break
        fi
    done

    if [[ -z "$APP_PATH" ]]; then
        echo "[ShareExtension] No app bundle found. Skipping extension embedding."
        echo "[ShareExtension] Run 'tauri build' first, or pass --app-path."
        exit 0
    fi
fi

echo "[ShareExtension] App bundle: $APP_PATH"

# Determine build mode
IS_RELEASE=false
if [[ "$APP_PATH" == *"/release/"* ]]; then
    IS_RELEASE=true
fi

# Build the extension
BUILD_FLAGS=""
if $IS_RELEASE; then
    BUILD_FLAGS="--release"
fi

"$SHARE_EXT_DIR/build.sh" $BUILD_FLAGS

# Create PlugIns directory in app bundle
PLUGINS_DIR="$APP_PATH/Contents/PlugIns"
mkdir -p "$PLUGINS_DIR"

# Copy the built extension
APPEX_SRC="$SHARE_EXT_DIR/build/ShareExtension.appex"
APPEX_DST="$PLUGINS_DIR/ShareExtension.appex"

if [[ -d "$APPEX_DST" ]]; then
    rm -rf "$APPEX_DST"
fi

cp -R "$APPEX_SRC" "$APPEX_DST"

echo "[ShareExtension] Embedded at: $APPEX_DST"

# If the app is code-signed, re-sign the extension with the same identity
# (Tauri's bundler will re-sign the entire app, but for dev builds we
# need to sign it ourselves)
if codesign -d "$APP_PATH" 2>/dev/null; then
    SIGN_IDENTITY=$(codesign -d --verbose "$APP_PATH" 2>&1 | grep "Authority=" | head -1 | sed 's/.*Authority=//' || true)
    if [[ -n "$SIGN_IDENTITY" && "$SIGN_IDENTITY" != "-" ]]; then
        echo "[ShareExtension] Re-signing with: $SIGN_IDENTITY"
        codesign --force --sign "$SIGN_IDENTITY" --deep "$APPEX_DST" 2>/dev/null || true
    fi
fi

echo "[ShareExtension] Done."
