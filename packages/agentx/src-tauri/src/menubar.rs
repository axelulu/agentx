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

    // --- First creation ---
    let url = WebviewUrl::App("/menubar.html".into());

    let win = WebviewWindowBuilder::new(app, "menubar", url)
        .title("AgentX")
        .inner_size(WIN_WIDTH, WIN_HEIGHT)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create menubar window: {}", e))?;

    let win_clone = win.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        let _ = win_clone.show();
        let _ = win_clone.set_focus();
        let _ = win_clone.emit("menubar:ready", ());
    });

    // Blur handler
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

    Ok(())
}
