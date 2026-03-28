use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const WIN_WIDTH: f64 = 340.0;
const WIN_HEIGHT: f64 = 420.0;

/// Cache the latest context so the frontend can fetch it on mount.
static LAST_CONTEXT: Mutex<Option<String>> = Mutex::new(None);

/// Tauri command: frontend calls this on mount to get the cached context.
#[tauri::command]
pub fn contextbar_get_context() -> Option<String> {
    LAST_CONTEXT.lock().ok().and_then(|g| g.clone())
}

/// Debug command: test text capture methods and return diagnostic info.
#[tauri::command]
pub fn contextbar_debug_capture() -> serde_json::Value {
    let mut result = serde_json::Map::new();

    #[cfg(target_os = "macos")]
    {
        // Check accessibility
        result.insert("axTrusted".into(), serde_json::json!(crate::accessibility::is_trusted()));

        // Try AXSelectedText
        match crate::accessibility::get_selected_text_ax() {
            Some(text) => {
                result.insert("axSelectedText".into(), serde_json::json!(text));
                result.insert("axMethod".into(), serde_json::json!("success"));
            }
            None => {
                result.insert("axSelectedText".into(), serde_json::json!(null));
                result.insert("axMethod".into(), serde_json::json!("failed"));
            }
        }

        // Try CGEventPost Cmd+C
        match crate::translate::get_selected_text() {
            Ok(text) => {
                result.insert("cmdCText".into(), serde_json::json!(text));
                result.insert("cmdCMethod".into(), serde_json::json!("success"));
            }
            Err(e) => {
                result.insert("cmdCText".into(), serde_json::json!(null));
                result.insert("cmdCMethod".into(), serde_json::json!(format!("failed: {}", e)));
            }
        }
    }

    serde_json::Value::Object(result)
}

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------

fn ensure_contextbar_visible(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("contextbar") {
        let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
        let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(WIN_WIDTH, WIN_HEIGHT)));
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    let url = WebviewUrl::App("/contextbar.html".into());
    let win = WebviewWindowBuilder::new(app, "contextbar", url)
        .title("Context Actions")
        .inner_size(WIN_WIDTH, WIN_HEIGHT)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create contextbar window: {}", e))?;

    let win_clone = win.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let _ = win_clone.show();
        let _ = win_clone.set_focus();
    });

    // Hide on blur — with 300ms delay to prevent false triggers
    let win_for_event = win.clone();
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let w = win_for_event.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                if !w.is_focused().unwrap_or(true) {
                    let _ = w.hide();
                }
            });
        }
    });

    Ok(())
}

pub fn send_context_to_window(app: &AppHandle, context_str: &str) {
    if let Ok(mut guard) = LAST_CONTEXT.lock() {
        *guard = Some(context_str.to_string());
    }
    if let Some(win) = app.get_webview_window("contextbar") {
        let _ = win.emit("contextbar:set-context", context_str);
    }
}

// ---------------------------------------------------------------------------
// Context gathering — uses Accessibility API, NO Cmd+C simulation
// ---------------------------------------------------------------------------

/// Gather ALL context instantly via Accessibility API.
/// No clipboard manipulation, no keystroke simulation, no delays.
/// Must be called BEFORE the contextbar window steals focus.
pub fn gather_context() -> serde_json::Value {
    let mut ctx = serde_json::Map::new();

    #[cfg(target_os = "macos")]
    {
        // Check accessibility permission first
        let trusted = crate::accessibility::is_trusted();
        eprintln!("[ContextBar] AXIsProcessTrusted = {}", trusted);

        // Get frontmost app info
        match crate::accessibility::get_frontmost_app() {
            Ok(app_info) => {
                eprintln!("[ContextBar] frontmost app: {}", app_info);
                ctx.insert("app".into(), app_info);
            }
            Err(e) => {
                eprintln!("[ContextBar] ERROR getting frontmost app: {}", e);
            }
        }

        // Get focused element
        match crate::accessibility::get_focused_element(None) {
            Ok(element) => {
                eprintln!("[ContextBar] focused element role: {}",
                    element.get("role").and_then(|r| r.as_str()).unwrap_or("?"));
                ctx.insert("focusedElement".into(), element);
            }
            Err(e) => {
                eprintln!("[ContextBar] ERROR getting focused element: {}", e);
            }
        }

        // Get selected text via AXSelectedText — instant, no Cmd+C needed
        eprintln!("[ContextBar] trying AXSelectedText...");
        if let Some(text) = crate::accessibility::get_selected_text_ax() {
            eprintln!("[ContextBar] ✓ selected text (AX): {} chars — {:?}",
                text.len(), &text[..text.len().min(100)]);
            ctx.insert("selectedText".into(), serde_json::json!(text));
        } else {
            eprintln!("[ContextBar] ✗ AXSelectedText returned None, trying Cmd+C fallback...");
            // Fallback: try Cmd+C simulation via CGEventPost
            match crate::translate::get_selected_text() {
                Ok(text) => {
                    eprintln!("[ContextBar] ✓ selected text (Cmd+C): {} chars — {:?}",
                        text.len(), &text[..text.len().min(100)]);
                    ctx.insert("selectedText".into(), serde_json::json!(text));
                }
                Err(e) => {
                    eprintln!("[ContextBar] ✗ Cmd+C fallback failed: {}", e);
                }
            }
        }
    }

    serde_json::Value::Object(ctx)
}

// ---------------------------------------------------------------------------
// Shortcut registration
// ---------------------------------------------------------------------------

pub fn register_contextbar_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut: Shortcut = "Option+S".parse()?;
    let handle = app.clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                eprintln!("[ContextBar] Option+S pressed");

                let (cursor_x, cursor_y) = crate::translate::get_cursor_position();
                let x = cursor_x - 40.0;
                let y = cursor_y + 10.0;
                let h = handle.clone();

                std::thread::spawn(move || {
                    // Step 1: Gather ALL context BEFORE showing window
                    //         (original app still has focus — AX reads work correctly)
                    let context = gather_context();
                    let context_str = serde_json::to_string(&context).unwrap_or_default();

                    // Step 2: Cache context + send to window
                    send_context_to_window(&h, &context_str);

                    // Step 3: Show window
                    if let Err(e) = ensure_contextbar_visible(&h, x, y) {
                        eprintln!("[ContextBar] Failed to show window: {}", e);
                    }
                });
            }
        })?;

    eprintln!("[ContextBar] Registered Option+S shortcut");
    Ok(())
}

/// Called from dispatch_shortcut_action.
pub fn show_contextbar_at(app: &AppHandle, cursor_x: f64, cursor_y: f64, context: &str) -> Result<(), String> {
    let x = cursor_x - 40.0;
    let y = cursor_y + 10.0;
    send_context_to_window(app, context);
    ensure_contextbar_visible(app, x, y)
}
