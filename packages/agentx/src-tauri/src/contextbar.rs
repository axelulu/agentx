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
        result.insert("axTrusted".into(), serde_json::json!(crate::accessibility::is_trusted()));

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
// Native clipboard (NSPasteboard) — much faster than pbpaste/pbcopy subprocesses
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
mod clipboard_native {
    use objc2_app_kit::NSPasteboard;
    use objc2_foundation::NSString;

    /// Read the current general pasteboard string.
    pub fn read() -> String {
        unsafe {
            let pb = NSPasteboard::generalPasteboard();
            let nstype = NSString::from_str("public.utf8-plain-text");
            match pb.stringForType(&nstype) {
                Some(s) => s.to_string(),
                None => String::new(),
            }
        }
    }

    /// Write a string to the general pasteboard.
    pub fn write(text: &str) {
        unsafe {
            let pb = NSPasteboard::generalPasteboard();
            pb.clearContents();
            let ns_str = NSString::from_str(text);
            let nstype = NSString::from_str("public.utf8-plain-text");
            let _ = pb.setString_forType(&ns_str, &nstype);
        }
    }
}

// ---------------------------------------------------------------------------
// Window management
// ---------------------------------------------------------------------------

/// Show window at position WITHOUT stealing focus from the original app.
fn show_contextbar_no_focus(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("contextbar") {
        let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)));
        let _ = win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(WIN_WIDTH, WIN_HEIGHT)));
        let _ = win.show();
        #[cfg(target_os = "macos")]
        crate::vibrancy::apply_popup_vibrancy(&win);
        return Ok(());
    }
    create_contextbar_window(app, x, y)
}

/// Focus the contextbar window.
fn focus_contextbar(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("contextbar") {
        let _ = win.set_focus();
    }
}

/// Pre-create the contextbar window (hidden, off-screen) during startup so the
/// first Option+S doesn't trigger app activation / desktop switch.
pub fn precreate_contextbar_window(app: &AppHandle) {
    match create_contextbar_window_inner(app, -9999.0, -9999.0) {
        Ok(_) => eprintln!("[ContextBar] Pre-created window (hidden)"),
        Err(e) => eprintln!("[ContextBar] Failed to pre-create window: {}", e),
    }
}

fn create_contextbar_window(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
    create_contextbar_window_inner(app, x, y)?;

    // Show after a brief delay for WebView to load (first-time only fallback)
    if let Some(win) = app.get_webview_window("contextbar") {
        let win_clone = win.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            let _ = win_clone.show();
            let _ = win_clone.set_focus();
        });
    }
    Ok(())
}

fn create_contextbar_window_inner(app: &AppHandle, x: f64, y: f64) -> Result<(), String> {
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

    // Hide on blur
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
// Context gathering — optimized two-phase
// ---------------------------------------------------------------------------

/// Gather all context (AX + Cmd+C fallback). Blocking — used by external callers.
pub fn gather_context() -> serde_json::Value {
    let (ctx, needs_cmdc) = gather_context_fast();
    if !needs_cmdc {
        return ctx;
    }
    let capture = start_cmdc_capture();
    if let Some(text) = capture.finish() {
        let mut map: serde_json::Map<String, serde_json::Value> =
            if let serde_json::Value::Object(m) = ctx { m } else { serde_json::Map::new() };
        map.insert("selectedText".into(), serde_json::json!(text));
        return serde_json::Value::Object(map);
    }
    ctx
}

/// Phase 1: Fast AX context. Returns (json, needs_cmdc).
fn gather_context_fast() -> (serde_json::Value, bool) {
    let mut ctx = serde_json::Map::new();

    #[cfg(target_os = "macos")]
    {
        if !crate::accessibility::is_trusted() {
            eprintln!("[ContextBar] ⚠ Accessibility not trusted");
            crate::accessibility::open_accessibility_settings();
            return (serde_json::Value::Object(ctx), false);
        }

        // Try AX immediately, then retry once with a brief delay if it fails.
        // Some setups need a moment for AX to settle after the global shortcut fires.
        let pid: Option<i32>;
        match crate::accessibility::get_frontmost_app() {
            Ok(app_info) => {
                pid = app_info.get("pid").and_then(|v| v.as_i64()).map(|p| p as i32);
                eprintln!("[ContextBar] frontmost: {} (pid={:?})",
                    app_info.get("name").and_then(|n| n.as_str()).unwrap_or("?"), pid);
                ctx.insert("app".into(), app_info);
            }
            Err(_) => {
                // Retry once after 30ms
                std::thread::sleep(std::time::Duration::from_millis(30));
                match crate::accessibility::get_frontmost_app() {
                    Ok(app_info) => {
                        pid = app_info.get("pid").and_then(|v| v.as_i64()).map(|p| p as i32);
                        eprintln!("[ContextBar] frontmost (retry): {} (pid={:?})",
                            app_info.get("name").and_then(|n| n.as_str()).unwrap_or("?"), pid);
                        ctx.insert("app".into(), app_info);
                    }
                    Err(e) => {
                        eprintln!("[ContextBar] frontmost app failed: {}", e);
                        pid = None;
                    }
                }
            }
        }

        if let Some(p) = pid {
            if let Some(text) = crate::accessibility::get_selected_text_for_pid(p) {
                eprintln!("[ContextBar] ✓ text (AX): {} chars", text.len());
                ctx.insert("selectedText".into(), serde_json::json!(text));
                return (serde_json::Value::Object(ctx), false);
            }
            eprintln!("[ContextBar] AX text failed, need Cmd+C");
            return (serde_json::Value::Object(ctx), true);
        }

        return (serde_json::Value::Object(ctx), true);
    }

    #[cfg(not(target_os = "macos"))]
    (serde_json::Value::Object(ctx), false)
}

/// Start Cmd+C capture using native clipboard API (no subprocess).
#[cfg(target_os = "macos")]
fn start_cmdc_capture() -> CmdCCapture {
    let old_clipboard = clipboard_native::read();

    // Set sentinel to detect if Cmd+C actually copied
    let sentinel = "__agentx_empty__";
    clipboard_native::write(sentinel);

    eprintln!("[ContextBar] Posting Cmd+C...");
    let key_posted = crate::translate::simulate_key_with_cmd(0x08).is_ok();

    CmdCCapture {
        old_clipboard,
        sentinel: sentinel.to_string(),
        key_posted,
    }
}

#[cfg(not(target_os = "macos"))]
fn start_cmdc_capture() -> CmdCCapture {
    CmdCCapture {
        old_clipboard: String::new(),
        sentinel: String::new(),
        key_posted: false,
    }
}

struct CmdCCapture {
    old_clipboard: String,
    sentinel: String,
    key_posted: bool,
}

impl CmdCCapture {
    fn finish(self) -> Option<String> {
        if !self.key_posted {
            self.restore_clipboard();
            return None;
        }

        // Poll clipboard quickly — native read is ~0.1ms vs ~10ms for pbpaste
        for attempt in 0..6 {
            std::thread::sleep(std::time::Duration::from_millis(if attempt == 0 { 80 } else { 50 }));

            #[cfg(target_os = "macos")]
            let text = clipboard_native::read();
            #[cfg(not(target_os = "macos"))]
            let text = String::new();

            let trimmed = text.trim().to_string();

            if !trimmed.is_empty() && trimmed != self.sentinel {
                eprintln!("[ContextBar] ✓ Cmd+C text on attempt {}: {} chars", attempt + 1, trimmed.len());
                self.restore_clipboard();
                return Some(trimmed);
            }
        }

        eprintln!("[ContextBar] ✗ Cmd+C capture failed");
        self.restore_clipboard();
        None
    }

    fn restore_clipboard(&self) {
        #[cfg(target_os = "macos")]
        {
            let old = self.old_clipboard.clone();
            std::thread::spawn(move || {
                clipboard_native::write(&old);
            });
        }
    }
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
                let t0 = std::time::Instant::now();
                eprintln!("[ContextBar] Option+S pressed");

                let (cursor_x, cursor_y) = crate::translate::get_cursor_position();
                let x = cursor_x - 40.0;
                let y = cursor_y + 10.0;
                let h = handle.clone();

                std::thread::spawn(move || {
                    // ── Phase 1: AX context (fast — 0ms or 30ms if retry needed) ──
                    let (context, needs_cmdc) = gather_context_fast();
                    let context_str = serde_json::to_string(&context).unwrap_or_default();
                    eprintln!("[ContextBar] phase1 done in {:?}, cmdc={}", t0.elapsed(), needs_cmdc);

                    if !needs_cmdc {
                        // AX got everything — show immediately
                        send_context_to_window(&h, &context_str);
                        let _ = show_contextbar_no_focus(&h, x, y);
                        focus_contextbar(&h);
                        eprintln!("[ContextBar] done (AX) in {:?}", t0.elapsed());
                        return;
                    }

                    // ── Phase 2: Post Cmd+C key (original app still has focus) ──
                    let capture = start_cmdc_capture();
                    eprintln!("[ContextBar] Cmd+C posted in {:?}", t0.elapsed());

                    // ── Phase 3: Show window now (key event already delivered) ──
                    send_context_to_window(&h, &context_str);
                    let _ = show_contextbar_no_focus(&h, x, y);
                    focus_contextbar(&h);
                    eprintln!("[ContextBar] window shown in {:?}", t0.elapsed());

                    // ── Phase 4: Wait clipboard, update window ──
                    if let Some(text) = capture.finish() {
                        eprintln!("[ContextBar] text received in {:?}", t0.elapsed());
                        let mut updated: serde_json::Map<String, serde_json::Value> =
                            serde_json::from_str(&context_str).unwrap_or_default();
                        updated.insert("selectedText".into(), serde_json::json!(text));
                        let s = serde_json::to_string(&serde_json::Value::Object(updated))
                            .unwrap_or_default();
                        send_context_to_window(&h, &s);
                    }
                    eprintln!("[ContextBar] done (Cmd+C) in {:?}", t0.elapsed());
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
    show_contextbar_no_focus(app, x, y)?;
    focus_contextbar(app);
    Ok(())
}
