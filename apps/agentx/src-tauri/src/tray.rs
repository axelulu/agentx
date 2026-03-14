use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter,
};

use crate::window::show_and_focus;

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show AgentX", true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let new_conversation =
        MenuItem::with_id(app, "new_conversation", "New Conversation", true, Some("CmdOrCtrl+N"))?;
    let search = MenuItem::with_id(app, "search", "Search", true, Some("CmdOrCtrl+K"))?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let settings =
        MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;
    let separator3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit AgentX", true, Some("CmdOrCtrl+Q"))?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &separator1,
            &new_conversation,
            &search,
            &separator2,
            &settings,
            &separator3,
            &quit,
        ],
    )?;

    let icon = Image::from_path("icons/icon.png").unwrap_or_else(|_| {
        // Fallback: try resource path
        Image::from_bytes(include_bytes!("../icons/icon.png")).unwrap_or_else(|_| {
            // Create a minimal 1x1 PNG
            Image::new(&[0, 0, 0, 255], 1, 1)
        })
    });

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("AgentX")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "show" => {
                show_and_focus(app);
            }
            "new_conversation" => {
                show_and_focus(app);
                let _ = app.emit("shortcut:new-conversation", ());
            }
            "search" => {
                show_and_focus(app);
                let _ = app.emit("shortcut:search", ());
            }
            "settings" => {
                show_and_focus(app);
                let _ = app.emit("shortcut:settings", ());
            }
            "quit" => {
                // Emit quit request — frontend will show confirmation dialog
                let _ = app.emit("app:quit-requested", ());
                // For now, just quit directly
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray_icon, event| {
            use tauri::tray::TrayIconEvent;
            if let TrayIconEvent::DoubleClick { .. } = event {
                show_and_focus(tray_icon.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}
