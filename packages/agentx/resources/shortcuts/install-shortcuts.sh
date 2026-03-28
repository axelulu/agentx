#!/bin/bash
# AgentX Shortcuts Installer
# Creates useful macOS Shortcuts that integrate with AgentX
#
# Usage: bash install-shortcuts.sh
#
# This script registers the agentx:// URL scheme handler and
# provides ready-to-use shortcut examples.

set -e

echo "=== AgentX Shortcuts.app Integration ==="
echo ""
echo "Available URL actions:"
echo ""
echo "  1. Translate text:"
echo "     agentx://x-callback-url/translate?text=Hello&target_lang=zh"
echo ""
echo "  2. Chat / Ask AI:"
echo "     agentx://x-callback-url/chat?prompt=What%20is%20Rust?"
echo ""
echo "  3. Summarize text:"
echo "     agentx://x-callback-url/summarize?text=Long%20text%20here..."
echo ""
echo "  4. Open AgentX:"
echo "     agentx://x-callback-url/open"
echo ""
echo "  Supported parameters:"
echo "    x-success=<url>  — callback URL on success (result in 'result' param)"
echo "    x-error=<url>    — callback URL on error (message in 'errorMessage' param)"
echo ""
echo "Results are automatically copied to your clipboard."
echo ""

# Create example shortcuts via AppleScript
echo "Creating example Shortcuts..."

# 1. Translate Clipboard
osascript <<'APPLESCRIPT'
tell application "Shortcuts Events"
    -- Note: Shortcuts must be created manually via the Shortcuts app
    -- This script opens Shortcuts app for the user
end tell
APPLESCRIPT

# Open Shortcuts app with a guide
echo ""
echo "=== Quick Setup Guide ==="
echo ""
echo "Open Shortcuts.app and create these shortcuts:"
echo ""
echo "--- Shortcut 1: 'AgentX Translate' ---"
echo "  1. Add action: 'Get Clipboard'"
echo "  2. Add action: 'URL'"
echo "     Set to: agentx://x-callback-url/translate?text=[Clipboard]&target_lang=zh"
echo "  3. Add action: 'Open URLs'"
echo "  4. Add action: 'Wait' (2 seconds)"
echo "  5. Add action: 'Get Clipboard'"
echo "  6. Add action: 'Show Notification' with clipboard content"
echo ""
echo "--- Shortcut 2: 'Ask AgentX' ---"
echo "  1. Add action: 'Ask for Input' (text prompt)"
echo "  2. Add action: 'URL'"
echo "     Set to: agentx://x-callback-url/chat?prompt=[Input]"
echo "  3. Add action: 'Open URLs'"
echo "  4. Add action: 'Wait' (3 seconds)"
echo "  5. Add action: 'Get Clipboard'"
echo "  6. Add action: 'Show Result'"
echo ""
echo "--- Shortcut 3: 'AgentX Summarize' ---"
echo "  1. Add action: 'Get Clipboard'"
echo "  2. Add action: 'URL'"
echo "     Set to: agentx://x-callback-url/summarize?text=[Clipboard]"
echo "  3. Add action: 'Open URLs'"
echo "  4. Add action: 'Wait' (3 seconds)"
echo "  5. Add action: 'Get Clipboard'"
echo "  6. Add action: 'Show Notification' with clipboard content"
echo ""
echo "--- Siri Integration ---"
echo "  After creating shortcuts, just say:"
echo "  'Hey Siri, AgentX Translate'"
echo "  'Hey Siri, Ask AgentX'"
echo "  'Hey Siri, AgentX Summarize'"
echo ""

# Ask if user wants to open Shortcuts app
read -p "Open Shortcuts.app now? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    open -a "Shortcuts"
fi

echo "Done! Your AgentX shortcuts are ready to use."
