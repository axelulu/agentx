use tauri::{AppHandle, Emitter, Manager};

/// Read current clipboard text content.
#[cfg(target_os = "macos")]
pub fn get_clipboard_text() -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("pbpaste")
        .output()
        .map_err(|e| format!("Failed to read clipboard: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Err("Clipboard is empty".to_string());
    }

    Ok(text)
}

#[cfg(not(target_os = "macos"))]
pub fn get_clipboard_text() -> Result<String, String> {
    Err("Clipboard pipeline is only supported on macOS".to_string())
}

/// Write text to the system clipboard.
#[cfg(target_os = "macos")]
pub fn set_clipboard_text(text: &str) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let mut child = Command::new("pbcopy")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to write clipboard: {}", e))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to pbcopy stdin: {}", e))?;
    }
    child
        .wait()
        .map_err(|e| format!("pbcopy failed: {}", e))?;

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn set_clipboard_text(_text: &str) -> Result<(), String> {
    Err("Clipboard pipeline is only supported on macOS".to_string())
}

/// Register the clipboard pipeline global shortcut (Option+Cmd+A).
/// Shows the main window and emits an event to open the clipboard dialog.
pub fn register_clipboard_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let shortcut: Shortcut = "Option+Cmd+A".parse()?;
    let handle = app.clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                // Show main window and emit clipboard:open event
                if let Some(win) = handle.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                    let _ = win.unminimize();
                }
                let _ = handle.emit("clipboard:open", ());
            }
        })?;

    Ok(())
}
