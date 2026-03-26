use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

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

    // Clear clipboard first to detect if Cmd+C actually copied something
    let _ = Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(ref mut stdin) = child.stdin {
                let _ = stdin.write_all(b"");
            }
            child.wait()
        });

    // Simulate Cmd+C using osascript
    let script = r#"
        tell application "System Events"
            keystroke "c" using {command down}
        end tell
    "#;
    Command::new("osascript")
        .args(["-e", script])
        .output()
        .map_err(|e| format!("Failed to simulate Cmd+C: {}", e))?;

    // Wait for clipboard to update
    thread::sleep(Duration::from_millis(150));

    // Read the new clipboard content
    let selected = Command::new("pbpaste")
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .map_err(|e| format!("Failed to read clipboard: {}", e))?;

    // Restore original clipboard (in background to avoid blocking)
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

    let trimmed = selected.trim().to_string();
    if trimmed.is_empty() {
        return Err("No text selected".to_string());
    }

    Ok(trimmed)
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
