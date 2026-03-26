use tauri::{image::Image, tray::TrayIconBuilder, AppHandle};

use crate::quickchat;

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon = Image::from_path("icons/tray-icon.png").unwrap_or_else(|_| {
        Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap_or_else(|_| {
            Image::new(&[0, 0, 0, 255], 1, 1)
        })
    });

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("AgentX")
        .on_tray_icon_event(|tray_icon, event| {
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
            match event {
                TrayIconEvent::Click {
                    button,
                    button_state,
                    position,
                    ..
                } => {
                    // Only act on mouseUp to avoid firing twice (down + up)
                    if button == MouseButton::Left && button_state == MouseButtonState::Up {
                        if let Err(e) = quickchat::toggle_quickchat_window(
                            tray_icon.app_handle(),
                            position.x,
                            position.y,
                        ) {
                            eprintln!("[QuickChat] Failed to toggle window: {}", e);
                        }
                    }
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
}
