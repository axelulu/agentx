use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const WIN_WIDTH: f64 = 400.0;
const WIN_HEIGHT: f64 = 520.0;

/// Shared flag: when true, blur-to-hide is suppressed (tray click in progress).
pub struct QuickChatState {
    suppress_blur: Arc<AtomicBool>,
}

fn compute_position(click_x: f64, click_y: f64) -> (f64, f64) {
    let x = (click_x - WIN_WIDTH / 2.0).max(8.0);
    let y = click_y + 8.0;
    (x, y)
}

pub fn toggle_quickchat_window(
    app: &AppHandle,
    click_x: f64,
    click_y: f64,
) -> Result<(), String> {
    let (x, y) = compute_position(click_x, click_y);

    // Get or create the shared suppress flag.
    // ALWAYS set it to true on every tray click, then clear after 500ms.
    // This prevents the blur handler (which fires BEFORE this function on macOS)
    // from hiding the window during a tray-triggered focus change.
    let suppress = if let Some(state) = app.try_state::<QuickChatState>() {
        state.suppress_blur.clone()
    } else {
        let flag = Arc::new(AtomicBool::new(false));
        app.manage(QuickChatState {
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

    if let Some(win) = app.get_webview_window("quickchat") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
                x as i32, y as i32,
            )));
            let _ = win.show();
            let w = win.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                let _ = w.set_focus();
            });
        }
        return Ok(());
    }

    // --- First creation ---
    let url = WebviewUrl::App("/quickchat.html".into());

    let win = WebviewWindowBuilder::new(app, "quickchat", url)
        .title("Quick Chat")
        .inner_size(WIN_WIDTH, WIN_HEIGHT)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create quickchat window: {}", e))?;

    let win_clone = win.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        let _ = win_clone.show();
        let _ = win_clone.set_focus();
        let _ = win_clone.emit("quickchat:ready", ());
    });

    // Blur handler: wait 300ms, then check if suppress flag is set.
    // If tray was clicked, suppress will be true (it stays true for 500ms).
    // If user clicked elsewhere, suppress will be false → hide the window.
    let win_for_blur = win.clone();
    let suppress_for_blur = suppress;
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let w = win_for_blur.clone();
            let s = suppress_for_blur.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                if s.load(Ordering::SeqCst) {
                    return; // tray click in progress — don't hide
                }
                if !w.is_focused().unwrap_or(true) {
                    let _ = w.hide();
                }
            });
        }
    });

    Ok(())
}
