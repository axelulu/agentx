use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

// ---------------------------------------------------------------------------
// CGEvent-based keystroke simulation (replaces osascript which is blocked)
// ---------------------------------------------------------------------------

/// Simulate pressing a key with Cmd held, using raw Core Graphics FFI.
/// This uses the app's Accessibility permission directly, bypassing osascript.
/// `keycode` is a macOS virtual key code (e.g. 0x08 = C, 0x09 = V).
#[cfg(target_os = "macos")]
pub fn simulate_key_with_cmd(keycode: u16) -> Result<(), String> {
    use std::thread;
    use std::time::Duration;

    type CGEventRef = *mut std::ffi::c_void;
    type CGEventSourceRef = *mut std::ffi::c_void;
    type CGEventFlags = u64;
    const K_CG_EVENT_SOURCE_STATE_COMBINED: i32 = 0;
    // Use PRIVATE event source — completely independent of physical keyboard state.
    // Combined state can inherit the Option modifier from the shortcut trigger,
    // causing Cmd+C to be seen as Option+Cmd+C by some apps.
    const K_CG_EVENT_SOURCE_STATE_PRIVATE: i32 = 1;
    const K_CG_HID_EVENT_TAP: i32 = 0;
    const K_CG_EVENT_FLAG_COMMAND: u64 = 0x00100000;

    extern "C" {
        fn CGEventSourceCreate(stateID: i32) -> CGEventSourceRef;
        fn CGEventSourceFlagsState(stateID: i32) -> CGEventFlags;
        fn CGEventCreateKeyboardEvent(
            source: CGEventSourceRef,
            keycode: u16,
            keyDown: bool,
        ) -> CGEventRef;
        fn CGEventSetFlags(event: CGEventRef, flags: u64);
        fn CGEventPost(tap: i32, event: CGEventRef);
        fn CFRelease(cf: *mut std::ffi::c_void);
    }

    unsafe {
        // Brief wait for modifier keys to release. We use a PRIVATE event
        // source below so the synthetic event only carries the flags we set,
        // but some apps check physical keyboard state via CGEventSourceFlagsState.
        // Keep the wait short — the user typically releases Option within ~100ms.
        let modifier_mask: u64 = 0x00FF0000; // all modifier flags
        for _ in 0..20 {
            let flags = CGEventSourceFlagsState(K_CG_EVENT_SOURCE_STATE_COMBINED);
            if (flags & modifier_mask) == 0 {
                break;
            }
            thread::sleep(Duration::from_millis(5));
        }
        // Minimal settle time after modifiers released
        thread::sleep(Duration::from_millis(10));

        // Use PRIVATE source so the synthetic event carries ONLY the flags we set,
        // completely isolated from the physical keyboard state.
        let source = CGEventSourceCreate(K_CG_EVENT_SOURCE_STATE_PRIVATE);
        if source.is_null() {
            return Err("Failed to create CGEventSource".into());
        }

        let key_down = CGEventCreateKeyboardEvent(source, keycode, true);
        let key_up = CGEventCreateKeyboardEvent(source, keycode, false);

        if key_down.is_null() || key_up.is_null() {
            if !key_down.is_null() { CFRelease(key_down); }
            if !key_up.is_null() { CFRelease(key_up); }
            CFRelease(source);
            return Err("Failed to create keyboard event".into());
        }

        // Set ONLY the Command flag — explicitly no Option/Shift/Ctrl
        CGEventSetFlags(key_down, K_CG_EVENT_FLAG_COMMAND);
        CGEventSetFlags(key_up, K_CG_EVENT_FLAG_COMMAND);

        CGEventPost(K_CG_HID_EVENT_TAP, key_down);
        thread::sleep(Duration::from_millis(20));
        CGEventPost(K_CG_HID_EVENT_TAP, key_up);

        CFRelease(key_down);
        CFRelease(key_up);
        CFRelease(source);
    }

    eprintln!("[simulate_key_with_cmd] Posted keycode 0x{:02X} with Cmd", keycode);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn simulate_key_with_cmd(_keycode: u16) -> Result<(), String> {
    Err("Keystroke simulation is only supported on macOS".to_string())
}

/// Get the selected text from the system clipboard by simulating Cmd+C.
///
/// Flow: save clipboard → simulate Cmd+C → read clipboard → restore clipboard
#[cfg(target_os = "macos")]
pub fn get_selected_text() -> Result<String, String> {
    use std::process::Command;
    use std::thread;
    use std::time::Duration;

    // Save current clipboard content
    let old_clipboard = Command::new("pbpaste")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    // Clear clipboard with a unique sentinel to detect if Cmd+C actually copied
    let sentinel = "__agentx_empty__";
    let _ = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(ref mut stdin) = child.stdin {
                let _ = stdin.write_all(sentinel.as_bytes());
            }
            child.wait()
        });

    // Simulate Cmd+C using CGEventPost (bypasses osascript permission issues)
    // Try up to 2 attempts with increasing wait times for reliability.
    eprintln!("[get_selected_text] Simulating Cmd+C via CGEventPost...");

    let waits_ms = [200, 350]; // 1st attempt 200ms, retry 350ms
    let mut last_result = String::new();

    for (attempt, wait) in waits_ms.iter().enumerate() {
        simulate_key_with_cmd(0x08) // 0x08 = kVK_C
            .map_err(|e| {
                eprintln!("[get_selected_text] CGEventPost failed: {}", e);
                format!("Failed to simulate Cmd+C: {}", e)
            })?;
        eprintln!("[get_selected_text] attempt {} — waiting {}ms for clipboard...", attempt + 1, wait);

        thread::sleep(Duration::from_millis(*wait));

        let selected = Command::new("pbpaste")
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .map_err(|e| format!("Failed to read clipboard: {}", e))?;

        let trimmed = selected.trim().to_string();
        eprintln!("[get_selected_text] attempt {} clipboard: {:?}",
            attempt + 1, &trimmed[..trimmed.len().min(100)]);

        if !trimmed.is_empty() && trimmed != sentinel {
            // Success — restore clipboard and return
            let old = old_clipboard.clone();
            thread::spawn(move || {
                let _ = Command::new("pbcopy")
                    .stdin(std::process::Stdio::piped())
                    .spawn()
                    .and_then(|mut child| {
                        use std::io::Write;
                        if let Some(ref mut stdin) = child.stdin {
                            let _ = stdin.write_all(old.as_bytes());
                        }
                        child.wait()
                    });
            });
            return Ok(trimmed);
        }
        last_result = trimmed;
    }

    // Both attempts failed — restore clipboard and return error
    let old = old_clipboard.clone();
    thread::spawn(move || {
        let _ = Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                use std::io::Write;
                if let Some(ref mut stdin) = child.stdin {
                    let _ = stdin.write_all(old.as_bytes());
                }
                child.wait()
            });
    });

    eprintln!("[get_selected_text] All Cmd+C attempts failed. Last result: {:?}", last_result);
    Err("No text selected".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn get_selected_text() -> Result<String, String> {
    Err("Translation shortcut is only supported on macOS".to_string())
}

/// Get the current mouse cursor position.
#[cfg(target_os = "macos")]
pub fn get_cursor_position() -> (f64, f64) {
    use objc2_app_kit::{NSEvent, NSScreen};
    use objc2_foundation::MainThreadMarker;

    let point = NSEvent::mouseLocation();
    // NSEvent::mouseLocation returns screen coords with origin at bottom-left
    // We need to flip Y for Tauri (origin at top-left)
    if let Some(mtm) = MainThreadMarker::new() {
        if let Some(screen) = NSScreen::mainScreen(mtm) {
            let screen_frame = screen.frame();
            let flipped_y = screen_frame.size.height - point.y;
            return (point.x, flipped_y);
        }
    }
    (point.x, point.y)
}

#[cfg(not(target_os = "macos"))]
pub fn get_cursor_position() -> (f64, f64) {
    (100.0, 100.0)
}

/// Create and show the translator floating window near the cursor.
pub fn show_translator_window(app: &AppHandle, text: &str) -> Result<(), String> {
    let (cursor_x, cursor_y) = get_cursor_position();

    // Window dimensions
    let win_width: f64 = 420.0;
    let win_height: f64 = 320.0;

    // Position: below and slightly right of cursor, clamped to screen
    let x = cursor_x - 40.0;
    let y = cursor_y + 10.0;

    // Check if translator window already exists
    if let Some(win) = app.get_webview_window("translator") {
        // Update position and show
        let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
        let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(win_width, win_height)));
        // Send the text to the existing window
        let _ = win.emit("translator:set-text", text);
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    // Create new translator window
    let url = WebviewUrl::App("/translator.html".into());

    let win = WebviewWindowBuilder::new(app, "translator", url)
        .title("Translator")
        .inner_size(win_width, win_height)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create translator window: {}", e))?;

    // Send text after a short delay to let the window load
    let text_owned = text.to_string();
    let win_clone = win.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let _ = win_clone.emit("translator:set-text", &text_owned);
        let _ = win_clone.show();
        let _ = win_clone.set_focus();
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        #[cfg(target_os = "macos")]
        crate::vibrancy::apply_popup_vibrancy(&win_clone);
    });

    // Close on blur (click outside)
    let win_for_event = win.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let _ = win_for_event.hide();
        }
    });

    Ok(())
}

/// Register the translation global shortcut (Option+D).
pub fn register_translate_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let shortcut: Shortcut = "Option+D".parse()?;
    let handle = app.clone();

    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            // Get selected text and show translator
            match get_selected_text() {
                Ok(text) => {
                    if let Err(e) = show_translator_window(&handle, &text) {
                        eprintln!("[Translate] Failed to show window: {}", e);
                    }
                }
                Err(e) => {
                    eprintln!("[Translate] No text selected: {}", e);
                }
            }
        }
    })?;

    Ok(())
}
