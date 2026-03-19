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
        WindowEvent::Resized { .. } => {
            // macOS resets traffic light positions on resize
            #[cfg(target_os = "macos")]
            position_traffic_lights(win);
        }
        _ => {}
    }
}

/// Reposition macOS traffic light buttons (close/minimize/zoom) to align
/// with the sidebar toggle button.
#[cfg(target_os = "macos")]
pub fn position_traffic_lights(win: &WebviewWindow) {
    use objc2_app_kit::{NSWindow, NSWindowButton};
    use objc2_foundation::NSPoint;

    let Ok(ns_win_ptr) = win.ns_window() else {
        return;
    };
    let ns_window: &NSWindow = unsafe { &*(ns_win_ptr as *const NSWindow) };

    // Target: button center at 20px from window top (to match the toggle button)
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

            // Get the superview (title bar container) to calculate y in AppKit coords
            let Some(superview) = button.superview() else {
                continue;
            };
            let sv_frame = superview.frame();

            // AppKit y-axis goes upward from bottom
            let y = sv_frame.size.height - target_y_from_top - button_height / 2.0;
            let x = target_x + (i as f64) * 20.0;

            button.setFrameOrigin(NSPoint::new(x, y));
        }
    }
}
