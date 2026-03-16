use crate::sidecar::SidecarState;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};

// ---------------------------------------------------------------------------
// Helper: call sidecar with JSON-RPC
// ---------------------------------------------------------------------------

async fn sidecar_call(
    state: &State<'_, SidecarState>,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    state.call(method, params).await
}

async fn sidecar_notify(
    state: &State<'_, SidecarState>,
    method: &str,
    params: Value,
) -> Result<(), String> {
    state.notify(method, params).await
}

// ---------------------------------------------------------------------------
// Conversation commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn conversation_create(
    state: State<'_, SidecarState>,
    title: Option<String>,
) -> Result<Value, String> {
    sidecar_call(&state, "conversation:create", serde_json::json!([title])).await
}

#[tauri::command]
pub async fn conversation_list(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "conversation:list", serde_json::json!([])).await
}

#[tauri::command]
pub async fn conversation_delete(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(&state, "conversation:delete", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn conversation_messages(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(&state, "conversation:messages", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn conversation_update_title(
    state: State<'_, SidecarState>,
    id: String,
    title: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "conversation:updateTitle",
        serde_json::json!([id, title]),
    )
    .await
}

#[tauri::command]
pub async fn conversation_search(
    state: State<'_, SidecarState>,
    query: String,
) -> Result<Value, String> {
    sidecar_call(&state, "conversation:search", serde_json::json!([query])).await
}

#[tauri::command]
pub async fn conversation_get_system_prompt(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "conversation:getSystemPrompt",
        serde_json::json!([id]),
    )
    .await
}

#[tauri::command]
pub async fn conversation_set_system_prompt(
    state: State<'_, SidecarState>,
    id: String,
    prompt: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "conversation:setSystemPrompt",
        serde_json::json!([id, prompt]),
    )
    .await
}

#[tauri::command]
pub async fn conversation_set_folder(
    state: State<'_, SidecarState>,
    id: String,
    folder_id: Option<String>,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "conversation:setFolder",
        serde_json::json!([id, folder_id]),
    )
    .await
}

#[tauri::command]
pub async fn conversation_set_favorite(
    state: State<'_, SidecarState>,
    id: String,
    is_favorite: bool,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "conversation:setFavorite",
        serde_json::json!([id, is_favorite]),
    )
    .await
}

#[tauri::command]
pub async fn conversation_branch_info(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(&state, "conversation:branchInfo", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn conversation_switch_branch(
    state: State<'_, SidecarState>,
    id: String,
    target_message_id: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "conversation:switchBranch",
        serde_json::json!([id, target_message_id]),
    )
    .await
}

// ---------------------------------------------------------------------------
// Agent commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn agent_send(
    state: State<'_, SidecarState>,
    conversation_id: String,
    content: Value,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "agent:send",
        serde_json::json!([conversation_id, content]),
    )
    .await
}

#[tauri::command]
pub async fn agent_regenerate(
    state: State<'_, SidecarState>,
    conversation_id: String,
    assistant_message_id: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "agent:regenerate",
        serde_json::json!([conversation_id, assistant_message_id]),
    )
    .await
}

#[tauri::command]
pub async fn agent_abort(
    state: State<'_, SidecarState>,
    conversation_id: String,
) -> Result<(), String> {
    sidecar_notify(
        &state,
        "agent:abort",
        serde_json::json!([conversation_id]),
    )
    .await
}

#[tauri::command]
pub async fn agent_subscribe(
    state: State<'_, SidecarState>,
    conversation_id: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "agent:subscribe",
        serde_json::json!([conversation_id]),
    )
    .await
}

#[tauri::command]
pub async fn agent_unsubscribe(
    state: State<'_, SidecarState>,
    conversation_id: String,
) -> Result<(), String> {
    sidecar_notify(
        &state,
        "agent:unsubscribe",
        serde_json::json!([conversation_id]),
    )
    .await
}

#[tauri::command]
pub async fn agent_status(
    state: State<'_, SidecarState>,
    conversation_id: Option<String>,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "agent:status",
        serde_json::json!([conversation_id]),
    )
    .await
}

#[tauri::command]
pub async fn agent_running_conversations(
    state: State<'_, SidecarState>,
) -> Result<Value, String> {
    sidecar_call(&state, "agent:runningConversations", serde_json::json!([])).await
}

// ---------------------------------------------------------------------------
// Provider commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn provider_list(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "provider:list", serde_json::json!([])).await
}

#[tauri::command]
pub async fn provider_set(
    state: State<'_, SidecarState>,
    config: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "provider:set", serde_json::json!([config])).await
}

#[tauri::command]
pub async fn provider_remove(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<(), String> {
    sidecar_notify(&state, "provider:remove", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn provider_set_active(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<(), String> {
    sidecar_notify(&state, "provider:setActive", serde_json::json!([id])).await
}

// ---------------------------------------------------------------------------
// Knowledge Base commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn kb_list(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "kb:list", serde_json::json!([])).await
}

#[tauri::command]
pub async fn kb_set(state: State<'_, SidecarState>, item: Value) -> Result<Value, String> {
    sidecar_call(&state, "kb:set", serde_json::json!([item])).await
}

#[tauri::command]
pub async fn kb_remove(state: State<'_, SidecarState>, id: String) -> Result<(), String> {
    sidecar_notify(&state, "kb:remove", serde_json::json!([id])).await
}

// ---------------------------------------------------------------------------
// Skills commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn skills_search(
    state: State<'_, SidecarState>,
    query: String,
    tag: Option<String>,
    per_page: Option<u32>,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "skills:search",
        serde_json::json!([query, tag, per_page]),
    )
    .await
}

#[tauri::command]
pub async fn skills_list_installed(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "skills:listInstalled", serde_json::json!([])).await
}

#[tauri::command]
pub async fn skills_install(
    state: State<'_, SidecarState>,
    skill: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "skills:install", serde_json::json!([skill])).await
}

#[tauri::command]
pub async fn skills_uninstall(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(&state, "skills:uninstall", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn skills_get_enabled(
    state: State<'_, SidecarState>,
    conversation_id: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "skills:getEnabled",
        serde_json::json!([conversation_id]),
    )
    .await
}

#[tauri::command]
pub async fn skills_set_enabled(
    state: State<'_, SidecarState>,
    conversation_id: String,
    skill_ids: Vec<String>,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "skills:setEnabled",
        serde_json::json!([conversation_id, skill_ids]),
    )
    .await
}

// ---------------------------------------------------------------------------
// MCP commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn mcp_list(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "mcp:list", serde_json::json!([])).await
}

#[tauri::command]
pub async fn mcp_set(state: State<'_, SidecarState>, config: Value) -> Result<Value, String> {
    sidecar_call(&state, "mcp:set", serde_json::json!([config])).await
}

#[tauri::command]
pub async fn mcp_remove(state: State<'_, SidecarState>, id: String) -> Result<(), String> {
    sidecar_notify(&state, "mcp:remove", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn mcp_status(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "mcp:status", serde_json::json!([])).await
}

#[tauri::command]
pub async fn mcp_reconnect(
    state: State<'_, SidecarState>,
    id: Option<String>,
) -> Result<Value, String> {
    sidecar_call(&state, "mcp:reconnect", serde_json::json!([id])).await
}

// ---------------------------------------------------------------------------
// Scheduler commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn scheduler_list(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "scheduler:list", serde_json::json!([])).await
}

#[tauri::command]
pub async fn scheduler_set(
    state: State<'_, SidecarState>,
    task: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "scheduler:set", serde_json::json!([task])).await
}

#[tauri::command]
pub async fn scheduler_remove(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<(), String> {
    sidecar_notify(&state, "scheduler:remove", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn scheduler_run_now(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(&state, "scheduler:runNow", serde_json::json!([id])).await
}

// ---------------------------------------------------------------------------
// Memory commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn memory_get_config(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "memory:getConfig", serde_json::json!([])).await
}

#[tauri::command]
pub async fn memory_set_config(
    state: State<'_, SidecarState>,
    config: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "memory:setConfig", serde_json::json!([config])).await
}

#[tauri::command]
pub async fn memory_get_summaries(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "memory:getSummaries", serde_json::json!([])).await
}

#[tauri::command]
pub async fn memory_delete_summary(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(&state, "memory:deleteSummary", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn memory_get_facts(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "memory:getFacts", serde_json::json!([])).await
}

#[tauri::command]
pub async fn memory_delete_fact(
    state: State<'_, SidecarState>,
    id: String,
) -> Result<Value, String> {
    sidecar_call(&state, "memory:deleteFact", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn memory_update_fact(
    state: State<'_, SidecarState>,
    id: String,
    content: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "memory:updateFact",
        serde_json::json!([id, content]),
    )
    .await
}

// ---------------------------------------------------------------------------
// Tool Permissions commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn tool_permissions_get(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "toolPermissions:get", serde_json::json!([])).await
}

#[tauri::command]
pub async fn tool_permissions_set(
    state: State<'_, SidecarState>,
    permissions: Value,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "toolPermissions:set",
        serde_json::json!([permissions]),
    )
    .await
}

#[tauri::command]
pub async fn tool_respond_approval(
    state: State<'_, SidecarState>,
    conversation_id: String,
    approval_id: String,
    approved: bool,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "tool:respondApproval",
        serde_json::json!([conversation_id, approval_id, approved]),
    )
    .await
}

// ---------------------------------------------------------------------------
// Preferences commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn preferences_get(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "preferences:get", serde_json::json!([])).await
}

#[tauri::command]
pub async fn preferences_set(
    state: State<'_, SidecarState>,
    prefs: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "preferences:set", serde_json::json!([prefs])).await
}

// ---------------------------------------------------------------------------
// Proxy commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn proxy_apply(
    state: State<'_, SidecarState>,
    url: Option<String>,
) -> Result<Value, String> {
    sidecar_call(&state, "proxy:apply", serde_json::json!([url])).await
}

// ---------------------------------------------------------------------------
// Voice commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn voice_transcribe(
    state: State<'_, SidecarState>,
    audio_base64: String,
    language: Option<String>,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "voice:transcribe",
        serde_json::json!([audio_base64, language]),
    )
    .await
}

// ---------------------------------------------------------------------------
// Screen capture commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn screen_capture(
    state: State<'_, SidecarState>,
    app: AppHandle,
) -> Result<Value, String> {
    // Hide window, capture screen, restore window
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }

    // Small delay to let window hide
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    let result = sidecar_call(&state, "screen:capture", serde_json::json!([])).await;

    // Restore window
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }

    result
}

// ---------------------------------------------------------------------------
// Notifications config
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn notifications_config(
    state: State<'_, SidecarState>,
    config: Value,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "notifications:config",
        serde_json::json!([config]),
    )
    .await
}

// ---------------------------------------------------------------------------
// File System commands (native - not through sidecar)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn fs_read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn fs_write_file(path: String, content: String) -> Result<bool, String> {
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_write_file_binary(path: String, base64_data: String) -> Result<bool, String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Invalid base64: {}", e))?;
    tokio::fs::write(&path, bytes)
        .await
        .map_err(|e| format!("Failed to write binary file: {}", e))?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_read_file_base64(path: String) -> Result<Option<serde_json::Value>, String> {
    use base64::Engine;
    match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
            let mime = match ext.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "gif" => "image/gif",
                "webp" => "image/webp",
                "svg" => "image/svg+xml",
                "bmp" => "image/bmp",
                _ => "image/png",
            };
            let data = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Ok(Some(serde_json::json!({ "data": data, "mimeType": mime })))
        }
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn fs_stat(path: String) -> Result<Option<Value>, String> {
    match tokio::fs::metadata(&path).await {
        Ok(meta) => Ok(Some(serde_json::json!({
            "size": meta.len(),
            "isDirectory": meta.is_dir(),
            "isFile": meta.is_file(),
        }))),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn fs_select_file(
    app: AppHandle,
    _filters: Option<Value>,
    multi: Option<bool>,
) -> Result<Option<Vec<String>>, String> {
    use tauri_plugin_dialog::DialogExt;

    let builder = app.dialog().file();

    if multi.unwrap_or(false) {
        let result = builder.blocking_pick_files();
        match result {
            Some(paths) => Ok(Some(paths.iter().map(|p| p.to_string()).collect())),
            None => Ok(None),
        }
    } else {
        let result = builder.blocking_pick_file();
        match result {
            Some(path) => Ok(Some(vec![path.to_string()])),
            None => Ok(None),
        }
    }
}

#[tauri::command]
pub async fn fs_select_directory(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog().file().blocking_pick_folder();
    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn fs_open_path(path: String) -> Result<Value, String> {
    match open::that(&path) {
        Ok(_) => Ok(serde_json::json!({ "success": true, "error": null })),
        Err(e) => Ok(serde_json::json!({ "success": false, "error": e.to_string() })),
    }
}

#[tauri::command]
pub async fn fs_show_item_in_folder(app: AppHandle, path: String) -> Result<bool, String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(std::path::Path::new(&path))
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
pub async fn fs_show_save_dialog(
    app: AppHandle,
    default_path: Option<String>,
    title: Option<String>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(dp) = default_path {
        builder = builder.set_file_name(&dp);
    }
    if let Some(t) = title {
        builder = builder.set_title(&t);
    }
    let result = builder.blocking_save_file();
    Ok(result.map(|p| p.to_string()))
}

#[tauri::command]
pub async fn export_print_to_pdf(_html: String) -> Result<String, String> {
    Err("PDF export: use window.print() in the frontend".to_string())
}

// ---------------------------------------------------------------------------
// Permissions commands (macOS-specific)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn permissions_check_all() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(serde_json::json!({
            "accessibility": check_permission_status("accessibility"),
            "screen": check_permission_status("screen"),
            "microphone": check_permission_status("microphone"),
            "camera": check_permission_status("camera"),
            "full-disk-access": check_permission_status("full-disk-access"),
            "automation": "unknown",
            "notifications": "granted",
        }))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(serde_json::json!({
            "accessibility": "granted",
            "screen": "granted",
            "microphone": "granted",
            "camera": "granted",
            "full-disk-access": "granted",
            "automation": "granted",
            "notifications": "granted",
        }))
    }
}

#[tauri::command]
pub async fn permissions_check(perm_type: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(check_permission_status(&perm_type))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = perm_type;
        Ok("granted".to_string())
    }
}

#[tauri::command]
pub async fn permissions_request(_perm_type: String) -> Result<Value, String> {
    Ok(serde_json::json!({
        "status": "not-determined",
        "canRequestDirectly": false,
    }))
}

#[tauri::command]
pub async fn permissions_open_settings(perm_type: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let url = match perm_type.as_str() {
            "accessibility" => "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility",
            "screen" => "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_ScreenCapture",
            "microphone" => "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Microphone",
            "camera" => "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Camera",
            "full-disk-access" => "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles",
            "automation" => "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Automation",
            "notifications" => "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Notifications",
            _ => return Err(format!("Unknown permission type: {}", perm_type)),
        };
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open settings: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = perm_type;
        Ok(())
    }
}

#[tauri::command]
pub async fn permissions_reset(perm_type: String) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let service = match perm_type.as_str() {
            "accessibility" => "Accessibility",
            "screen" => "ScreenCapture",
            "microphone" => "Microphone",
            "camera" => "Camera",
            "full-disk-access" => "SystemPolicyAllFiles",
            "automation" => "AppleEvents",
            _ => return Ok(serde_json::json!({ "success": false, "requiresManual": true })),
        };
        let output = std::process::Command::new("tccutil")
            .args(["reset", service, "com.agentx.desktop"])
            .output();
        match output {
            Ok(o) if o.status.success() => {
                Ok(serde_json::json!({ "success": true, "requiresManual": false }))
            }
            _ => Ok(serde_json::json!({ "success": false, "requiresManual": true })),
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = perm_type;
        Ok(serde_json::json!({ "success": false, "requiresManual": false }))
    }
}

// ---------------------------------------------------------------------------
// Updater commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn updater_check(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = handle.emit("updater:status", serde_json::json!({ "state": "checking" }));
        match handle.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => {
                    let _ = handle.emit(
                        "updater:status",
                        serde_json::json!({ "state": "available", "version": update.version }),
                    );
                }
                Ok(None) => {
                    let _ = handle.emit(
                        "updater:status",
                        serde_json::json!({ "state": "not-available" }),
                    );
                }
                Err(e) => {
                    let _ = handle.emit(
                        "updater:status",
                        serde_json::json!({ "state": "error", "error": e.to_string() }),
                    );
                }
            },
            Err(e) => {
                let _ = handle.emit(
                    "updater:status",
                    serde_json::json!({ "state": "error", "error": e.to_string() }),
                );
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn updater_install(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        match handle.updater() {
            Ok(updater) => match updater.check().await {
                Ok(Some(update)) => {
                    let version = update.version.clone();
                    let _ = handle.emit(
                        "updater:status",
                        serde_json::json!({ "state": "downloading" }),
                    );
                    let downloaded = Arc::new(AtomicU64::new(0));
                    let h = handle.clone();
                    let on_chunk = {
                        let downloaded = Arc::clone(&downloaded);
                        move |chunk_len: usize, content_len: Option<u64>| {
                            let prev = downloaded.fetch_add(chunk_len as u64, Ordering::Relaxed);
                            let transferred = prev + chunk_len as u64;
                            let total = content_len.unwrap_or(0);
                            let percent = if total > 0 {
                                (transferred as f64 / total as f64) * 100.0
                            } else {
                                0.0
                            };
                            let _ = h.emit(
                                "updater:status",
                                serde_json::json!({
                                    "state": "downloading",
                                    "progress": {
                                        "percent": percent,
                                        "bytesPerSecond": 0,
                                        "transferred": transferred,
                                        "total": total
                                    }
                                }),
                            );
                        }
                    };
                    let on_finish = || {};
                    match update.download_and_install(on_chunk, on_finish).await {
                        Ok(_) => {
                            let _ = handle.emit(
                                "updater:status",
                                serde_json::json!({ "state": "downloaded", "version": version }),
                            );
                        }
                        Err(e) => {
                            let _ = handle.emit(
                                "updater:status",
                                serde_json::json!({ "state": "error", "error": e.to_string() }),
                            );
                        }
                    }
                }
                _ => {
                    let _ = handle.emit(
                        "updater:status",
                        serde_json::json!({ "state": "not-available" }),
                    );
                }
            },
            Err(e) => {
                let _ = handle.emit(
                    "updater:status",
                    serde_json::json!({ "state": "error", "error": e.to_string() }),
                );
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn updater_restart(app: AppHandle) -> Result<(), String> {
    app.restart();
}

// ---------------------------------------------------------------------------
// Window commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn window_minimize(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn window_maximize(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_maximized().unwrap_or(false) {
            win.unmaximize().map_err(|e| e.to_string())?;
        } else {
            win.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn window_close(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn window_show(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Helper: macOS permission status check
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
fn check_permission_status(perm_type: &str) -> String {
    match perm_type {
        "full-disk-access" => {
            let protected = format!(
                "{}/Library/Safari",
                std::env::var("HOME").unwrap_or_default()
            );
            if std::fs::read_dir(&protected).is_ok() {
                "granted".to_string()
            } else {
                "denied".to_string()
            }
        }
        _ => "unknown".to_string(),
    }
}
