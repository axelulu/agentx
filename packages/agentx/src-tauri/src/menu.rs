use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter,
};

pub fn create_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // File menu
    let new_conv = MenuItem::with_id(
        app,
        "menu_new_conversation",
        "New Conversation",
        true,
        Some("CmdOrCtrl+N"),
    )?;
    let search = MenuItem::with_id(app, "menu_search", "Search", true, Some("CmdOrCtrl+K"))?;
    let separator = PredefinedMenuItem::separator(app)?;
    let settings = MenuItem::with_id(
        app,
        "menu_settings",
        "Settings",
        true,
        Some("CmdOrCtrl+,"),
    )?;

    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[&new_conv, &search, &separator, &settings],
    )?;

    // Edit menu
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[&undo, &redo, &separator2, &cut, &copy, &paste, &select_all],
    )?;

    // View menu
    let fullscreen = PredefinedMenuItem::fullscreen(app, None)?;
    let view_menu = Submenu::with_items(app, "View", true, &[&fullscreen])?;

    // Window menu
    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let window_menu = Submenu::with_items(app, "Window", true, &[&minimize])?;

    #[cfg(target_os = "macos")]
    {
        let about = PredefinedMenuItem::about(app, Some("About AgentX"), None)?;
        let sep_a = PredefinedMenuItem::separator(app)?;
        let services = PredefinedMenuItem::services(app, None)?;
        let sep_b = PredefinedMenuItem::separator(app)?;
        let hide = PredefinedMenuItem::hide(app, None)?;
        let hide_others = PredefinedMenuItem::hide_others(app, None)?;
        let show_all = PredefinedMenuItem::show_all(app, None)?;
        let sep_c = PredefinedMenuItem::separator(app)?;
        let quit =
            MenuItem::with_id(app, "menu_quit", "Quit AgentX", true, Some("CmdOrCtrl+Q"))?;

        let app_menu = Submenu::with_items(
            app,
            "AgentX",
            true,
            &[
                &about,
                &sep_a,
                &services,
                &sep_b,
                &hide,
                &hide_others,
                &show_all,
                &sep_c,
                &quit,
            ],
        )?;

        let menu = Menu::with_items(
            app,
            &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu],
        )?;
        app.set_menu(menu)?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let menu = Menu::with_items(
            app,
            &[&file_menu, &edit_menu, &view_menu, &window_menu],
        )?;
        app.set_menu(menu)?;
    }

    // Handle menu events
    let handle = app.clone();
    app.on_menu_event(move |_app, event| match event.id().as_ref() {
        "menu_new_conversation" => {
            let _ = handle.emit("shortcut:new-conversation", ());
        }
        "menu_search" => {
            let _ = handle.emit("shortcut:search", ());
        }
        "menu_settings" => {
            let _ = handle.emit("shortcut:settings", ());
        }
        "menu_quit" => {
            handle.exit(0);
        }
        _ => {}
    });

    Ok(())
}
