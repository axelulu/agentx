use tauri::{AppHandle, Manager, WebviewWindow, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Register global shortcut Alt+Space to show/focus the main window.
pub fn register_global_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut: Shortcut = "Alt+Space".parse()?;
    let handle = app.clone();
    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            show_and_focus(&handle);
        }
    })?;

    Ok(())
}

/// Show and focus the main window.
pub fn show_and_focus(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.unminimize();
    }
}

/// Handle window events — hide to tray on close.
pub fn handle_window_event(win: &WebviewWindow, event: &WindowEvent) {
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            // Prevent close — hide to tray instead
            api.prevent_close();
            let _ = win.hide();
        }
        _ => {}
    }
}
