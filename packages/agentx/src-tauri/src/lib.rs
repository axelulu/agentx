pub mod accessibility;
mod clipboard;
mod commands;
mod contextbar;
mod finder;
mod menubar;
mod ocr;
pub mod quickchat;
mod share;
mod shortcuts;
mod sidecar;
mod spotlight;
mod translate;
mod tray;
mod menu;
mod window;

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tauri::{Listener, Manager};

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
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_deep_link::init())
        .manage(sidecar::SidecarState::default())
        .manage(clipboard::ClipboardHistoryState::default())
        .manage(window::GlobalShortcutRegistry::default())
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

            // Listen for sidecar restart requests (max 3 retries to prevent infinite loop)
            let restart_handle = app.handle().clone();
            let restart_count = Arc::new(AtomicU32::new(0));
            app.listen("sidecar:restart", move |_| {
                let h = restart_handle.clone();
                let count = restart_count.clone();
                tauri::async_runtime::spawn(async move {
                    let attempts = count.fetch_add(1, Ordering::SeqCst);
                    if attempts >= 3 {
                        eprintln!("[Sidecar] Max restart attempts (3) reached, giving up");
                        return;
                    }
                    let delay = std::time::Duration::from_secs((attempts as u64 + 1) * 2);
                    eprintln!("[Sidecar] Restarting after crash (attempt {}/3, delay {:?})...", attempts + 1, delay);
                    tokio::time::sleep(delay).await;
                    if let Err(e) = sidecar::spawn_sidecar(&h).await {
                        eprintln!("[Sidecar] Restart failed: {}", e);
                    } else {
                        eprintln!("[Sidecar] Restarted successfully");
                        count.store(0, Ordering::SeqCst);
                    }
                });
            });

            // Listen for quit requests from frontend (e.g. QuickChat panel)
            let quit_handle = app.handle().clone();
            app.listen("app:quit-requested", move |_| {
                quit_handle.exit(0);
            });

            // ── Accessibility permission (critical for context bar, OCR, text capture) ──
            // Prompt on startup and keep polling in the background.  The app
            // continues to run regardless — features degrade gracefully and
            // re-prompt when triggered without permission.
            {
                let perm_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Small delay so the main window is visible before the prompt
                    tokio::time::sleep(std::time::Duration::from_millis(1200)).await;

                    #[cfg(target_os = "macos")]
                    {
                        if crate::accessibility::is_trusted() {
                            eprintln!("[Setup] Accessibility permission: granted ✓");
                            return;
                        }

                        eprintln!("[Setup] Accessibility NOT granted — prompting user...");

                        // Show the system prompt (non-blocking from tokio's perspective)
                        tokio::task::spawn_blocking(|| {
                            crate::accessibility::prompt_trust_on_main_thread();
                        })
                        .await
                        .ok();

                        // Poll in background — detect when user grants in Settings
                        use tauri::Emitter;
                        let handle = perm_handle.clone();
                        for i in 0..120 {
                            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            if crate::accessibility::is_trusted() {
                                eprintln!("[Setup] Accessibility permission: granted (detected at {}s) ✓", i + 1);
                                let _ = handle.emit("permissions:accessibility-changed", "granted");
                                return;
                            }
                        }
                        eprintln!("[Setup] Accessibility permission: not granted after 2min polling");
                    }
                });
            }

            // Register command palette shortcut (default: Ctrl+Space, customizable via preferences)
            // Preference is loaded asynchronously after sidecar starts;
            // for now register the default, it will be re-registered if user has a custom one.
            if let Err(e) = window::register_palette_shortcut(app.handle(), None) {
                eprintln!("[Window] Failed to register palette shortcut: {}", e);
            }

            // Async: load saved shortcut preferences from sidecar once it's ready
            {
                let shortcut_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    // Wait for sidecar to be ready
                    tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
                    if let Ok(prefs) = crate::commands::preferences_get_internal(&shortcut_handle).await {
                        // Load palette shortcut
                        if let Some(key) = prefs.get("commandPaletteShortcut").and_then(|v| v.as_str()) {
                            if !key.is_empty() {
                                if let Err(e) = window::shortcut_set_palette(shortcut_handle.clone(), key.to_string()) {
                                    eprintln!("[Window] Failed to restore custom shortcut '{}': {}", key, e);
                                }
                            }
                        }
                        // Load custom shortcuts for other features
                        if let Some(shortcuts) = prefs.get("shortcuts").and_then(|v| v.as_object()) {
                            for (id, val) in shortcuts {
                                if let Some(key) = val.as_str() {
                                    if !key.is_empty() && id != "command-palette" {
                                        if let Err(e) = window::shortcut_set(shortcut_handle.clone(), id.clone(), key.to_string()) {
                                            eprintln!("[Shortcuts] Failed to restore '{}' = '{}': {}", id, key, e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            }

            // Register translation shortcut (Option+D)
            if let Err(e) = translate::register_translate_shortcut(app.handle()) {
                eprintln!("[Translate] Failed to register shortcut: {}", e);
            }
            window::registry_set(app.handle(), "translate", "Option+D");

            // Register clipboard shortcut (Option+Cmd+A) — opens QuickChat in clipboard mode
            {
                use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
                let clip_shortcut: Shortcut = "Option+Cmd+A".parse().unwrap();
                let clip_handle = app.handle().clone();
                if let Err(e) = app.global_shortcut().on_shortcut(clip_shortcut, move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Err(e) = quickchat::show_quickchat_mode(&clip_handle, "clipboard") {
                            eprintln!("[Clipboard] Failed to show quickchat clipboard mode: {}", e);
                        }
                    }
                }) {
                    eprintln!("[Clipboard] Failed to register shortcut: {}", e);
                }
                window::registry_set(app.handle(), "clipboard", "Option+Cmd+A");
            }

            // Start clipboard history monitor
            clipboard::start_clipboard_monitor(app.handle());

            // Register OCR shortcut (Option+O)
            if let Err(e) = ocr::register_ocr_shortcut(app.handle()) {
                eprintln!("[OCR] Failed to register shortcut: {}", e);
            }
            window::registry_set(app.handle(), "ocr", "Option+O");

            // Register context bar shortcut (Option+S)
            if let Err(e) = contextbar::register_contextbar_shortcut(app.handle()) {
                eprintln!("[ContextBar] Failed to register shortcut: {}", e);
            }
            window::registry_set(app.handle(), "contextbar", "Option+S");

            // Pre-create context bar window (hidden) so the first Option+S
            // doesn't trigger app activation / desktop switch.
            {
                let cb_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(3000)).await;
                    contextbar::precreate_contextbar_window(&cb_handle);
                });
            }

            // Register deep link handler for agentx:// URLs (Shortcuts.app integration)
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                // In dev mode the app isn't installed so the Info.plist scheme
                // isn't picked up by LaunchServices — register it at runtime.
                if cfg!(debug_assertions) {
                    if let Err(e) = app.deep_link().register("agentx") {
                        eprintln!("[DeepLink] Failed to register agentx:// scheme: {}", e);
                    } else {
                        eprintln!("[DeepLink] Registered agentx:// scheme for dev mode");
                    }
                }

                let deep_link_handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event| {
                    if let Ok(urls) = serde_json::from_str::<Vec<String>>(event.payload()) {
                        for url in urls {
                            let h = deep_link_handle.clone();
                            tauri::async_runtime::spawn(async move {
                                shortcuts::handle_deep_link(&h, &url).await;
                            });
                        }
                    }
                });
            }

            // Check for pending Finder actions and Share Extension actions on startup
            let finder_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Small delay to let the frontend initialize
                tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                if let Some(action) = finder::consume_pending_action() {
                    use tauri::Emitter;
                    let _ = finder_handle.emit("finder:action", serde_json::to_value(&action).unwrap());
                }
                if let Some(action) = share::consume_pending_action() {
                    use tauri::Emitter;
                    let _ = finder_handle.emit("share:action", serde_json::to_value(&action).unwrap());
                }
            });

            // Set up window event handling and show when ready
            if let Some(win) = app.get_webview_window("main") {
                let win_clone = win.clone();
                let finder_app_handle = app.handle().clone();
                win.on_window_event(move |event| {
                    window::handle_window_event(&win_clone, event);
                    // Check for pending Finder/Share actions when window gains focus
                    if let tauri::WindowEvent::Focused(true) = event {
                        let h = finder_app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Some(action) = finder::consume_pending_action() {
                                use tauri::Emitter;
                                let _ = h.emit("finder:action", serde_json::to_value(&action).unwrap());
                            }
                            if let Some(action) = share::consume_pending_action() {
                                use tauri::Emitter;
                                let _ = h.emit("share:action", serde_json::to_value(&action).unwrap());
                            }
                        });
                    }
                });

                // Show the window
                let _ = win.show();
                let _ = win.set_focus();

                // Position macOS traffic lights to align with sidebar toggle
                #[cfg(target_os = "macos")]
                window::position_traffic_lights(&win);
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
            commands::channel_list,
            commands::channel_set,
            commands::channel_remove,
            commands::channel_status,
            commands::channel_start,
            commands::channel_stop,
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
            // Notification Intelligence commands
            commands::ni_get_config,
            commands::ni_set_config,
            commands::ni_fetch,
            commands::ni_classify,
            commands::ni_start,
            commands::ni_stop,
            commands::ni_mark_read,
            commands::ni_open_app,
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
            commands::window_show_and_emit,
            commands::quickchat_open_mode,
            // Translate commands
            commands::translate_run,
            commands::translate_get_selected_text,
            // OCR commands
            commands::ocr_recognize,
            // Clipboard commands
            commands::clipboard_process,
            commands::clipboard_write,
            commands::clipboard_read,
            commands::clipboard_history_list,
            commands::clipboard_history_search,
            commands::clipboard_history_delete,
            commands::clipboard_history_clear,
            commands::clipboard_history_toggle_pin,
            commands::clipboard_history_toggle_favorite,
            commands::clipboard_transform,
            commands::clipboard_detect_type,
            commands::clipboard_monitor_start,
            commands::clipboard_monitor_stop,
            // Shortcuts commands
            commands::shortcuts_run,
            // Finder integration commands
            commands::finder_is_installed,
            commands::finder_install,
            commands::finder_uninstall,
            commands::finder_check_pending,
            // File Tags & Spotlight commands
            commands::file_tags_get,
            commands::file_tags_set,
            commands::file_tags_set_comment,
            commands::file_tags_get_metadata,
            commands::file_tags_analyze,
            commands::file_tags_analyze_batch,
            // Share Extension commands
            commands::share_is_installed,
            commands::share_check_pending,
            // Drop content detection
            commands::detect_drop_content_type,
            // Accessibility commands
            commands::ax_is_trusted,
            commands::ax_prompt_trust,
            commands::ax_get_frontmost_app,
            commands::ax_get_ui_tree,
            commands::ax_get_focused_element,
            commands::ax_get_attributes,
            commands::ax_perform_action,
            commands::ax_set_value,
            commands::ax_get_element_at_position,
            commands::ax_list_apps,
            // Context bar commands
            commands::simulate_paste,
            contextbar::contextbar_get_context,
            contextbar::contextbar_debug_capture,
            // System Health commands
            commands::system_health_snapshot,
            // Shortcut management commands
            window::shortcut_get_palette,
            window::shortcut_check,
            window::shortcut_set_palette,
            window::shortcut_set,
            window::shortcut_validate,
            window::shortcut_list_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
