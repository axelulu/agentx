#!/usr/bin/env bash
#
# Build the AgentX Share Extension (.appex) from Swift source.
#
# Usage:
#   ./build.sh [--release] [--output <dir>]
#
# The compiled .appex bundle is placed in the output directory
# (default: ./build/ShareExtension.appex).
#
# This script builds a universal binary (arm64 + x86_64) for distribution,
# or a native-arch-only binary for development.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_FILE="$SCRIPT_DIR/ShareViewController.swift"
INFO_PLIST="$SCRIPT_DIR/Info.plist"

RELEASE=false
OUTPUT_DIR="$SCRIPT_DIR/build"

while [[ $# -gt 0 ]]; do
    case $1 in
        --release) RELEASE=true; shift ;;
        --output) OUTPUT_DIR="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

APPEX_DIR="$OUTPUT_DIR/ShareExtension.appex"
CONTENTS_DIR="$APPEX_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"

SDK_PATH="$(xcrun --show-sdk-path)"
MIN_MACOS="12.0"

echo "[ShareExtension] Building..."

# Clean previous build
rm -rf "$APPEX_DIR"
mkdir -p "$MACOS_DIR"

# Common Swift compiler flags
SWIFT_FLAGS=(
    -sdk "$SDK_PATH"
    -parse-as-library
    -import-objc-header "$SCRIPT_DIR/BridgingHeader.h"
    -framework Foundation
    -framework AppKit
    -framework UniformTypeIdentifiers
    -application-extension
    -module-name ShareExtension
    -Xlinker -e -Xlinker _NSExtensionMain
    -Xlinker -rpath -Xlinker @executable_path/../Frameworks
)

if $RELEASE; then
    echo "[ShareExtension] Building universal binary (arm64 + x86_64)..."

    # Build arm64
    swiftc "${SWIFT_FLAGS[@]}" \
        -target arm64-apple-macos${MIN_MACOS} \
        -O \
        "$SOURCE_FILE" \
        -o "$MACOS_DIR/ShareExtension-arm64"

    # Build x86_64
    swiftc "${SWIFT_FLAGS[@]}" \
        -target x86_64-apple-macos${MIN_MACOS} \
        -O \
        "$SOURCE_FILE" \
        -o "$MACOS_DIR/ShareExtension-x86_64"

    # Create universal binary
    lipo -create \
        "$MACOS_DIR/ShareExtension-arm64" \
        "$MACOS_DIR/ShareExtension-x86_64" \
        -output "$MACOS_DIR/ShareExtension"

    rm "$MACOS_DIR/ShareExtension-arm64" "$MACOS_DIR/ShareExtension-x86_64"
else
    echo "[ShareExtension] Building native arch binary..."
    ARCH="$(uname -m)"

    swiftc "${SWIFT_FLAGS[@]}" \
        -target "${ARCH}-apple-macos${MIN_MACOS}" \
        "$SOURCE_FILE" \
        -o "$MACOS_DIR/ShareExtension"
fi

# Copy Info.plist
cp "$INFO_PLIST" "$CONTENTS_DIR/Info.plist"

echo "[ShareExtension] Built: $APPEX_DIR"
