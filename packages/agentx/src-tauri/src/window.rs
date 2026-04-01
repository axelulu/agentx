use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::quickchat;

const DEFAULT_PALETTE_SHORTCUT: &str = "Ctrl+Space";

// ---------------------------------------------------------------------------
// Default shortcut keys for all features
// ---------------------------------------------------------------------------

pub const DEFAULT_SHORTCUTS: &[(&str, &str, &str)] = &[
    ("command-palette", "Ctrl+Space", "Command Palette"),
    ("translate", "Option+D", "Translate"),
    ("clipboard", "Option+Cmd+A", "Clipboard Pipeline"),
    ("ocr", "Option+O", "OCR"),
    ("contextbar", "Option+S", "Context Bar"),
];

/// Get the default shortcut for a given id.
pub fn default_shortcut_for(id: &str) -> Option<&'static str> {
    DEFAULT_SHORTCUTS
        .iter()
        .find(|(i, _, _)| *i == id)
        .map(|(_, key, _)| *key)
}

// ---------------------------------------------------------------------------
// Managed state — tracks all registered global shortcuts
// ---------------------------------------------------------------------------

pub struct PaletteShortcutState {
    pub current: Mutex<Option<String>>,
}

impl Default for PaletteShortcutState {
    fn default() -> Self {
        Self {
            current: Mutex::new(None),
        }
    }
}

/// Tracks all non-palette shortcuts (translate, clipboard, ocr, contextbar).
pub struct GlobalShortcutRegistry {
    /// Maps shortcut id → currently registered key string
    pub map: Mutex<HashMap<String, String>>,
}

impl Default for GlobalShortcutRegistry {
    fn default() -> Self {
        Self {
            map: Mutex::new(HashMap::new()),
        }
    }
}

// ---------------------------------------------------------------------------
// Public helpers called from lib.rs setup
// ---------------------------------------------------------------------------

pub fn register_palette_shortcut(
    app: &AppHandle,
    shortcut_str: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let key = shortcut_str.unwrap_or(DEFAULT_PALETTE_SHORTCUT);
    let shortcut: Shortcut = key.parse()?;
    let handle = app.clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let h = handle.clone();
                let _ = handle.run_on_main_thread(move || {
                    toggle_command_palette(&h);
                });
            }
        })?;

    if let Some(state) = app.try_state::<PaletteShortcutState>() {
        *state.current.lock().unwrap() = Some(key.to_string());
    } else {
        app.manage(PaletteShortcutState {
            current: Mutex::new(Some(key.to_string())),
        });
    }

    Ok(())
}

/// Register a global shortcut and store it in the registry.
#[allow(dead_code)]
pub fn register_global_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // This is called for the default palette shortcut
    register_palette_shortcut(app, None)
}

/// Store a shortcut in the registry (called after registering in translate/clipboard/ocr/contextbar modules).
pub fn registry_set(app: &AppHandle, id: &str, key: &str) {
    if let Some(reg) = app.try_state::<GlobalShortcutRegistry>() {
        reg.map.lock().unwrap().insert(id.to_string(), key.to_string());
    }
}

/// Get current key for a shortcut id from the registry.
pub fn registry_get(app: &AppHandle, id: &str) -> Option<String> {
    // palette shortcut is tracked separately
    if id == "command-palette" {
        return app
            .try_state::<PaletteShortcutState>()
            .and_then(|s| s.current.lock().unwrap().clone());
    }
    app.try_state::<GlobalShortcutRegistry>()
        .and_then(|reg| reg.map.lock().unwrap().get(id).cloned())
}

// ---------------------------------------------------------------------------
// Tauri commands for shortcut management
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn shortcut_get_palette(app: AppHandle) -> String {
    app.try_state::<PaletteShortcutState>()
        .and_then(|s| s.current.lock().unwrap().clone())
        .unwrap_or_else(|| DEFAULT_PALETTE_SHORTCUT.to_string())
}

#[tauri::command]
pub fn shortcut_check(app: AppHandle, shortcut: String) -> Result<bool, String> {
    if shortcut.starts_with("DoubleTap:") {
        return Ok(crate::doubletap::is_registered(&shortcut));
    }
    let parsed: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Invalid shortcut: {}", e))?;
    Ok(app.global_shortcut().is_registered(parsed))
}

/// Change the command-palette shortcut. Unregisters the old one first.
#[tauri::command]
pub fn shortcut_set_palette(app: AppHandle, shortcut: String) -> Result<(), String> {
    // --- DoubleTap path ---
    if shortcut.starts_with("DoubleTap:") {
        crate::doubletap::validate(&shortcut)?;

        // Unregister old palette shortcut (standard or doubletap)
        if let Some(state) = app.try_state::<PaletteShortcutState>() {
            if let Some(old_key) = state.current.lock().unwrap().take() {
                if old_key.starts_with("DoubleTap:") {
                    crate::doubletap::unregister("command-palette");
                } else if let Ok(old) = old_key.parse::<Shortcut>() {
                    let _ = app.global_shortcut().unregister(old);
                }
            }
        }

        crate::doubletap::register(&app, "command-palette", &shortcut)?;

        if let Some(state) = app.try_state::<PaletteShortcutState>() {
            *state.current.lock().unwrap() = Some(shortcut);
        }
        return Ok(());
    }

    // --- Standard shortcut path ---
    let new_shortcut: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Invalid shortcut format: {}", e))?;

    if app.global_shortcut().is_registered(new_shortcut) {
        let is_self = app
            .try_state::<PaletteShortcutState>()
            .and_then(|s| s.current.lock().unwrap().clone())
            .map(|cur| cur == shortcut)
            .unwrap_or(false);
        if !is_self {
            return Err(format!(
                "Shortcut {} is already in use by another function",
                shortcut
            ));
        }
    }

    // Unregister old palette shortcut (standard or doubletap)
    if let Some(state) = app.try_state::<PaletteShortcutState>() {
        if let Some(old_key) = state.current.lock().unwrap().take() {
            if old_key.starts_with("DoubleTap:") {
                crate::doubletap::unregister("command-palette");
            } else if let Ok(old) = old_key.parse::<Shortcut>() {
                let _ = app.global_shortcut().unregister(old);
            }
        }
    }

    register_palette_shortcut(&app, Some(&shortcut))
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;

    Ok(())
}

/// List all registered global shortcuts with their current key and label.
#[tauri::command]
pub fn shortcut_list_all(app: AppHandle) -> Vec<serde_json::Value> {
    DEFAULT_SHORTCUTS
        .iter()
        .map(|(id, default_key, label)| {
            let current_key = if *id == "command-palette" {
                app.try_state::<PaletteShortcutState>()
                    .and_then(|s| s.current.lock().unwrap().clone())
                    .unwrap_or_else(|| default_key.to_string())
            } else {
                registry_get(&app, id).unwrap_or_else(|| default_key.to_string())
            };
            serde_json::json!({
                "id": id,
                "shortcut": current_key,
                "defaultShortcut": default_key,
                "label": label,
            })
        })
        .collect()
}

/// Change any shortcut by id. Unregisters the old one, registers the new one with the correct handler.
#[tauri::command]
pub fn shortcut_set(app: AppHandle, id: String, shortcut: String) -> Result<(), String> {
    // --- DoubleTap path ---
    if shortcut.starts_with("DoubleTap:") {
        crate::doubletap::validate(&shortcut)?;

        // Check conflicts
        if crate::doubletap::is_registered(&shortcut) {
            let current = registry_get(&app, &id);
            if current.as_deref() != Some(shortcut.as_str()) {
                if let Some(owner) = crate::doubletap::find_owner(&shortcut) {
                    return Err(format!("Shortcut {} is already used by {}", shortcut, owner));
                }
                return Err(format!("Shortcut {} is already in use", shortcut));
            }
            return Ok(());
        }

        // Special case: command-palette
        if id == "command-palette" {
            return shortcut_set_palette(app, shortcut);
        }

        // Unregister old shortcut (standard or doubletap)
        unregister_old_shortcut(&app, &id);

        // Register double-tap
        crate::doubletap::register(&app, &id, &shortcut)?;
        registry_set(&app, &id, &shortcut);
        return Ok(());
    }

    // --- Standard shortcut path ---
    let new_sc: Shortcut = shortcut
        .parse()
        .map_err(|e| format!("Invalid shortcut format: {}", e))?;

    // Check for conflicts (ignore if it's the same shortcut we already own)
    if app.global_shortcut().is_registered(new_sc) {
        let current = registry_get(&app, &id);
        let is_self = current.as_deref() == Some(shortcut.as_str());
        if !is_self {
            if let Some(owner) = find_shortcut_owner(&app, &shortcut) {
                return Err(format!("Shortcut {} is already used by {}", shortcut, owner));
            }
            return Err(format!("Shortcut {} is already in use", shortcut));
        }
        // Already set to this value — no-op
        return Ok(());
    }

    // Special case: command-palette uses its own path
    if id == "command-palette" {
        return shortcut_set_palette(app, shortcut);
    }

    // Unregister old shortcut (standard or doubletap)
    unregister_old_shortcut(&app, &id);

    // Register new shortcut with the correct handler
    let handle = app.clone();
    let feature_id = id.clone();
    app.global_shortcut()
        .on_shortcut(new_sc, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                dispatch_shortcut_action(&handle, &feature_id);
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))?;

    // Update registry
    registry_set(&app, &id, &shortcut);

    Ok(())
}

/// Unregister the old shortcut for an id, whether it was standard or DoubleTap.
fn unregister_old_shortcut(app: &AppHandle, id: &str) {
    if let Some(old_key) = registry_get(app, id) {
        if old_key.starts_with("DoubleTap:") {
            crate::doubletap::unregister(id);
        } else if let Ok(old) = old_key.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(old);
        }
    }
}

/// Dispatch the correct action for a shortcut id.
/// Global shortcut callbacks fire on a background thread, so we always
/// bounce to the main thread to ensure AppKit calls are safe.
pub fn dispatch_shortcut_action(app: &AppHandle, id: &str) {
    let handle = app.clone();
    let id = id.to_string();
    let _ = app.run_on_main_thread(move || {
        let app = handle;
        match id.as_str() {
            "command-palette" => {
                toggle_command_palette(&app);
            }
            "translate" => {
                match crate::translate::get_selected_text() {
                    Ok(text) => {
                        if let Err(e) = crate::translate::show_translator_window(&app, &text) {
                            eprintln!("[Translate] Failed to show window: {}", e);
                        }
                    }
                    Err(e) => eprintln!("[Translate] No text selected: {}", e),
                }
            }
            "clipboard" => {
                if let Err(e) = crate::quickchat::show_quickchat_mode(&app, "clipboard") {
                    eprintln!("[Clipboard] Failed to show quickchat clipboard mode: {}", e);
                }
            }
            "ocr" => {
                use tauri::Emitter;
                let _ = app.emit("ocr:trigger", ());
            }
            "contextbar" => {
                let (cursor_x, cursor_y) = crate::translate::get_cursor_position();
                let h = app.clone();
                // Gather context in background (captures app info + Cmd+C before showing window)
                std::thread::spawn(move || {
                    let context = crate::contextbar::gather_context();
                    let context_str = serde_json::to_string(&context).unwrap_or_default();
                    let _ = crate::contextbar::show_contextbar_at(&h, cursor_x, cursor_y, &context_str);
                });
            }
            _ => eprintln!("[Window] Unknown shortcut id: {}", id),
        }
    });
}

/// Validate a shortcut string (check if it can be parsed).
#[tauri::command]
pub fn shortcut_validate(shortcut: String) -> Result<bool, String> {
    if shortcut.starts_with("DoubleTap:") {
        return crate::doubletap::validate(&shortcut);
    }
    match shortcut.parse::<Shortcut>() {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("Invalid shortcut: {}", e)),
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Find which feature owns a given shortcut key string.
#[allow(dead_code)]
fn find_shortcut_owner(app: &AppHandle, shortcut: &str) -> Option<String> {
    // Check double-tap registry
    if shortcut.starts_with("DoubleTap:") {
        if let Some(owner_id) = crate::doubletap::find_owner(shortcut) {
            let label = DEFAULT_SHORTCUTS
                .iter()
                .find(|(i, _, _)| *i == owner_id.as_str())
                .map(|(_, _, l)| l.to_string())
                .unwrap_or(owner_id);
            return Some(label);
        }
        return None;
    }
    // Check palette
    if let Some(state) = app.try_state::<PaletteShortcutState>() {
        if state.current.lock().unwrap().as_deref() == Some(shortcut) {
            return Some("Command Palette".to_string());
        }
    }
    // Check registry
    if let Some(reg) = app.try_state::<GlobalShortcutRegistry>() {
        for (id, key) in reg.map.lock().unwrap().iter() {
            if key == shortcut {
                let label = DEFAULT_SHORTCUTS
                    .iter()
                    .find(|(i, _, _)| *i == id.as_str())
                    .map(|(_, _, l)| l.to_string())
                    .unwrap_or_else(|| id.clone());
                return Some(label);
            }
        }
    }
    None
}

fn toggle_command_palette(app: &AppHandle) {
    let (cx, cy) = get_palette_center();
    // toggle_quickchat_window expects the click point (center-x of window),
    // and places the window centered under it. Pass center coords directly.
    let _ = quickchat::toggle_quickchat_window(app, cx, cy);
}

/// Compute click coordinates so that `compute_position` in quickchat.rs
/// places the window at screen center.
/// quickchat::compute_position does: x = click_x - W/2, y = click_y + 8
/// So we pass: click_x = screen_center_x, click_y = screen_center_y - H/2 - 8
pub fn get_palette_center() -> (f64, f64) {
    const W: f64 = 680.0;
    const H: f64 = 480.0;
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSScreen;
        use objc2_foundation::MainThreadMarker;
        if let Some(mtm) = MainThreadMarker::new() {
            if let Some(screen) = NSScreen::mainScreen(mtm) {
                let frame = screen.frame();
                let cx = frame.size.width / 2.0;
                let cy = (frame.size.height - H) / 2.0 - 8.0;
                return (cx, cy);
            }
        }
    }
    let _ = (W, H); // suppress unused warning on non-mac
    (540.0, 200.0)
}

/// Like `get_palette_center` but safe to call from any thread.
/// Uses the main window's monitor info via Tauri API (thread-safe).
pub fn get_palette_center_async(app: &AppHandle) -> Result<(f64, f64), String> {
    const H: f64 = 480.0;
    if let Some(win) = app.get_webview_window("main") {
        if let Ok(Some(monitor)) = win.current_monitor() {
            let scale = monitor.scale_factor();
            let screen_pos = monitor.position();
            let screen_size = monitor.size();
            let sw = screen_size.width as f64 / scale;
            let sh = screen_size.height as f64 / scale;
            let sx = screen_pos.x as f64 / scale;
            let sy = screen_pos.y as f64 / scale;
            // Return coords that compute_position will transform to centered position
            // compute_position: x = click_x - W/2, y = click_y + 8
            let cx = sx + sw / 2.0;
            let cy = sy + (sh - H) / 2.0 - 8.0;
            return Ok((cx, cy));
        }
    }
    Ok((540.0, 200.0))
}

#[allow(dead_code)]
pub fn show_and_focus(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.unminimize();
    }
}

pub fn handle_window_event(win: &WebviewWindow, event: &WindowEvent) {
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = win.hide();
        }
        WindowEvent::Resized { .. } => {
            #[cfg(target_os = "macos")]
            position_traffic_lights(win);
        }
        _ => {}
    }
}

#[cfg(target_os = "macos")]
pub fn position_traffic_lights(win: &WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowButton};
    use objc2_foundation::NSPoint;

    let Ok(ns_win_ptr) = win.ns_window() else {
        return;
    };
    let ns_window: &NSWindow = unsafe { &*(ns_win_ptr as *const NSWindow) };

    let target_x = 12.0_f64;
    let target_y_from_top = 20.0_f64;

    let buttons = [
        NSWindowButton::CloseButton,
        NSWindowButton::MiniaturizeButton,
        NSWindowButton::ZoomButton,
    ];

    unsafe {
        for (i, button_type) in buttons.iter().enumerate() {
            let Some(button) = ns_window.standardWindowButton(*button_type) else {
                continue;
            };
            let frame = button.frame();
            let button_height = frame.size.height;
            let Some(superview) = button.superview() else {
                continue;
            };
            let sv_frame = superview.frame();
            let y = sv_frame.size.height - target_y_from_top - button_height / 2.0;
            let x = target_x + (i as f64) * 20.0;
            button.setFrameOrigin(NSPoint::new(x, y));
        }
    }
}
