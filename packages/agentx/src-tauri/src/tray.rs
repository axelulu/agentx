use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let icon = Image::from_path("icons/tray-icon.png").unwrap_or_else(|_| {
        Image::from_bytes(include_bytes!("../icons/tray-icon.png")).unwrap_or_else(|_| {
            Image::new(&[0, 0, 0, 255], 1, 1)
        })
    });

    let new_conv = MenuItem::with_id(app, "tray_new_conversation", "New Conversation", true, None::<&str>)?;
    let search = MenuItem::with_id(app, "tray_search", "Search", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let settings = MenuItem::with_id(app, "tray_settings", "Settings", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "tray_quit", "Quit AgentX", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&new_conv, &search, &sep1, &settings, &sep2, &quit])?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("AgentX")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref().to_string();
            let handle = app.clone();

            let _ = app.run_on_main_thread(move || {
                match id.as_str() {
                    "tray_new_conversation" => {
                        show_main_and_emit(&handle, "shortcut:new-conversation");
                    }
                    "tray_search" => {
                        let h = handle.clone();
                        if let Err(e) = crate::quickchat::show_quickchat_mode(&h, "conv-search") {
                            eprintln!("[Tray] Failed to show search: {}", e);
                        }
                    }
                    "tray_settings" => {
                        show_main_and_emit(&handle, "shortcut:settings");
                    }
                    "tray_quit" => {
                        let _ = handle.emit("app:quit-requested", ());
                    }
                    _ => {}
                }
            });
        })
        .build(app)?;

    Ok(())
}

/// Replicates the `window_show_and_emit` command logic:
/// emit BEFORE show (so React state updates before window appears),
/// then show + focus.
fn show_main_and_emit(app: &AppHandle, event: &str) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.emit(event, ());
        let js = format!(
            "window.__QUICKCHAT_ACTION__ && window.__QUICKCHAT_ACTION__('{}')",
            event
        );
        let _ = win.eval(&js);
        let _ = win.show();
        let _ = win.set_focus();
    }
}
