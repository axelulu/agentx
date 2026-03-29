#!/bin/bash
# ---------------------------------------------------------------------------
# Build the Quick Look Preview Extension for AgentX
#
# Usage:
#   ./build.sh              # Build release
#   ./build.sh --install    # Build + copy into the built AgentX.app
#
# Supports two build modes:
#   1. xcodebuild (requires Xcode) — preferred
#   2. swiftc     (Command Line Tools only) — fallback
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
APPEX_NAME="QuickLookPreview"
APPEX_PATH="$BUILD_DIR/$APPEX_NAME.appex"

cd "$SCRIPT_DIR"
mkdir -p "$BUILD_DIR"

# ── Detect build mode ────────────────────────────────────────────────────
USE_XCODEBUILD=false
if command -v xcodebuild &>/dev/null && xcodebuild -version &>/dev/null 2>&1; then
  USE_XCODEBUILD=true
fi

if [ "$USE_XCODEBUILD" = true ]; then
  # ── Mode 1: XcodeGen + xcodebuild ──────────────────────────────────────
  if ! command -v xcodegen &>/dev/null; then
    echo "xcodegen not found. Install with: brew install xcodegen"
    exit 1
  fi

  echo "-> Generating Xcode project ..."
  xcodegen generate --spec project.yml --quiet 2>/dev/null || xcodegen generate --spec project.yml

  echo "-> Building with xcodebuild ..."
  DERIVED="$BUILD_DIR/derived"
  xcodebuild \
    -project "$APPEX_NAME.xcodeproj" \
    -scheme "$APPEX_NAME" \
    -configuration Release \
    -derivedDataPath "$DERIVED" \
    CODE_SIGN_IDENTITY="-" \
    CODE_SIGNING_ALLOWED="NO" \
    ONLY_ACTIVE_ARCH=NO \
    -quiet

  BUILT="$DERIVED/Build/Products/Release/$APPEX_NAME.appex"
  if [ ! -d "$BUILT" ]; then
    echo "Build failed: $BUILT not found"
    exit 1
  fi
  rm -rf "$APPEX_PATH"
  cp -R "$BUILT" "$APPEX_PATH"

else
  # ── Mode 2: Manual swiftc build ────────────────────────────────────────
  echo "-> Building with swiftc (no Xcode) ..."

  SDK="$(xcrun --show-sdk-path --sdk macosx)"
  ARCH="$(uname -m)"  # arm64 or x86_64
  TARGET="${ARCH}-apple-macos12.0"

  OBJ_DIR="$BUILD_DIR/obj"
  BINARY="$BUILD_DIR/$APPEX_NAME"
  mkdir -p "$OBJ_DIR"

  # Compile Swift sources to object files
  echo "   Compiling ..."
  xcrun swiftc \
    -target "$TARGET" \
    -sdk "$SDK" \
    -parse-as-library \
    -module-name "$APPEX_NAME" \
    -emit-object \
    -o "$OBJ_DIR/PreviewProvider.o" \
    Sources/PreviewProvider.swift

  # Link as MH_BUNDLE (required for app extensions)
  echo "   Linking ..."

  # Find Swift library paths
  SWIFT_LIB_DIR="$(dirname "$(xcrun --find swiftc)")/../lib/swift/macosx"
  TOOLCHAIN_LIB="$(dirname "$(xcrun --find swiftc)")/../lib/swift_static/macosx"

  xcrun clang \
    -target "$TARGET" \
    -isysroot "$SDK" \
    -bundle \
    -o "$BINARY" \
    "$OBJ_DIR/PreviewProvider.o" \
    -framework Foundation \
    -framework QuickLookUI \
    -framework UniformTypeIdentifiers \
    -L "$SWIFT_LIB_DIR" \
    -lswiftCore \
    -lswiftFoundation \
    -lswiftDarwin \
    -lswiftObjectiveC \
    -lswiftCoreFoundation \
    -lswiftDispatch \
    -lswiftCoreGraphics \
    -rpath /usr/lib/swift \
    -rpath "$SWIFT_LIB_DIR" \
    -fapplication-extension

  # Assemble the .appex bundle structure
  echo "   Assembling .appex bundle ..."
  rm -rf "$APPEX_PATH"
  mkdir -p "$APPEX_PATH/Contents/MacOS"
  cp "$BINARY" "$APPEX_PATH/Contents/MacOS/$APPEX_NAME"

  # Process Info.plist — replace build variables with actual values
  sed \
    -e 's/$(EXECUTABLE_NAME)/QuickLookPreview/g' \
    -e 's/$(PRODUCT_BUNDLE_IDENTIFIER)/com.agentx.desktop.QuickLookPreview/g' \
    -e 's/$(PRODUCT_NAME)/QuickLookPreview/g' \
    -e 's/$(PRODUCT_MODULE_NAME)/QuickLookPreview/g' \
    Info.plist > "$APPEX_PATH/Contents/Info.plist"

  # Ad-hoc sign
  codesign --force --sign - "$APPEX_PATH" 2>/dev/null || true

  rm -rf "$OBJ_DIR" "$BINARY"
fi

if [ ! -d "$APPEX_PATH" ]; then
  echo "Build failed: $APPEX_PATH not found"
  exit 1
fi

echo "-> Built: $APPEX_PATH"

# ── Install into AgentX.app (optional) ──────────────────────────────────
if [ "${1:-}" = "--install" ]; then
  TAURI_DIR="$SCRIPT_DIR/../../src-tauri"
  APP_BUNDLE="$TAURI_DIR/target/release/bundle/macos/AgentX.app"
  if [ ! -d "$APP_BUNDLE" ]; then
    APP_BUNDLE="$TAURI_DIR/target/debug/bundle/macos/AgentX.app"
  fi

  if [ ! -d "$APP_BUNDLE" ]; then
    echo "AgentX.app not found. Build the Tauri app first."
    exit 1
  fi

  PLUGINS_DIR="$APP_BUNDLE/Contents/PlugIns"
  mkdir -p "$PLUGINS_DIR"
  rm -rf "$PLUGINS_DIR/$APPEX_NAME.appex"
  cp -R "$APPEX_PATH" "$PLUGINS_DIR/"
  echo "-> Installed to: $PLUGINS_DIR/$APPEX_NAME.appex"
fi

echo "Done."
