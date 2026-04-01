use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const WIN_WIDTH: f64 = 360.0;
const WIN_HEIGHT: f64 = 520.0;

/// Shared state for the menu bar panel.
pub struct MenuBarState {
    suppress_blur: Arc<AtomicBool>,
}

fn compute_position(click_x: f64, click_y: f64) -> (f64, f64) {
    let x = (click_x - WIN_WIDTH / 2.0).max(8.0);
    let y = click_y + 4.0;
    (x, y)
}

/// Pre-create the menubar Tauri window so it's ready before the user clicks
/// the tray icon.  Avoids the main-window flash caused by `build()` activating
/// the app on first use.  Called from app setup (lib.rs).
pub fn precreate_menubar_window(app: &AppHandle) {
    if app.get_webview_window("menubar").is_some() {
        return; // already exists
    }
    let url = WebviewUrl::App("/menubar.html".into());
    let win = match WebviewWindowBuilder::new(app, "menubar", url)
        .title("AgentX")
        .inner_size(WIN_WIDTH, WIN_HEIGHT)
        .position(0.0, 0.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .build()
    {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[MenuBar] Failed to pre-create window: {e}");
            return;
        }
    };

    // Apply vibrancy once the webview has loaded
    let win_clone = win.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        #[cfg(target_os = "macos")]
        crate::vibrancy::apply_popup_vibrancy(&win_clone);
        let _ = win_clone.emit("menubar:ready", ());
    });

    // Blur handler
    let suppress = if let Some(state) = app.try_state::<MenuBarState>() {
        state.suppress_blur.clone()
    } else {
        let flag = Arc::new(AtomicBool::new(false));
        app.manage(MenuBarState {
            suppress_blur: flag.clone(),
        });
        flag
    };

    let win_for_blur = win.clone();
    let suppress_for_blur = suppress;
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let w = win_for_blur.clone();
            let s = suppress_for_blur.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                if s.load(Ordering::SeqCst) {
                    return;
                }
                if !w.is_focused().unwrap_or(true) {
                    let _ = w.hide();
                }
            });
        }
    });
}

pub fn toggle_menubar_panel(
    app: &AppHandle,
    click_x: f64,
    click_y: f64,
) -> Result<(), String> {
    let (x, y) = compute_position(click_x, click_y);

    // Same suppress-blur pattern as quickchat
    let suppress = if let Some(state) = app.try_state::<MenuBarState>() {
        state.suppress_blur.clone()
    } else {
        let flag = Arc::new(AtomicBool::new(false));
        app.manage(MenuBarState {
            suppress_blur: flag.clone(),
        });
        flag
    };

    suppress.store(true, Ordering::SeqCst);
    let suppress_reset = suppress.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        suppress_reset.store(false, Ordering::SeqCst);
    });

    if let Some(win) = app.get_webview_window("menubar") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                x as i32, y as i32,
            )));
            let _ = win.show();
            let _ = win.emit("menubar:refresh", ());
            let w = win.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                let _ = w.set_focus();
            });
        }
        return Ok(());
    }

    // Fallback — window wasn't pre-created (should rarely happen)
    precreate_menubar_window(app);
    let handle = app.clone();
    let handle2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        let _ = handle.run_on_main_thread(move || {
            if let Some(win) = handle2.get_webview_window("menubar") {
                let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                    x as i32, y as i32,
                )));
                let _ = win.show();
                let _ = win.set_focus();
                let _ = win.emit("menubar:refresh", ());
            }
        });
    });

    Ok(())
}
