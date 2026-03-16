mod commands;
mod sidecar;
mod tray;
mod menu;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(sidecar::SidecarState::default())
        .setup(|app| {
            // Set up tray
            tray::create_tray(app.handle())?;

            // Set up menu
            menu::create_menu(app.handle())?;

            // Spawn sidecar process
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = sidecar::spawn_sidecar(&handle).await {
                    eprintln!("[Sidecar] Failed to spawn: {}", e);
                }
            });

            // Register global shortcut (Alt+Space)
            window::register_global_shortcut(app.handle())?;

            // Set up window event handling and show when ready
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    window::handle_window_event(&win_clone, event);
                });

                // Show the window
                let _ = win.show();
                let _ = win.set_focus();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Sidecar pass-through commands
            commands::conversation_create,
            commands::conversation_list,
            commands::conversation_delete,
            commands::conversation_messages,
            commands::conversation_update_title,
            commands::conversation_search,
            commands::conversation_get_system_prompt,
            commands::conversation_set_system_prompt,
            commands::conversation_set_folder,
            commands::conversation_set_favorite,
            commands::conversation_branch_info,
            commands::conversation_switch_branch,
            commands::agent_send,
            commands::agent_regenerate,
            commands::agent_abort,
            commands::agent_subscribe,
            commands::agent_unsubscribe,
            commands::agent_status,
            commands::agent_running_conversations,
            commands::provider_list,
            commands::provider_set,
            commands::provider_remove,
            commands::provider_set_active,
            commands::kb_list,
            commands::kb_set,
            commands::kb_remove,
            commands::skills_search,
            commands::skills_list_installed,
            commands::skills_install,
            commands::skills_uninstall,
            commands::skills_get_enabled,
            commands::skills_set_enabled,
            commands::mcp_list,
            commands::mcp_set,
            commands::mcp_remove,
            commands::mcp_status,
            commands::mcp_reconnect,
            commands::scheduler_list,
            commands::scheduler_set,
            commands::scheduler_remove,
            commands::scheduler_run_now,
            commands::memory_get_config,
            commands::memory_set_config,
            commands::memory_get_summaries,
            commands::memory_delete_summary,
            commands::memory_get_facts,
            commands::memory_delete_fact,
            commands::memory_update_fact,
            commands::tool_permissions_get,
            commands::tool_permissions_set,
            commands::tool_respond_approval,
            commands::preferences_get,
            commands::preferences_set,
            commands::proxy_apply,
            commands::voice_transcribe,
            commands::screen_capture,
            commands::notifications_config,
            // Native commands (not sidecar pass-through)
            commands::fs_read_file,
            commands::fs_write_file,
            commands::fs_write_file_binary,
            commands::fs_read_file_base64,
            commands::fs_stat,
            commands::fs_select_file,
            commands::fs_select_directory,
            commands::fs_open_path,
            commands::fs_show_item_in_folder,
            commands::fs_show_save_dialog,
            commands::export_print_to_pdf,
            commands::permissions_check_all,
            commands::permissions_check,
            commands::permissions_request,
            commands::permissions_open_settings,
            commands::permissions_reset,
            commands::updater_check,
            commands::updater_install,
            commands::updater_restart,
            // Window commands
            commands::window_minimize,
            commands::window_maximize,
            commands::window_close,
            commands::window_show,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
