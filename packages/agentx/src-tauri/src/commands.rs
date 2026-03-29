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
// Channel commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn channel_list(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "channel:list", serde_json::json!([])).await
}

#[tauri::command]
pub async fn channel_set(state: State<'_, SidecarState>, config: Value) -> Result<Value, String> {
    sidecar_call(&state, "channel:set", serde_json::json!([config])).await
}

#[tauri::command]
pub async fn channel_remove(state: State<'_, SidecarState>, id: String) -> Result<Value, String> {
    sidecar_call(&state, "channel:remove", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn channel_status(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "channel:status", serde_json::json!([])).await
}

#[tauri::command]
pub async fn channel_start(state: State<'_, SidecarState>, id: String) -> Result<Value, String> {
    sidecar_call(&state, "channel:start", serde_json::json!([id])).await
}

#[tauri::command]
pub async fn channel_stop(state: State<'_, SidecarState>, id: String) -> Result<Value, String> {
    sidecar_call(&state, "channel:stop", serde_json::json!([id])).await
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

/// Internal helper: get preferences using AppHandle (callable from non-command Rust code).
pub async fn preferences_get_internal(app: &AppHandle) -> Result<Value, String> {
    let state = app.state::<SidecarState>();
    state.call("preferences:get", serde_json::json!([])).await
}

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
// OCR capture command
// ---------------------------------------------------------------------------

/// OCR: run text recognition on base64 image data.
/// The screenshot is taken by the frontend via the existing sidecar screen:capture,
/// then this command runs Vision OCR on the captured image.
#[tauri::command]
pub async fn ocr_recognize(image_base64: String) -> Result<Value, String> {
    let text = tokio::task::spawn_blocking(move || crate::ocr::ocr_from_base64(&image_base64))
        .await
        .map_err(|e| format!("OCR task failed: {}", e))??;

    Ok(serde_json::json!({ "text": text }))
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
// Notification Intelligence commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn ni_get_config(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "ni:getConfig", serde_json::json!([])).await
}

#[tauri::command]
pub async fn ni_set_config(
    state: State<'_, SidecarState>,
    config: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "ni:setConfig", serde_json::json!([config])).await
}

#[tauri::command]
pub async fn ni_fetch(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "ni:fetch", serde_json::json!([])).await
}

#[tauri::command]
pub async fn ni_classify(
    state: State<'_, SidecarState>,
    notifications: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "ni:classify", serde_json::json!([notifications])).await
}

#[tauri::command]
pub async fn ni_start(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "ni:start", serde_json::json!([])).await
}

#[tauri::command]
pub async fn ni_stop(state: State<'_, SidecarState>) -> Result<Value, String> {
    sidecar_call(&state, "ni:stop", serde_json::json!([])).await
}

#[tauri::command]
pub async fn ni_mark_read(
    state: State<'_, SidecarState>,
    ids: Value,
) -> Result<Value, String> {
    sidecar_call(&state, "ni:markRead", serde_json::json!([ids])).await
}

#[tauri::command]
pub async fn ni_open_app(bundle_id: String) -> Result<Value, String> {
    let output = std::process::Command::new("open")
        .args(["-b", &bundle_id])
        .output()
        .map_err(|e| format!("Failed to open app: {}", e))?;
    if output.status.success() {
        Ok(serde_json::json!({ "success": true }))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Ok(serde_json::json!({ "success": false, "error": stderr.to_string() }))
    }
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
pub async fn fs_list_dir(path: String) -> Result<Vec<String>, String> {
    let entries = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_path = entry.path();
        if let Some(s) = file_path.to_str() {
            files.push(s.to_string());
        }
    }
    Ok(files)
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
pub async fn permissions_check_all(app: AppHandle) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        // Check notifications: ncprefs.plist is the source of truth.
        // UNUserNotificationCenter API is unreliable for ad-hoc signed apps
        // (returns "granted" even when the app isn't registered, or "not-determined"
        // even after the user enables notifications via System Settings GUI).
        let notif_status = {
            if check_ncprefs_has_agentx() {
                "granted".to_string()
            } else {
                let api_status = check_notification_status();
                if api_status == "granted" {
                    // API says granted but not in ncprefs — false positive
                    "not-determined".to_string()
                } else {
                    api_status
                }
            }
        };

        // Detect dev mode: if the executable is NOT inside a .app bundle,
        // permission checks will reflect the *terminal's* TCC identity
        // (macOS "responsible process" mechanism), not the app's own identity.
        let exe_path = std::env::current_exe()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let is_app_bundle = exe_path.contains(".app/Contents/MacOS/");

        eprintln!(
            "[Permissions] checkAll — pid={}, exe={:?}, bundle={:?}, is_app_bundle={}",
            std::process::id(),
            exe_path,
            app.config().identifier,
            is_app_bundle,
        );

        // Out-of-process helper for TCC APIs that cache in-process
        // (accessibility, screen, microphone, camera).
        // FDA, automation, notifications must be checked in-process because:
        // - FDA: filesystem access checks the actual binary, not responsible process
        // - Automation: Apple Event TCC attribution breaks for grandchild processes
        // - Notifications: requires app bundle context (Tauri plugin)
        let fresh = check_permissions_out_of_process();

        let get_status_fresh = |perm: &str| -> String {
            if let Some(ref results) = fresh {
                if let Some(status) = results.get(perm) {
                    eprintln!("[Permissions] {} = {} (out-of-process)", perm, status);
                    return status.clone();
                }
            }
            let status = check_permission_status_inprocess(perm);
            eprintln!("[Permissions] {} = {} (in-process fallback)", perm, status);
            status
        };

        // FDA and automation always in-process (no caching issue for these)
        let fda_status = check_permission_status_inprocess("full-disk-access");
        eprintln!("[Permissions] full-disk-access = {} (in-process)", fda_status);
        let auto_status = check_permission_status_inprocess("automation");
        eprintln!("[Permissions] automation = {} (in-process)", auto_status);

        Ok(serde_json::json!({
            "accessibility": get_status_fresh("accessibility"),
            "screen": get_status_fresh("screen"),
            "microphone": get_status_fresh("microphone"),
            "camera": get_status_fresh("camera"),
            "full-disk-access": fda_status,
            "automation": auto_status,
            "notifications": notif_status,
            "isDevMode": !is_app_bundle,
        }))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
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
pub async fn permissions_request(app: AppHandle, perm_type: String) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        match perm_type.as_str() {
            "accessibility" => {
                // Use the centralized main-thread prompt helper
                let granted = crate::accessibility::prompt_trust_on_main_thread();
                eprintln!("[Permissions] accessibility prompt_trust = {}", granted);
                // Double-check — prompt may return false even if user already granted
                let is_granted = granted || crate::accessibility::is_trusted();
                Ok(serde_json::json!({
                    "status": if is_granted { "granted" } else { "not-determined" },
                    "canRequestDirectly": true,
                }))
            }
            "screen" => {
                // CGRequestScreenCaptureAccess() must run on main thread to show the UI prompt.
                extern "C" {
                    fn CGRequestScreenCaptureAccess() -> bool;
                    static _dispatch_main_q: std::ffi::c_void;
                    fn dispatch_sync_f(
                        queue: *mut std::ffi::c_void,
                        context: *mut std::ffi::c_void,
                        work: extern "C" fn(*mut std::ffi::c_void),
                    );
                }
                extern "C" fn do_request(ctx: *mut std::ffi::c_void) {
                    let result_ptr = ctx as *mut bool;
                    unsafe { *result_ptr = CGRequestScreenCaptureAccess(); }
                }
                let mut granted = false;
                unsafe {
                    dispatch_sync_f(
                        std::ptr::addr_of!(_dispatch_main_q) as *mut std::ffi::c_void,
                        &mut granted as *mut bool as *mut std::ffi::c_void,
                        do_request,
                    );
                }
                eprintln!("[Permissions] screen CGRequestScreenCaptureAccess = {}", granted);
                Ok(serde_json::json!({
                    "status": if granted { "granted" } else { "not-determined" },
                    "canRequestDirectly": true,
                }))
            }
            "microphone" | "camera" => {
                // Request mic/camera access in-process via objc runtime.
                // AVCaptureDevice.requestAccess(for:completionHandler:) triggers the system prompt.
                let is_video = perm_type == "camera";
                let granted = request_av_capture_access(is_video);
                Ok(serde_json::json!({
                    "status": if granted { "granted" } else { "not-determined" },
                    "canRequestDirectly": true,
                }))
            }
            "notifications" => {
                // Register with notification center and add to ncprefs.plist.
                // Having AgentX in notification settings = granted.
                let _native = request_notification_on_main_thread();
                post_test_notification(&app);
                let ncprefs_ok = grant_notification_via_ncprefs();
                eprintln!("[Permissions] notifications ncprefs insert = {}", ncprefs_ok);

                Ok(serde_json::json!({
                    "status": if ncprefs_ok { "granted" } else { "not-determined" },
                    "canRequestDirectly": ncprefs_ok,
                }))
            }
            "automation" => {
                // Directly insert into user TCC database (same approach as FDA).
                let tcc_ok = grant_tcc_entry(
                    "kTCCServiceAppleEvents",
                    "com.agentx.desktop",
                    Some("com.apple.systemevents"),
                );
                eprintln!("[Permissions] automation TCC insert = {}", tcc_ok);
                Ok(serde_json::json!({
                    "status": if tcc_ok { "granted" } else { "not-determined" },
                    "canRequestDirectly": tcc_ok,
                }))
            }
            "full-disk-access" => {
                // FDA cannot be requested via TCC API. Instead, insert directly
                // into the system TCC database using admin privileges (osascript
                // shows a native macOS password dialog).
                // This works when SIP is disabled; with SIP enabled, falls back
                // to opening System Settings.
                let granted = grant_fda_via_tcc_db();
                eprintln!("[Permissions] FDA grant_via_tcc_db = {}", granted);
                if granted {
                    Ok(serde_json::json!({
                        "status": "granted",
                        "canRequestDirectly": true,
                    }))
                } else {
                    // Fall back to opening System Settings manually
                    Ok(serde_json::json!({
                        "status": "not-determined",
                        "canRequestDirectly": false,
                    }))
                }
            }
            _ => {
                Ok(serde_json::json!({
                    "status": "not-determined",
                    "canRequestDirectly": false,
                }))
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, perm_type);
        Ok(serde_json::json!({
            "status": "granted",
            "canRequestDirectly": true,
        }))
    }
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
            "notifications" => "x-apple.systempreferences:com.apple.Notifications-Settings.extension",
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
        // Notifications: remove AgentX entry from ncprefs.plist
        if perm_type == "notifications" {
            let ok = revoke_notification_via_ncprefs();
            eprintln!("[Permissions] notifications revoke = {}", ok);
            return Ok(serde_json::json!({
                "tccutilOk": ok,
                "needsRestart": false,
            }));
        }

        let service = match perm_type.as_str() {
            "accessibility" => "Accessibility",
            "screen" => "ScreenCapture",
            "microphone" => "Microphone",
            "camera" => "Camera",
            "full-disk-access" => "SystemPolicyAllFiles",
            "automation" => "AppleEvents",
            _ => return Ok(serde_json::json!({ "tccutilOk": false, "needsRestart": false })),
        };

        // Try multiple identities for tccutil reset because TCC uses different
        // identifiers depending on whether this is an installed .app (bundle ID)
        // or a development binary (executable path).
        let mut tcc_ok = false;

        // 1) Reset by bundle ID (installed .app)
        let output = std::process::Command::new("tccutil")
            .args(["reset", service, "com.agentx.desktop"])
            .output();
        if let Ok(o) = &output {
            if o.status.success() {
                tcc_ok = true;
                eprintln!("[Permissions] tccutil reset {} com.agentx.desktop — ok", service);
            }
        }

        // 2) Reset by actual executable path (dev builds)
        if let Ok(exe) = std::env::current_exe() {
            let exe_str = exe.to_string_lossy();
            let output2 = std::process::Command::new("tccutil")
                .args(["reset", service, &exe_str])
                .output();
            if let Ok(o) = &output2 {
                if o.status.success() {
                    tcc_ok = true;
                    eprintln!("[Permissions] tccutil reset {} {:?} — ok", service, exe_str);
                }
            }
        }

        // 3) Fall back to resetting ALL entries for the service
        if !tcc_ok {
            let output3 = std::process::Command::new("tccutil")
                .args(["reset", service])
                .output();
            if let Ok(o) = output3 {
                tcc_ok = o.status.success();
                eprintln!("[Permissions] tccutil reset {} (all) — {}", service, if tcc_ok { "ok" } else { "failed" });
            }
        }

        // NOTE: We deliberately do NOT try to verify the reset in-process.
        // macOS caches permission state (especially screen recording and
        // accessibility) at the process level — in-process APIs like
        // CGPreflightScreenCaptureAccess / CGWindowListCreateImage /
        // AXIsProcessTrusted will keep returning "granted" even after the
        // TCC entry is removed. The only reliable way for the change to
        // take effect is to restart the app.
        let needs_restart = matches!(perm_type.as_str(),
            "screen" | "accessibility"
        );

        Ok(serde_json::json!({
            "tccutilOk": tcc_ok,
            "needsRestart": needs_restart,
        }))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = perm_type;
        Ok(serde_json::json!({ "tccutilOk": false, "needsRestart": false }))
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

#[tauri::command]
pub async fn window_show_and_emit(app: AppHandle, event: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        // Use eval to directly dispatch in the main window's JS context.
        // This is more reliable than cross-window Tauri events after show().
        let js = format!(
            "window.__QUICKCHAT_ACTION__ && window.__QUICKCHAT_ACTION__('{}')",
            event
        );
        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        let _ = win.eval(&js);
    }
    Ok(())
}

#[tauri::command]
pub async fn quickchat_open_mode(app: AppHandle, mode: String) -> Result<(), String> {
    crate::quickchat::show_quickchat_mode(&app, &mode)
}

// ---------------------------------------------------------------------------
// Translate commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn translate_run(
    state: State<'_, SidecarState>,
    text: String,
    target_lang: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "translate:run",
        serde_json::json!([text, target_lang]),
    )
    .await
}

#[tauri::command]
pub async fn translate_get_selected_text() -> Result<String, String> {
    crate::translate::get_selected_text()
}

// ---------------------------------------------------------------------------
// Shortcuts commands (for Shortcuts.app / x-callback-url integration)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn shortcuts_run(
    state: State<'_, SidecarState>,
    prompt: String,
    system_prompt: Option<String>,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "shortcuts:run",
        serde_json::json!([prompt, system_prompt]),
    )
    .await
}

// ---------------------------------------------------------------------------
// Clipboard pipeline commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn clipboard_process(
    state: State<'_, SidecarState>,
    text: String,
    action: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "clipboard:process",
        serde_json::json!([text, action]),
    )
    .await
}

#[tauri::command]
pub async fn clipboard_write(text: String) -> Result<(), String> {
    crate::clipboard::set_clipboard_text(&text)
}

#[tauri::command]
pub async fn clipboard_read() -> Result<String, String> {
    crate::clipboard::get_clipboard_text()
}

// Clipboard history commands

#[tauri::command]
pub async fn clipboard_history_list(
    state: State<'_, crate::clipboard::ClipboardHistoryState>,
) -> Result<Value, String> {
    let entries = state.get_entries();
    serde_json::to_value(&entries).map_err(|e| format!("Serialize error: {}", e))
}

#[tauri::command]
pub async fn clipboard_history_search(
    state: State<'_, crate::clipboard::ClipboardHistoryState>,
    query: String,
) -> Result<Value, String> {
    let entries = state.search_entries(&query);
    serde_json::to_value(&entries).map_err(|e| format!("Serialize error: {}", e))
}

#[tauri::command]
pub async fn clipboard_history_delete(
    state: State<'_, crate::clipboard::ClipboardHistoryState>,
    id: u64,
) -> Result<bool, String> {
    Ok(state.delete_entry(id))
}

#[tauri::command]
pub async fn clipboard_history_clear(
    state: State<'_, crate::clipboard::ClipboardHistoryState>,
) -> Result<(), String> {
    state.clear_history();
    Ok(())
}

#[tauri::command]
pub async fn clipboard_history_toggle_pin(
    state: State<'_, crate::clipboard::ClipboardHistoryState>,
    id: u64,
) -> Result<Option<bool>, String> {
    Ok(state.toggle_pin(id))
}

#[tauri::command]
pub async fn clipboard_history_toggle_favorite(
    state: State<'_, crate::clipboard::ClipboardHistoryState>,
    id: u64,
) -> Result<Option<bool>, String> {
    Ok(state.toggle_favorite(id))
}

#[tauri::command]
pub async fn clipboard_transform(text: String, transform: String) -> Result<String, String> {
    crate::clipboard::transform_text(&text, &transform)
}

#[tauri::command]
pub async fn clipboard_detect_type(text: String) -> Result<Value, String> {
    let (content_type, language) = crate::clipboard::detect_content_type(&text);
    Ok(serde_json::json!({
        "content_type": content_type,
        "language": language,
    }))
}

#[tauri::command]
pub async fn clipboard_monitor_start(app: AppHandle) -> Result<(), String> {
    crate::clipboard::start_clipboard_monitor(&app);
    Ok(())
}

#[tauri::command]
pub async fn clipboard_monitor_stop(app: AppHandle) -> Result<(), String> {
    crate::clipboard::stop_clipboard_monitor(&app);
    Ok(())
}

// ---------------------------------------------------------------------------
// System Health commands (native — not through sidecar)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn system_health_snapshot() -> Result<Value, String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let cpu_model = sh_run("sysctl", &["-n", "machdep.cpu.brand_string"])
        .unwrap_or_else(|| "Unknown".into())
        .trim()
        .to_string();
    let cpu_cores: u32 = sh_run("sysctl", &["-n", "hw.ncpu"])
        .unwrap_or_default()
        .trim()
        .parse()
        .unwrap_or(0);
    let cpu_usage = parse_cpu_usage();

    let mem_total: u64 = sh_run("sysctl", &["-n", "hw.memsize"])
        .unwrap_or_default()
        .trim()
        .parse()
        .unwrap_or(0);
    let (mem_used, mem_available, swap_used, swap_total) = parse_memory();
    let mem_percent = if mem_total > 0 {
        (mem_used as f64 / mem_total as f64) * 100.0
    } else {
        0.0
    };

    let (disk_total, disk_used, disk_available) = parse_disk();
    let disk_percent = if disk_total > 0 {
        (disk_used as f64 / disk_total as f64) * 100.0
    } else {
        0.0
    };

    let battery = parse_battery();
    let network = parse_network();
    let top_processes = parse_top_processes();

    let load_avg_str = sh_run("sysctl", &["-n", "vm.loadavg"]).unwrap_or_default();
    let load_average: Vec<f64> = load_avg_str
        .trim()
        .trim_matches(|c| c == '{' || c == '}')
        .split_whitespace()
        .filter_map(|s| s.parse().ok())
        .collect();

    let uptime = sh_run("uptime", &[])
        .unwrap_or_default()
        .trim()
        .to_string();

    Ok(serde_json::json!({
        "timestamp": timestamp,
        "cpu": {
            "model": cpu_model,
            "cores": cpu_cores,
            "usagePercent": cpu_usage,
            "temperatureCelsius": serde_json::Value::Null,
        },
        "memory": {
            "totalBytes": mem_total,
            "usedBytes": mem_used,
            "availableBytes": mem_available,
            "usagePercent": (mem_percent * 10.0).round() / 10.0,
            "swapUsedBytes": swap_used,
            "swapTotalBytes": swap_total,
        },
        "disk": {
            "totalBytes": disk_total,
            "usedBytes": disk_used,
            "availableBytes": disk_available,
            "usagePercent": (disk_percent * 10.0).round() / 10.0,
            "mountPoint": "/",
        },
        "battery": battery,
        "network": network,
        "topProcesses": top_processes,
        "loadAverage": load_average,
        "uptime": uptime,
    }))
}

fn sh_run(cmd: &str, args: &[&str]) -> Option<String> {
    std::process::Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
}

fn parse_cpu_usage() -> f64 {
    let output = sh_run("top", &["-l", "1", "-n", "0", "-s", "0"]).unwrap_or_default();
    for line in output.lines() {
        if line.contains("CPU usage:") {
            let mut user = 0.0f64;
            let mut sys = 0.0f64;
            for part in line.split(',') {
                let part = part.trim();
                if part.contains("user") {
                    user = part
                        .split('%')
                        .next()
                        .unwrap_or("0")
                        .split_whitespace()
                        .last()
                        .unwrap_or("0")
                        .parse()
                        .unwrap_or(0.0);
                } else if part.contains("sys") {
                    sys = part
                        .split('%')
                        .next()
                        .unwrap_or("0")
                        .trim()
                        .parse()
                        .unwrap_or(0.0);
                }
            }
            return ((user + sys) * 10.0).round() / 10.0;
        }
    }
    0.0
}

fn parse_memory() -> (u64, u64, u64, u64) {
    let vm_stat = sh_run("vm_stat", &[]).unwrap_or_default();
    let default_page_size: u64 = 16384;

    let mut pages_active: u64 = 0;
    let mut pages_wired: u64 = 0;
    let mut pages_compressed: u64 = 0;
    let mut pages_free: u64 = 0;
    let mut pages_speculative: u64 = 0;
    let mut pages_inactive: u64 = 0;
    let mut actual_page_size: u64 = default_page_size;

    for line in vm_stat.lines() {
        if line.starts_with("Mach Virtual Memory Statistics") {
            if let Some(s) = line.split("page size of ").nth(1) {
                actual_page_size = s
                    .trim_end_matches(|c: char| !c.is_ascii_digit())
                    .parse()
                    .unwrap_or(default_page_size);
            }
        }
        let val = |l: &str| -> u64 {
            l.split(':')
                .nth(1)
                .unwrap_or("0")
                .trim()
                .trim_end_matches('.')
                .parse()
                .unwrap_or(0)
        };
        if line.starts_with("Pages active") {
            pages_active = val(line);
        }
        if line.starts_with("Pages wired") {
            pages_wired = val(line);
        }
        if line.starts_with("Pages occupied by compressor") {
            pages_compressed = val(line);
        }
        if line.starts_with("Pages free") {
            pages_free = val(line);
        }
        if line.starts_with("Pages speculative") {
            pages_speculative = val(line);
        }
        if line.starts_with("Pages inactive") {
            pages_inactive = val(line);
        }
    }

    let used = (pages_active + pages_wired + pages_compressed) * actual_page_size;
    let available = (pages_free + pages_inactive + pages_speculative) * actual_page_size;

    let swap_info = sh_run("sysctl", &["-n", "vm.swapusage"]).unwrap_or_default();
    let mut swap_total: u64 = 0;
    let mut swap_used: u64 = 0;
    for part in swap_info.split("  ") {
        let part = part.trim();
        if part.starts_with("total") {
            swap_total = parse_size_mb(part);
        } else if part.starts_with("used") {
            swap_used = parse_size_mb(part);
        }
    }

    (used, available, swap_used, swap_total)
}

fn parse_size_mb(s: &str) -> u64 {
    if let Some(val) = s.split('=').nth(1) {
        let val = val.trim().trim_end_matches('M').trim();
        let mb: f64 = val.parse().unwrap_or(0.0);
        (mb * 1024.0 * 1024.0) as u64
    } else {
        0
    }
}

fn parse_disk() -> (u64, u64, u64) {
    let df = sh_run("df", &["-k", "/"]).unwrap_or_default();
    if let Some(line) = df.lines().nth(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            let total: u64 = parts[1].parse().unwrap_or(0) * 1024;
            let used: u64 = parts[2].parse().unwrap_or(0) * 1024;
            let available: u64 = parts[3].parse().unwrap_or(0) * 1024;
            return (total, used, available);
        }
    }
    (0, 0, 0)
}

fn parse_battery() -> Option<Value> {
    let output = sh_run("pmset", &["-g", "batt"])?;
    if !output.contains("Battery") && !output.contains("InternalBattery") {
        return None;
    }

    let mut percent: f64 = 0.0;
    let mut charging = false;
    let mut time_remaining: Option<String> = None;

    for line in output.lines() {
        if line.contains("InternalBattery") || (line.contains('%') && line.contains("Battery")) {
            if let Some(pct_str) = line.split('%').next() {
                percent = pct_str
                    .split_whitespace()
                    .last()
                    .or_else(|| pct_str.split('\t').last())
                    .unwrap_or("0")
                    .parse()
                    .unwrap_or(0.0);
            }
            charging = line.contains("charging")
                && !line.contains("discharging")
                && !line.contains("not charging");
            if line.contains("remaining") {
                if let Some(time_part) = line.split(';').find(|s| s.contains("remaining")) {
                    time_remaining = Some(time_part.trim().to_string());
                }
            }
        }
    }

    Some(serde_json::json!({
        "present": true,
        "percent": percent,
        "charging": charging,
        "timeRemaining": time_remaining,
    }))
}

fn parse_network() -> Vec<Value> {
    let output = sh_run("netstat", &["-ib"]).unwrap_or_default();
    let mut results = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for line in output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 7 {
            let name = parts[0];
            if name == "lo0" || seen.contains(name) {
                continue;
            }
            let bytes_in: u64 = parts.get(6).and_then(|s| s.parse().ok()).unwrap_or(0);
            let bytes_out: u64 = parts.get(9).and_then(|s| s.parse().ok()).unwrap_or(0);
            if bytes_in > 0 || bytes_out > 0 {
                seen.insert(name.to_string());
                results.push(serde_json::json!({
                    "interfaceName": name,
                    "bytesIn": bytes_in,
                    "bytesOut": bytes_out,
                }));
            }
        }
    }
    results
}

fn parse_top_processes() -> Vec<Value> {
    let output = sh_run("ps", &["aux"]).unwrap_or_default();
    let mut procs: Vec<(f64, Value)> = Vec::new();

    for line in output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 11 {
            let pid: u32 = parts[1].parse().unwrap_or(0);
            let cpu: f64 = parts[2].parse().unwrap_or(0.0);
            let mem_mb: f64 = parts[5].parse::<f64>().unwrap_or(0.0) / 1024.0;
            let name = parts[10..].join(" ");
            let short_name = name
                .split('/')
                .last()
                .unwrap_or(&name)
                .split_whitespace()
                .next()
                .unwrap_or(&name);

            procs.push((
                cpu,
                serde_json::json!({
                    "pid": pid,
                    "name": short_name,
                    "cpuPercent": cpu,
                    "memoryMB": (mem_mb * 10.0).round() / 10.0,
                }),
            ));
        }
    }

    procs.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    procs.truncate(10);
    procs.into_iter().map(|(_, v)| v).collect()
}

// ---------------------------------------------------------------------------
// Accessibility commands (macOS-specific)
// ---------------------------------------------------------------------------

/// Check if accessibility permission is granted
#[tauri::command]
pub async fn ax_is_trusted() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let trusted = crate::accessibility::is_trusted();
        Ok(serde_json::json!({ "trusted": trusted }))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(serde_json::json!({ "trusted": false, "reason": "not macOS" }))
    }
}

/// Prompt user to grant accessibility permission
#[tauri::command]
pub async fn ax_prompt_trust() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let trusted = crate::accessibility::prompt_trust();
        Ok(serde_json::json!({ "trusted": trusted }))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(serde_json::json!({ "trusted": false }))
    }
}

/// Get info about the frontmost application
#[tauri::command]
pub async fn ax_get_frontmost_app() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::get_frontmost_app()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Not supported on this platform".to_string())
    }
}

/// Get the UI element tree of the frontmost app's focused window
#[tauri::command]
pub async fn ax_get_ui_tree(
    pid: Option<i32>,
    max_depth: Option<u32>,
    compact: Option<bool>,
) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::get_ui_tree(pid, max_depth.unwrap_or(5), compact.unwrap_or(false))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (pid, max_depth, compact);
        Err("Not supported on this platform".to_string())
    }
}

/// Get the currently focused UI element
#[tauri::command]
pub async fn ax_get_focused_element(pid: Option<i32>) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::get_focused_element(pid)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = pid;
        Err("Not supported on this platform".to_string())
    }
}

/// Get attribute names of the focused element
#[tauri::command]
pub async fn ax_get_attributes(pid: Option<i32>) -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::get_element_attributes(pid)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = pid;
        Err("Not supported on this platform".to_string())
    }
}

/// Perform action on focused element (AXPress, AXConfirm, AXCancel, etc.)
#[tauri::command]
pub async fn ax_perform_action(pid: Option<i32>, action: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::perform_action_on_focused(pid, &action)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (pid, action);
        Err("Not supported on this platform".to_string())
    }
}

/// Set value on focused element (e.g., text in a text field)
#[tauri::command]
pub async fn ax_set_value(pid: Option<i32>, value: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::set_value_on_focused(pid, &value)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (pid, value);
        Err("Not supported on this platform".to_string())
    }
}

/// Get element at screen position
#[tauri::command]
pub async fn ax_get_element_at_position(
    pid: Option<i32>,
    x: f32,
    y: f32,
) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::get_element_at_position(pid, x, y)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (pid, x, y);
        Err("Not supported on this platform".to_string())
    }
}

/// List all visible applications with windows
#[tauri::command]
pub async fn ax_list_apps() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        crate::accessibility::list_apps_with_windows()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Not supported on this platform".to_string())
    }
}

// ---------------------------------------------------------------------------
// Finder integration commands (macOS)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn finder_is_installed() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        Ok(crate::finder::is_installed())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub async fn finder_install() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::finder::install()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Finder integration is only available on macOS".to_string())
    }
}

#[tauri::command]
pub async fn finder_uninstall() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::finder::uninstall()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Finder integration is only available on macOS".to_string())
    }
}

#[tauri::command]
pub async fn finder_check_pending(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(action) = crate::finder::consume_pending_action() {
            let _ = app.emit("finder:action", serde_json::to_value(&action).unwrap());
        }
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// File Tags & Spotlight commands (macOS-specific)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn file_tags_get(path: String) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let tags = crate::spotlight::get_finder_tags(&path)?;
        let comment = crate::spotlight::get_spotlight_comment(&path).unwrap_or_default();
        let agentx_meta = crate::spotlight::get_agentx_metadata(&path).unwrap_or(None);
        Ok(serde_json::json!({
            "tags": tags,
            "comment": comment,
            "agentxAnalysis": agentx_meta.and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        }))
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Ok(serde_json::json!({ "tags": [], "comment": "", "agentxAnalysis": null }))
    }
}

#[tauri::command]
pub async fn file_tags_set(path: String, tags: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::spotlight::set_finder_tags(&path, &tags)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (path, tags);
        Ok(())
    }
}

#[tauri::command]
pub async fn file_tags_set_comment(path: String, comment: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::spotlight::set_spotlight_comment(&path, &comment)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (path, comment);
        Ok(())
    }
}

#[tauri::command]
pub async fn file_tags_get_metadata(path: String) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        crate::spotlight::get_file_metadata(&path)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Ok(serde_json::json!({}))
    }
}

#[tauri::command]
pub async fn file_tags_analyze(
    state: State<'_, SidecarState>,
    path: String,
) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    let metadata = crate::spotlight::get_file_metadata(&path).unwrap_or(serde_json::json!({}));
    #[cfg(not(target_os = "macos"))]
    let metadata = serde_json::json!({});

    let content_preview = match tokio::fs::read(&path).await {
        Ok(bytes) => {
            let text = String::from_utf8_lossy(&bytes[..bytes.len().min(4096)]);
            text.to_string()
        }
        Err(_) => String::new(),
    };

    let result = sidecar_call(
        &state,
        "fileTags:analyze",
        serde_json::json!([path, content_preview, metadata]),
    )
    .await?;

    #[cfg(target_os = "macos")]
    {
        if let Some(analysis) = result.as_object() {
            let json_str = serde_json::to_string(analysis).unwrap_or_default();
            let _ = crate::spotlight::set_agentx_metadata(&path, &json_str);

            if let Some(tags) = analysis.get("tags").and_then(|t| t.as_array()) {
                let tag_strings: Vec<String> = tags
                    .iter()
                    .filter_map(|t| t.as_str().map(|s| s.to_string()))
                    .collect();
                if !tag_strings.is_empty() {
                    let _ = crate::spotlight::set_finder_tags(&path, &tag_strings);
                }
            }

            if let Some(summary) = analysis.get("summary").and_then(|s| s.as_str()) {
                let _ = crate::spotlight::set_spotlight_comment(&path, summary);
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn file_tags_analyze_batch(
    state: State<'_, SidecarState>,
    paths: Vec<String>,
) -> Result<Value, String> {
    let mut results = serde_json::Map::new();
    for path in &paths {
        match file_tags_analyze_single(&state, path).await {
            Ok(val) => {
                results.insert(path.clone(), val);
            }
            Err(e) => {
                results.insert(path.clone(), serde_json::json!({ "error": e }));
            }
        }
    }
    Ok(Value::Object(results))
}

async fn file_tags_analyze_single(
    state: &State<'_, SidecarState>,
    path: &str,
) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    let metadata = crate::spotlight::get_file_metadata(path).unwrap_or(serde_json::json!({}));
    #[cfg(not(target_os = "macos"))]
    let metadata = serde_json::json!({});

    let content_preview = match tokio::fs::read(path).await {
        Ok(bytes) => {
            let text = String::from_utf8_lossy(&bytes[..bytes.len().min(4096)]);
            text.to_string()
        }
        Err(_) => String::new(),
    };

    let result = sidecar_call(
        state,
        "fileTags:analyze",
        serde_json::json!([path, content_preview, metadata]),
    )
    .await?;

    #[cfg(target_os = "macos")]
    {
        if let Some(analysis) = result.as_object() {
            let json_str = serde_json::to_string(analysis).unwrap_or_default();
            let _ = crate::spotlight::set_agentx_metadata(path, &json_str);

            if let Some(tags) = analysis.get("tags").and_then(|t| t.as_array()) {
                let tag_strings: Vec<String> = tags
                    .iter()
                    .filter_map(|t| t.as_str().map(|s| s.to_string()))
                    .collect();
                if !tag_strings.is_empty() {
                    let _ = crate::spotlight::set_finder_tags(path, &tag_strings);
                }
            }

            if let Some(summary) = analysis.get("summary").and_then(|s| s.as_str()) {
                let _ = crate::spotlight::set_spotlight_comment(path, summary);
            }
        }
    }

    Ok(result)
}

// ---------------------------------------------------------------------------
// Drop content detection command
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn detect_drop_content_type(
    text: Option<String>,
    file_paths: Option<Vec<String>>,
    html: Option<String>,
) -> Result<Value, String> {
    let mut content_type = "unknown";
    let mut actions: Vec<&str> = vec![];
    let mut detected_info = serde_json::Map::new();

    if let Some(ref paths) = file_paths {
        if !paths.is_empty() {
            content_type = "files";
            detected_info.insert("fileCount".to_string(), serde_json::json!(paths.len()));

            let mut has_images = false;
            let mut has_code = false;
            let mut has_docs = false;
            for p in paths {
                let ext = p.rsplit('.').next().unwrap_or("").to_lowercase();
                match ext.as_str() {
                    "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "svg" => has_images = true,
                    "rs" | "ts" | "js" | "tsx" | "jsx" | "py" | "go" | "java" | "c" | "cpp"
                    | "h" | "swift" | "kt" | "rb" | "php" | "sh" | "bash" | "zsh" | "css"
                    | "scss" | "html" | "vue" | "svelte" => has_code = true,
                    "md" | "txt" | "doc" | "docx" | "pdf" | "rtf" => has_docs = true,
                    _ => {}
                }
            }
            detected_info.insert("hasImages".to_string(), serde_json::json!(has_images));
            detected_info.insert("hasCode".to_string(), serde_json::json!(has_code));
            detected_info.insert("hasDocs".to_string(), serde_json::json!(has_docs));

            if has_images {
                actions.extend_from_slice(&["describe", "edit", "analyze", "tag"]);
            }
            if has_code {
                actions.extend_from_slice(&["explain", "optimize", "review", "tag"]);
            }
            if has_docs {
                actions.extend_from_slice(&["summarize", "translate", "tag"]);
            }
            if !actions.contains(&"tag") {
                actions.push("tag");
            }
        }
    }

    if let Some(ref text_content) = text {
        let trimmed = text_content.trim();
        if !trimmed.is_empty() && content_type == "unknown" {
            if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
                content_type = "url";
                detected_info.insert("url".to_string(), serde_json::json!(trimmed));
                actions = vec!["summarize", "fetch", "bookmark", "analyze"];
            } else if looks_like_code(trimmed) {
                content_type = "code";
                actions = vec!["explain", "optimize", "debug", "convert"];
            } else {
                content_type = "text";
                let word_count = trimmed.split_whitespace().count();
                detected_info.insert("wordCount".to_string(), serde_json::json!(word_count));
                if word_count > 50 {
                    actions = vec!["summarize", "translate", "rewrite", "analyze"];
                } else {
                    actions = vec!["explain", "translate", "expand", "analyze"];
                }
            }
        }
    }

    if let Some(ref html_content) = html {
        if !html_content.trim().is_empty() && content_type == "unknown" {
            content_type = "html";
            actions = vec!["extract_text", "summarize", "analyze"];
        }
    }

    Ok(serde_json::json!({
        "contentType": content_type,
        "actions": actions,
        "info": detected_info,
    }))
}

fn looks_like_code(text: &str) -> bool {
    let code_indicators = [
        "function ", "const ", "let ", "var ", "import ", "export ", "class ", "def ", "fn ",
        "pub ", "if ", "for ", "while ", "return ", "async ", "await ", "=>", "->", "::", "&&",
        "||", "struct ", "enum ", "impl ", "trait ", "interface ", "#include", "#import",
        "package ", "using ",
    ];
    let indicator_count = code_indicators
        .iter()
        .filter(|&&ind| text.contains(ind))
        .count();
    indicator_count >= 2
        || (text.contains('{') && text.contains('}'))
        || (text.contains('(') && text.contains(')') && text.contains(';'))
}

// ---------------------------------------------------------------------------
// Helper: macOS permission status check
// ---------------------------------------------------------------------------

/// Check a single permission status.
///
/// **Important platform notes (macOS Sequoia / development builds):**
///
/// - **Screen recording**: `CGPreflightScreenCaptureAccess()` is the most
///   reliable API. On Sequoia, the old window-list heuristic (checking
///   `kCGWindowName` on foreign windows) no longer works — window names are
///   always visible regardless of screen-recording permission.
///
/// - **Accessibility**: `AXIsProcessTrusted()` checks the *responsible
///   process*, not necessarily the current binary. When running via `cargo
///   tauri dev` from a terminal that already has Accessibility permission,
///   `AXIsProcessTrusted()` returns `true` even if the dev binary itself
///   has no TCC entry. This is correct for functional purposes (the app
///   CAN use the AX API), but may confuse users who remove the binary from
///   System Settings and expect the status to change. In production .app
///   bundles this is not an issue since the bundle has its own identity.
// ---------------------------------------------------------------------------
// Out-of-process permission checker (avoids in-process TCC API caching)
// ---------------------------------------------------------------------------

/// Swift source for the permission helper binary.
/// This runs as a child of AgentX.app so macOS attributes TCC checks to AgentX.
#[cfg(target_os = "macos")]
const PERMISSION_CHECKER_SWIFT: &str = r#"
import Foundation
import Cocoa
import CoreGraphics
import AVFoundation

var r: [String: String] = [:]

r["accessibility"] = AXIsProcessTrusted() ? "granted" : "denied"
r["screen"] = CGPreflightScreenCaptureAccess() ? "granted" : "denied"

switch AVCaptureDevice.authorizationStatus(for: .audio) {
case .authorized: r["microphone"] = "granted"
case .denied: r["microphone"] = "denied"
case .restricted: r["microphone"] = "restricted"
case .notDetermined: r["microphone"] = "not-determined"
@unknown default: r["microphone"] = "unknown"
}

switch AVCaptureDevice.authorizationStatus(for: .video) {
case .authorized: r["camera"] = "granted"
case .denied: r["camera"] = "denied"
case .restricted: r["camera"] = "restricted"
case .notDetermined: r["camera"] = "not-determined"
@unknown default: r["camera"] = "unknown"
}

let data = try! JSONSerialization.data(withJSONObject: r)
FileHandle.standardOutput.write(data)
"#;

/// Get the path for the cached permission checker binary.
#[cfg(target_os = "macos")]
fn permission_checker_binary_path() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let cache_dir = std::path::PathBuf::from(home)
        .join("Library/Caches/com.agentx.desktop");
    std::fs::create_dir_all(&cache_dir).ok();
    cache_dir.join("permission_checker")
}

/// Compile the swift permission checker if it doesn't exist or is outdated.
/// Returns the path to the compiled binary, or None if compilation fails.
#[cfg(target_os = "macos")]
fn ensure_permission_checker() -> Option<std::path::PathBuf> {
    let binary_path = permission_checker_binary_path();
    let hash_path = binary_path.with_extension("hash");

    // Simple cache key: hash of the swift source
    let source_hash = format!("{:x}", {
        let mut h: u64 = 0;
        for b in PERMISSION_CHECKER_SWIFT.bytes() {
            h = h.wrapping_mul(31).wrapping_add(b as u64);
        }
        h
    });

    // Check if we already have a valid binary
    if binary_path.exists() {
        if let Ok(cached_hash) = std::fs::read_to_string(&hash_path) {
            if cached_hash.trim() == source_hash {
                return Some(binary_path);
            }
        }
    }

    eprintln!("[Permissions] Compiling permission checker helper...");

    // Write swift source to temp file
    let swift_path = binary_path.with_extension("swift");
    if std::fs::write(&swift_path, PERMISSION_CHECKER_SWIFT).is_err() {
        return None;
    }

    // Compile with swiftc
    let output = std::process::Command::new("swiftc")
        .args([
            "-O",
            "-framework", "CoreGraphics",
            "-framework", "AVFoundation",
            swift_path.to_str()?,
            "-o",
            binary_path.to_str()?,
        ])
        .stderr(std::process::Stdio::piped())
        .output()
        .ok()?;

    std::fs::remove_file(&swift_path).ok();

    if output.status.success() {
        std::fs::write(&hash_path, &source_hash).ok();
        eprintln!("[Permissions] Permission checker compiled successfully");
        Some(binary_path)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[Permissions] swiftc failed: {}", stderr);
        None
    }
}

/// Run the out-of-process permission checker and return parsed results.
/// Returns None if the helper isn't available or fails.
#[cfg(target_os = "macos")]
fn check_permissions_out_of_process() -> Option<std::collections::HashMap<String, String>> {
    let binary = ensure_permission_checker()?;

    let output = std::process::Command::new(&binary)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .ok()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[Permissions] helper failed: {}", stderr);
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    eprintln!("[Permissions] helper output: {}", stdout.trim());

    let parsed: std::collections::HashMap<String, String> =
        serde_json::from_str(stdout.trim()).ok()?;
    Some(parsed)
}

/// Query TCC databases directly via sqlite3 for a specific service and client.
/// Checks BOTH the user TCC.db and system TCC.db (both are readable on Sequoia).
/// Returns Some("granted"), Some("denied"), or None if no entry / query failed.
///
/// auth_value meanings: 0=denied, 2=allowed, 3=limited, 4=provisional
/// Some services (e.g. FDA) are in the SYSTEM TCC.db, others (e.g. automation)
/// are in the USER TCC.db. We check both for robustness.
#[cfg(target_os = "macos")]
fn query_tcc_database(service: &str, client: &str) -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let user_tcc = format!("{}/Library/Application Support/com.apple.TCC/TCC.db", home);
    let system_tcc = "/Library/Application Support/com.apple.TCC/TCC.db".to_string();

    // For AppleEvents (automation), the query needs to match the indirect_object too
    // but we just want to know if ANY automation entry exists for this client
    let sql = format!(
        "SELECT auth_value FROM access WHERE service='{}' AND client='{}'",
        service, client
    );

    for (label, tcc_path) in [("user", &user_tcc), ("system", &system_tcc)] {
        let output = std::process::Command::new("sqlite3")
            .args([tcc_path.as_str(), &sql])
            .output();

        if let Ok(o) = output {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let trimmed = stdout.trim();
            if !trimmed.is_empty() {
                eprintln!(
                    "[Permissions] TCC {} DB: service={}, client={}, auth_value='{}'",
                    label, service, client, trimmed
                );
                // May have multiple rows (e.g. multiple automation targets).
                // If ANY row has auth_value=2, consider it granted.
                for line in trimmed.lines() {
                    match line.trim() {
                        "2" | "3" | "4" => return Some("granted".to_string()),
                        _ => {}
                    }
                }
                // All entries had auth_value != 2/3/4 — check for explicit deny
                for line in trimmed.lines() {
                    if line.trim() == "0" {
                        return Some("denied".to_string());
                    }
                }
            }
        }
    }

    eprintln!(
        "[Permissions] TCC DB: no entry for service={}, client={}",
        service, client
    );
    None // No entry in either database
}

/// In-process fallback for when the out-of-process helper is unavailable.
#[cfg(target_os = "macos")]
fn check_permission_status_inprocess(perm_type: &str) -> String {
    match perm_type {
        "accessibility" => {
            let trusted = crate::accessibility::is_trusted();
            if trusted { "granted" } else { "denied" }.to_string()
        }
        "screen" => {
            extern "C" {
                fn CGPreflightScreenCaptureAccess() -> bool;
            }
            let ok = unsafe { CGPreflightScreenCaptureAccess() };
            if ok { "granted" } else { "denied" }.to_string()
        }
        "microphone" => check_av_capture_status(false),
        "camera" => check_av_capture_status(true),
        "full-disk-access" => {
            // On macOS Sequoia, non-sandboxed apps can read most "protected" files
            // without FDA — filesystem probing gives false positives.
            // Instead, query the TCC database directly for our app's FDA entry.
            // FDA entries are stored in the SYSTEM TCC.db under
            // kTCCServiceSystemPolicyAllFiles.
            let tcc_status = query_tcc_database(
                "kTCCServiceSystemPolicyAllFiles",
                "com.agentx.desktop",
            );
            eprintln!("[Permissions] FDA TCC DB query = {:?}", tcc_status);
            match tcc_status.as_deref() {
                Some("granted") => "granted".to_string(),
                Some("denied") => "denied".to_string(),
                _ => "not-determined".to_string(),
            }
        }
        "automation" => {
            // First check the user TCC database for an explicit entry.
            // AEDeterminePermissionToAutomateTarget can return false positives
            // for ad-hoc signed apps on Sequoia.
            let tcc_status = query_tcc_database("kTCCServiceAppleEvents", "com.agentx.desktop");
            eprintln!("[Permissions] automation TCC DB query = {:?}", tcc_status);
            match tcc_status.as_deref() {
                Some("granted") => "granted".to_string(),
                Some("denied") => "denied".to_string(),
                _ => {
                    // No TCC entry — fall back to API check
                    let api_status = check_automation_permission(false);
                    eprintln!("[Permissions] automation API fallback = {}", api_status);
                    // If API says granted but TCC has no entry, treat as not-determined
                    // (the API can give false positives for ad-hoc signed apps)
                    if api_status == "granted" {
                        "not-determined".to_string()
                    } else {
                        api_status
                    }
                }
            }
        }
        "notifications" => {
            if check_ncprefs_has_agentx() {
                "granted".to_string()
            } else {
                let api_status = check_notification_status();
                if api_status == "granted" { "not-determined".to_string() } else { api_status }
            }
        }
        _ => "unknown".to_string(),
    }
}

/// Primary permission check — uses out-of-process helper for accuracy,
/// falls back to in-process checks if the helper isn't available.
#[cfg(target_os = "macos")]
fn check_permission_status(perm_type: &str) -> String {
    // Try out-of-process first for cache-free accuracy
    if let Some(results) = check_permissions_out_of_process() {
        if let Some(status) = results.get(perm_type) {
            eprintln!("[Permissions] {} = {} (out-of-process)", perm_type, status);
            return status.clone();
        }
    }
    // Fallback to in-process
    let status = check_permission_status_inprocess(perm_type);
    eprintln!("[Permissions] {} = {} (in-process fallback)", perm_type, status);
    status
}

/// Check microphone / camera via AVFoundation **in-process** using objc runtime.
/// AVAuthorizationStatus: 0=notDetermined, 1=restricted, 2=denied, 3=authorized
#[cfg(target_os = "macos")]
fn check_av_capture_status(is_video: bool) -> String {
    use std::ffi::CStr;

    // AVMediaTypeAudio / AVMediaTypeVideo are NSString constants exported by AVFoundation.
    // We load them at runtime via dlsym to avoid linking AVFoundation directly.
    extern "C" {
        fn dlopen(path: *const std::ffi::c_char, mode: i32) -> *mut std::ffi::c_void;
        fn dlsym(handle: *mut std::ffi::c_void, symbol: *const std::ffi::c_char) -> *mut std::ffi::c_void;
    }
    const RTLD_LAZY: i32 = 0x1;

    unsafe {
        // Load AVFoundation framework
        let fw_path = CStr::from_bytes_with_nul_unchecked(
            b"/System/Library/Frameworks/AVFoundation.framework/AVFoundation\0"
        );
        let handle = dlopen(fw_path.as_ptr(), RTLD_LAZY);
        if handle.is_null() {
            eprintln!("[Permissions] Failed to load AVFoundation");
            return "unknown".to_string();
        }

        // Get the media type NSString constant
        let sym_name = if is_video {
            CStr::from_bytes_with_nul_unchecked(b"AVMediaTypeVideo\0")
        } else {
            CStr::from_bytes_with_nul_unchecked(b"AVMediaTypeAudio\0")
        };
        let sym_ptr = dlsym(handle, sym_name.as_ptr());
        if sym_ptr.is_null() {
            eprintln!("[Permissions] Failed to find {:?}", sym_name);
            return "unknown".to_string();
        }
        // sym_ptr is a pointer to an NSString* — dereference to get the NSString*
        let media_type: *const std::ffi::c_void = *(sym_ptr as *const *const std::ffi::c_void);

        // Call [AVCaptureDevice authorizationStatusForMediaType:]
        let cls_name = CStr::from_bytes_with_nul_unchecked(b"AVCaptureDevice\0");
        let cls: *const std::ffi::c_void = objc2::runtime::AnyClass::get(cls_name)
            .map(|c| c as *const _ as *const std::ffi::c_void)
            .unwrap_or(std::ptr::null());

        if cls.is_null() {
            eprintln!("[Permissions] AVCaptureDevice class not found");
            return "unknown".to_string();
        }

        let sel = objc2::sel!(authorizationStatusForMediaType:);
        let status: isize = objc2::msg_send![
            cls as *const objc2::runtime::AnyClass,
            authorizationStatusForMediaType: media_type
        ];

        let label = if is_video { "camera" } else { "microphone" };
        eprintln!("[Permissions] {} authorizationStatus = {}", label, status);

        match status {
            3 => "granted".to_string(),
            2 => "denied".to_string(),
            1 => "restricted".to_string(),
            0 => "not-determined".to_string(),
            _ => "unknown".to_string(),
        }
    }
}

/// Request microphone/camera access in-process via objc runtime.
/// Calls [AVCaptureDevice requestAccessForMediaType:completionHandler:]
/// and waits for the result using dispatch_semaphore.
#[cfg(target_os = "macos")]
fn request_av_capture_access(is_video: bool) -> bool {
    use std::ffi::CStr;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    extern "C" {
        fn dlopen(path: *const std::ffi::c_char, mode: i32) -> *mut std::ffi::c_void;
        fn dlsym(handle: *mut std::ffi::c_void, symbol: *const std::ffi::c_char) -> *mut std::ffi::c_void;
        fn dispatch_semaphore_create(value: isize) -> *mut std::ffi::c_void;
        fn dispatch_semaphore_signal(dsema: *mut std::ffi::c_void) -> isize;
        fn dispatch_semaphore_wait(dsema: *mut std::ffi::c_void, timeout: u64) -> isize;
    }
    const RTLD_LAZY: i32 = 0x1;
    const DISPATCH_TIME_FOREVER: u64 = !0;

    unsafe {
        // Load AVFoundation
        let fw_path = CStr::from_bytes_with_nul_unchecked(
            b"/System/Library/Frameworks/AVFoundation.framework/AVFoundation\0"
        );
        let handle = dlopen(fw_path.as_ptr(), RTLD_LAZY);
        if handle.is_null() { return false; }

        // Get media type constant
        let sym_name = if is_video {
            CStr::from_bytes_with_nul_unchecked(b"AVMediaTypeVideo\0")
        } else {
            CStr::from_bytes_with_nul_unchecked(b"AVMediaTypeAudio\0")
        };
        let sym_ptr = dlsym(handle, sym_name.as_ptr());
        if sym_ptr.is_null() { return false; }
        let media_type: *const std::ffi::c_void = *(sym_ptr as *const *const std::ffi::c_void);

        // Get AVCaptureDevice class
        let cls_name = CStr::from_bytes_with_nul_unchecked(b"AVCaptureDevice\0");
        let cls = match objc2::runtime::AnyClass::get(cls_name) {
            Some(c) => c,
            None => return false,
        };

        // Create semaphore and result flag
        let sema = dispatch_semaphore_create(0);
        let result = Arc::new(AtomicBool::new(false));
        let result_clone = result.clone();
        let sema_raw = sema as usize; // convert to usize for Send

        // Build the completion handler block
        // ObjC BOOL is objc2::runtime::Bool
        let block = block2::RcBlock::new(move |granted: objc2::runtime::Bool| {
            result_clone.store(granted.as_bool(), Ordering::SeqCst);
            dispatch_semaphore_signal(sema_raw as *mut std::ffi::c_void);
        });

        // Call [AVCaptureDevice requestAccessForMediaType:completionHandler:]
        let _: () = objc2::msg_send![
            cls,
            requestAccessForMediaType: media_type,
            completionHandler: &*block
        ];

        // Wait for completion
        dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);

        let granted = result.load(Ordering::SeqCst);
        let label = if is_video { "camera" } else { "microphone" };
        eprintln!("[Permissions] {} requestAccess = {}", label, granted);
        granted
    }
}

/// Check notification permission status via UNUserNotificationCenter.
/// UNAuthorizationStatus: 0=notDetermined, 1=denied, 2=authorized, 3=provisional, 4=ephemeral
#[cfg(target_os = "macos")]
fn check_notification_status() -> String {
    use std::ffi::CStr;
    use std::sync::atomic::{AtomicI64, Ordering};
    use std::sync::Arc;

    extern "C" {
        fn dlopen(path: *const std::ffi::c_char, mode: i32) -> *mut std::ffi::c_void;
        fn dispatch_semaphore_create(value: isize) -> *mut std::ffi::c_void;
        fn dispatch_semaphore_signal(dsema: *mut std::ffi::c_void) -> isize;
        fn dispatch_semaphore_wait(dsema: *mut std::ffi::c_void, timeout: u64) -> isize;
    }
    const RTLD_LAZY: i32 = 0x1;
    const DISPATCH_TIME_FOREVER: u64 = !0;

    unsafe {
        // Load UserNotifications framework
        let fw_path = CStr::from_bytes_with_nul_unchecked(
            b"/System/Library/Frameworks/UserNotifications.framework/UserNotifications\0"
        );
        dlopen(fw_path.as_ptr(), RTLD_LAZY);

        let cls = match objc2::runtime::AnyClass::get(
            CStr::from_bytes_with_nul_unchecked(b"UNUserNotificationCenter\0"),
        ) {
            Some(c) => c,
            None => {
                eprintln!("[Permissions] UNUserNotificationCenter class not found");
                return "unknown".to_string();
            }
        };
        let center: *mut objc2::runtime::AnyObject = objc2::msg_send![cls, currentNotificationCenter];
        if center.is_null() {
            return "unknown".to_string();
        }

        let sema = dispatch_semaphore_create(0);
        let status_val = Arc::new(AtomicI64::new(-1));
        let status_clone = status_val.clone();
        let sema_raw = sema as usize;

        // Build completion handler: ^(UNNotificationSettings *settings) { ... }
        let block = block2::RcBlock::new(move |settings: *mut objc2::runtime::AnyObject| {
            if !settings.is_null() {
                let auth_status: isize = objc2::msg_send![settings, authorizationStatus];
                status_clone.store(auth_status as i64, Ordering::SeqCst);
            }
            dispatch_semaphore_signal(sema_raw as *mut std::ffi::c_void);
        });

        // [center getNotificationSettingsWithCompletionHandler:]
        let _: () = objc2::msg_send![center, getNotificationSettingsWithCompletionHandler: &*block];

        dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);

        let status = status_val.load(Ordering::SeqCst);
        eprintln!("[Permissions] notifications authorizationStatus = {}", status);

        match status {
            2 | 3 | 4 => "granted".to_string(),  // authorized, provisional, ephemeral
            1 => "denied".to_string(),
            0 => "not-determined".to_string(),
            _ => "unknown".to_string(),
        }
    }
}

/// Check if com.agentx.desktop has an authorized entry in ncprefs.plist.
#[cfg(target_os = "macos")]
fn check_ncprefs_has_agentx() -> bool {
    let home = std::env::var("HOME").unwrap_or_default();
    let plist_path = format!("{}/Library/Preferences/com.apple.ncprefs.plist", home);

    // Use plutil to convert to XML, then grep for our bundle-id.
    // plutil -convert json fails on binary data fields, but xml1 works fine.
    let output = std::process::Command::new("/usr/bin/plutil")
        .args(["-convert", "xml1", "-o", "-", &plist_path])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            let xml = String::from_utf8_lossy(&o.stdout);
            let found = xml.contains("com.agentx.desktop");
            eprintln!("[Permissions] ncprefs check: agentx found = {}", found);
            found
        }
        _ => {
            eprintln!("[Permissions] ncprefs check: plutil failed");
            false
        }
    }
}

/// Request notification permission via UNUserNotificationCenter.requestAuthorization.
/// Explicitly loads UserNotifications framework to ensure the class is available.
#[cfg(target_os = "macos")]
fn request_notification_access() -> bool {
    use std::ffi::CStr;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    extern "C" {
        fn dlopen(path: *const std::ffi::c_char, mode: i32) -> *mut std::ffi::c_void;
        fn dispatch_semaphore_create(value: isize) -> *mut std::ffi::c_void;
        fn dispatch_semaphore_signal(dsema: *mut std::ffi::c_void) -> isize;
        fn dispatch_semaphore_wait(dsema: *mut std::ffi::c_void, timeout: u64) -> isize;
    }
    const RTLD_LAZY: i32 = 0x1;
    const DISPATCH_TIME_FOREVER: u64 = !0;

    unsafe {
        // Load UserNotifications framework (required for UNUserNotificationCenter)
        let fw_path = CStr::from_bytes_with_nul_unchecked(
            b"/System/Library/Frameworks/UserNotifications.framework/UserNotifications\0"
        );
        let handle = dlopen(fw_path.as_ptr(), RTLD_LAZY);
        if handle.is_null() {
            eprintln!("[Permissions] Failed to load UserNotifications framework");
            return false;
        }
        eprintln!("[Permissions] UserNotifications framework loaded");

        let cls = match objc2::runtime::AnyClass::get(
            CStr::from_bytes_with_nul_unchecked(b"UNUserNotificationCenter\0"),
        ) {
            Some(c) => c,
            None => {
                eprintln!("[Permissions] UNUserNotificationCenter class not found");
                return false;
            }
        };
        eprintln!("[Permissions] UNUserNotificationCenter class found");

        let center: *mut objc2::runtime::AnyObject =
            objc2::msg_send![cls, currentNotificationCenter];
        if center.is_null() {
            eprintln!("[Permissions] currentNotificationCenter returned nil");
            return false;
        }
        eprintln!("[Permissions] Got notification center, calling requestAuthorization...");

        let sema = dispatch_semaphore_create(0);
        let result = Arc::new(AtomicBool::new(false));
        let result_clone = result.clone();
        let sema_raw = sema as usize;

        // UNAuthorizationOptionAlert | UNAuthorizationOptionSound | UNAuthorizationOptionBadge
        let options: usize = (1 << 0) | (1 << 1) | (1 << 2);

        let block = block2::RcBlock::new(
            move |granted: objc2::runtime::Bool,
                  error: *mut objc2::runtime::AnyObject| {
                let g = granted.as_bool();
                eprintln!(
                    "[Permissions] requestAuthorization callback: granted={}, error_null={}",
                    g,
                    error.is_null()
                );
                result_clone.store(g, Ordering::SeqCst);
                dispatch_semaphore_signal(sema_raw as *mut std::ffi::c_void);
            },
        );

        // [center requestAuthorizationWithOptions:completionHandler:]
        let _: () = objc2::msg_send![
            center,
            requestAuthorizationWithOptions: options,
            completionHandler: &*block
        ];

        dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
        let granted = result.load(Ordering::SeqCst);
        eprintln!("[Permissions] requestAuthorization result: {}", granted);
        granted
    }
}

/// Check or request automation permission using AEDeterminePermissionToAutomateTarget.
/// When `ask_user` is false, checks silently (no TCC dialog).
/// When `ask_user` is true, triggers the TCC dialog if status is not-determined.
#[cfg(target_os = "macos")]
fn check_automation_permission(ask_user: bool) -> String {
    // Apple's AEDesc uses mac68k alignment (#pragma options align=mac68k),
    // which means max 2-byte alignment. Without packed(2), Rust would add
    // 4 bytes of padding between the u32 and the pointer, making the struct
    // 16 bytes instead of the correct 12 bytes. This layout mismatch causes
    // AEDeterminePermissionToAutomateTarget to read garbage data.
    #[repr(C, packed(2))]
    struct AEDesc {
        descriptor_type: u32,
        data_handle: *mut std::ffi::c_void,
    }

    extern "C" {
        fn AECreateDesc(
            type_code: u32,
            data_ptr: *const std::ffi::c_void,
            data_size: usize,
            result: *mut AEDesc,
        ) -> i16; // OSErr is i16, not i32
        fn AEDisposeDesc(desc: *mut AEDesc) -> i16;
        fn AEDeterminePermissionToAutomateTarget(
            target: *const AEDesc,
            the_ae_event_class: u32,
            the_ae_event_id: u32,
            ask_user_if_needed: u8,
        ) -> i32; // OSStatus is i32
    }

    // typeApplicationBundleID = 'bund'
    const TYPE_APP_BUNDLE_ID: u32 = u32::from_be_bytes(*b"bund");
    // kCoreEventClass = 'aevt'
    const K_CORE_EVENT_CLASS: u32 = u32::from_be_bytes(*b"aevt");
    // kAEOpenApplication = 'oapp'
    const K_AE_OPEN_APP: u32 = u32::from_be_bytes(*b"oapp");

    let bundle_id = b"com.apple.systemevents";

    unsafe {
        let mut target = AEDesc {
            descriptor_type: 0,
            data_handle: std::ptr::null_mut(),
        };

        let err = AECreateDesc(
            TYPE_APP_BUNDLE_ID,
            bundle_id.as_ptr() as *const std::ffi::c_void,
            bundle_id.len(),
            &mut target,
        );
        eprintln!("[Permissions] AECreateDesc = {}, sizeof(AEDesc) = {}", err, std::mem::size_of::<AEDesc>());
        if err != 0 {
            eprintln!("[Permissions] AECreateDesc failed: {}", err);
            return "unknown".to_string();
        }

        let result = AEDeterminePermissionToAutomateTarget(
            &target,
            K_CORE_EVENT_CLASS,
            K_AE_OPEN_APP,
            if ask_user { 1 } else { 0 },
        );

        AEDisposeDesc(&mut target);

        eprintln!(
            "[Permissions] AEDeterminePermissionToAutomateTarget(ask={}) = {}",
            ask_user, result
        );

        match result {
            0 => "granted".to_string(),           // noErr
            -1743 => "denied".to_string(),         // errAEEventNotPermitted
            -1744 => "not-determined".to_string(),  // errAEEventWouldRequireUserConsent
            -600 => "not-determined".to_string(),   // procNotFound (target not running)
            _ => "unknown".to_string(),
        }
    }
}

// ---------------------------------------------------------------------------
/// Request notification permission on the main thread.
/// TCC dialogs on macOS require the triggering call to happen on the main thread.
/// We dispatch the requestAuthorization call to the main thread, but use a
/// background-thread semaphore for the completion handler to avoid deadlock.
#[cfg(target_os = "macos")]
fn request_notification_on_main_thread() -> bool {
    use std::ffi::CStr;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    extern "C" {
        fn dlopen(path: *const std::ffi::c_char, mode: i32) -> *mut std::ffi::c_void;
        static _dispatch_main_q: std::ffi::c_void;
        fn dispatch_async_f(
            queue: *mut std::ffi::c_void,
            context: *mut std::ffi::c_void,
            work: extern "C" fn(*mut std::ffi::c_void),
        );
        fn dispatch_semaphore_create(value: isize) -> *mut std::ffi::c_void;
        fn dispatch_semaphore_signal(dsema: *mut std::ffi::c_void) -> isize;
        fn dispatch_semaphore_wait(dsema: *mut std::ffi::c_void, timeout: u64) -> isize;
    }
    const RTLD_LAZY: i32 = 0x1;
    const DISPATCH_TIME_FOREVER: u64 = !0;

    // Shared state between main thread and this thread
    struct Ctx {
        result: Arc<AtomicBool>,
        sema: *mut std::ffi::c_void,
    }
    // Safety: we control all access via the semaphore
    unsafe impl Send for Ctx {}

    extern "C" fn do_request(ctx_ptr: *mut std::ffi::c_void) {
        extern "C" {
            fn dlopen(path: *const std::ffi::c_char, mode: i32) -> *mut std::ffi::c_void;
            fn dispatch_semaphore_signal(dsema: *mut std::ffi::c_void) -> isize;
        }

        unsafe {
            let ctx = Box::from_raw(ctx_ptr as *mut Ctx);

            // Load UserNotifications framework
            let fw_path = std::ffi::CStr::from_bytes_with_nul_unchecked(
                b"/System/Library/Frameworks/UserNotifications.framework/UserNotifications\0",
            );
            dlopen(fw_path.as_ptr(), 0x1);

            let cls = match objc2::runtime::AnyClass::get(
                std::ffi::CStr::from_bytes_with_nul_unchecked(b"UNUserNotificationCenter\0"),
            ) {
                Some(c) => c,
                None => {
                    eprintln!("[Permissions] UNUserNotificationCenter class not found (main thread)");
                    dispatch_semaphore_signal(ctx.sema);
                    return;
                }
            };

            let center: *mut objc2::runtime::AnyObject =
                objc2::msg_send![cls, currentNotificationCenter];
            if center.is_null() {
                eprintln!("[Permissions] currentNotificationCenter nil (main thread)");
                dispatch_semaphore_signal(ctx.sema);
                return;
            }

            eprintln!("[Permissions] Calling requestAuthorization on main thread...");

            let options: usize = (1 << 0) | (1 << 1) | (1 << 2); // alert|sound|badge
            let result_clone = ctx.result.clone();
            let sema_raw = ctx.sema as usize;

            let block = block2::RcBlock::new(
                move |granted: objc2::runtime::Bool,
                      _error: *mut objc2::runtime::AnyObject| {
                    let g = granted.as_bool();
                    eprintln!("[Permissions] requestAuthorization callback: granted={}", g);
                    result_clone.store(g, std::sync::atomic::Ordering::SeqCst);
                    dispatch_semaphore_signal(sema_raw as *mut std::ffi::c_void);
                },
            );

            let _: () = objc2::msg_send![
                center,
                requestAuthorizationWithOptions: options,
                completionHandler: &*block
            ];
            // Don't signal sema here — the block will do it
        }
    }

    unsafe {
        let sema = dispatch_semaphore_create(0);
        let result = Arc::new(AtomicBool::new(false));

        let ctx = Box::new(Ctx {
            result: result.clone(),
            sema,
        });

        eprintln!("[Permissions] Dispatching notification request to main thread...");
        // Use dispatch_async to avoid blocking the main thread
        // (the completion handler will signal our semaphore)
        dispatch_async_f(
            std::ptr::addr_of!(_dispatch_main_q) as *mut std::ffi::c_void,
            Box::into_raw(ctx) as *mut std::ffi::c_void,
            do_request,
        );

        // Wait on this (background) thread for the completion handler
        dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);
        result.load(Ordering::SeqCst)
    }
}

/// Post a test notification via the Tauri notification plugin.
/// This forces macOS to register the app in System Settings > Notifications.
#[cfg(target_os = "macos")]
fn post_test_notification(app: &AppHandle) {
    use tauri_plugin_notification::NotificationExt;
    match app.notification()
        .builder()
        .title("AgentX")
        .body("Notifications enabled for AgentX")
        .show()
    {
        Ok(_) => eprintln!("[Permissions] Test notification posted"),
        Err(e) => eprintln!("[Permissions] Test notification failed: {}", e),
    }
}

/// Toggle "Allow Notifications" ON for AgentX via GUI automation of System Settings.
/// Strategy: open notification settings, iterate through app buttons to find AgentX,
/// click into its detail page, then toggle the "Allow Notifications" checkbox.
#[cfg(target_os = "macos")]
fn toggle_notification_via_gui() -> bool {
    // Close System Settings first for a clean state
    let _ = std::process::Command::new("osascript")
        .args(["-e", r#"tell application "System Settings" to quit"#])
        .output();
    std::thread::sleep(std::time::Duration::from_secs(1));

    // Open System Settings > Notifications
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.Notifications-Settings.extension")
        .output();
    std::thread::sleep(std::time::Duration::from_secs(3));

    // Count the number of app buttons in the notification list
    let count_output = std::process::Command::new("osascript")
        .args(["-e", r#"
tell application "System Events"
    tell process "System Settings"
        set sa to scroll area 1 of group 1 of group 2 of splitter group 1 of group 1 of window 1
        set g3 to group 3 of sa
        return count of every button of g3
    end tell
end tell
"#])
        .output();

    let btn_count: usize = match count_output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0),
        Err(_) => 0,
    };
    eprintln!("[Permissions] notification list has {} app buttons", btn_count);

    if btn_count == 0 {
        return false;
    }

    // Iterate through each button: click it, check if it's AgentX's page,
    // toggle the switch if found, otherwise close and reopen to try next button
    for i in 1..=btn_count {
        // Click button i
        let click_script = format!(r#"
tell application "System Events"
    tell process "System Settings"
        try
            set sa to scroll area 1 of group 1 of group 2 of splitter group 1 of group 1 of window 1
            set g3 to group 3 of sa
            click button {} of g3
            delay 1.5
            -- Check if this is AgentX's detail page
            set sa2 to scroll area 1 of group 1 of group 2 of splitter group 1 of group 1 of window 1
            set mg to group 1 of sa2
            set allTexts to value of every static text of mg
            repeat with t in allTexts
                if t as text is "AgentX" then
                    -- Found AgentX! Toggle the first checkbox if OFF
                    set switches to every checkbox of mg
                    if (count of switches) > 0 then
                        set sw to item 1 of switches
                        if value of sw is 0 then
                            click sw
                            delay 0.5
                            return "toggled_on"
                        else
                            return "already_on"
                        end if
                    end if
                end if
            end repeat
            return "not_agentx"
        on error e
            return "error"
        end try
    end tell
end tell
"#, i);

        let result = std::process::Command::new("osascript")
            .args(["-e", &click_script])
            .output();

        if let Ok(o) = result {
            let out = String::from_utf8_lossy(&o.stdout).trim().to_string();
            eprintln!("[Permissions] button {}: {}", i, out);
            if out == "toggled_on" || out == "already_on" {
                return true;
            }
        }

        // Not AgentX — close and reopen Settings for next attempt
        let _ = std::process::Command::new("osascript")
            .args(["-e", r#"tell application "System Settings" to quit"#])
            .output();
        std::thread::sleep(std::time::Duration::from_millis(800));
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.Notifications-Settings.extension")
            .output();
        std::thread::sleep(std::time::Duration::from_secs(2));
    }

    eprintln!("[Permissions] AgentX not found in notification list");
    false
}

/// Revoke notification permission by removing AgentX entry from ncprefs.plist.
#[cfg(target_os = "macos")]
fn revoke_notification_via_ncprefs() -> bool {
    let home = std::env::var("HOME").unwrap_or_default();
    let script = format!(r#"
ObjC.import("Foundation");
var nsPath = $.NSString.alloc.initWithUTF8String("{home}/Library/Preferences/com.apple.ncprefs.plist");
var data = $.NSData.dataWithContentsOfFile(nsPath);
if (!data) {{ "NO_FILE"; }}
var plist = $.NSPropertyListSerialization.propertyListWithDataOptionsFormatError(data, 2, null, null);
var apps = plist.objectForKey("apps");
var removed = false;
for (var i = apps.count - 1; i >= 0; i--) {{
    var e = apps.objectAtIndex(i);
    var bid = e.objectForKey("bundle-id");
    if (bid && bid.js === "com.agentx.desktop") {{
        apps.removeObjectAtIndex(i);
        removed = true;
    }}
}}
if (removed) {{
    var out = $.NSPropertyListSerialization.dataWithPropertyListFormatOptionsError(plist, 200, 0, null);
    out.writeToFileAtomically(nsPath, true);
}}
removed ? "OK" : "NOT_FOUND";
"#);

    let output = std::process::Command::new("/usr/bin/osascript")
        .args(["-l", "JavaScript", "-e", &script])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
            eprintln!("[Permissions] ncprefs revoke: {}", stdout);
            if stdout == "OK" {
                let _ = std::process::Command::new("/usr/bin/notifyutil")
                    .args(["-p", "com.apple.ncprefs.change"])
                    .output();
            }
            stdout == "OK" || stdout == "NOT_FOUND"
        }
        Err(e) => {
            eprintln!("[Permissions] ncprefs revoke failed: {}", e);
            false
        }
    }
}

/// Grant notification permission by adding an entry to ncprefs.plist.
/// Uses osascript -l JavaScript (JXA) which has native Foundation API access,
/// ensuring reliable binary plist manipulation from within .app bundles.
#[cfg(target_os = "macos")]
fn grant_notification_via_ncprefs() -> bool {
    let home = std::env::var("HOME").unwrap_or_default();
    let script = format!(r#"
ObjC.import("Foundation");
var nsPath = $.NSString.alloc.initWithUTF8String("{home}/Library/Preferences/com.apple.ncprefs.plist");
var data = $.NSData.dataWithContentsOfFile(nsPath);
if (!data) {{ "NO_FILE"; }}
var plist = $.NSPropertyListSerialization.propertyListWithDataOptionsFormatError(data, 2, null, null);
var apps = plist.objectForKey("apps");
for (var i = apps.count - 1; i >= 0; i--) {{
    var e = apps.objectAtIndex(i);
    var bid = e.objectForKey("bundle-id");
    if (bid && bid.js === "com.agentx.desktop") apps.removeObjectAtIndex(i);
}}
var ne = $.NSMutableDictionary.alloc.init;
ne.setObjectForKey($("com.agentx.desktop"), "bundle-id");
ne.setObjectForKey($.NSNumber.numberWithInt(276832270), "flags");
ne.setObjectForKey($("/Applications/AgentX.app"), "path");
ne.setObjectForKey($.NSNumber.numberWithInt(0), "content_visibility");
ne.setObjectForKey($.NSNumber.numberWithInt(0), "grouping");
ne.setObjectForKey($.NSNumber.numberWithInt(7), "auth");
apps.addObject(ne);
var out = $.NSPropertyListSerialization.dataWithPropertyListFormatOptionsError(plist, 200, 0, null);
out.writeToFileAtomically(nsPath, true);
"OK";
"#);

    let output = std::process::Command::new("/usr/bin/osascript")
        .args(["-l", "JavaScript", "-e", &script])
        .output();

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&o.stderr);
            eprintln!("[Permissions] ncprefs JXA: stdout={}, stderr={}", stdout, stderr.trim());
            if stdout != "OK" {
                return false;
            }
            // Notify system to reload
            let _ = std::process::Command::new("/usr/bin/notifyutil")
                .args(["-p", "com.apple.ncprefs.change"])
                .output();
            true
        }
        Err(e) => {
            eprintln!("[Permissions] ncprefs JXA failed: {}", e);
            false
        }
    }
}

/// Insert a TCC entry into the appropriate database using admin privileges.
/// Shows a native macOS password dialog via `osascript`.
/// `indirect_object` is needed for AppleEvents (automation) — it specifies the target app.
#[cfg(target_os = "macos")]
fn grant_tcc_entry(service: &str, client: &str, indirect_object: Option<&str>) -> bool {
    // Generate csreq for the client bundle ID
    let csreq_cmd = format!(
        r#"echo 'identifier "{}" and anchor apple generic' | csreq -r- -b /dev/stdout | xxd -p | tr -d '\n'"#,
        client
    );
    let csreq_output = std::process::Command::new("sh")
        .args(["-c", &csreq_cmd])
        .output();

    let csreq_hex = match csreq_output {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        _ => {
            eprintln!("[Permissions] Failed to generate csreq for {}", client);
            return false;
        }
    };
    if csreq_hex.is_empty() {
        return false;
    }

    // Determine which TCC database to use:
    // - FDA (SystemPolicyAllFiles) → system TCC.db (requires root)
    // - AppleEvents, PostEvent, etc. → user TCC.db (writable by user)
    let home = std::env::var("HOME").unwrap_or_default();
    let (tcc_path, needs_admin) = if service.contains("SystemPolicy") {
        ("/Library/Application Support/com.apple.TCC/TCC.db".to_string(), true)
    } else {
        (format!("{}/Library/Application Support/com.apple.TCC/TCC.db", home), false)
    };

    // Build SQL — AppleEvents needs indirect_object fields
    let (io_type, io_id, io_csreq) = if let Some(target) = indirect_object {
        // Generate csreq for the target app too
        let target_csreq_cmd = format!(
            r#"echo 'identifier "{}" and anchor apple' | csreq -r- -b /dev/stdout | xxd -p | tr -d '\n'"#,
            target
        );
        let target_hex = std::process::Command::new("sh")
            .args(["-c", &target_csreq_cmd])
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        if target_hex.is_empty() {
            ("0".to_string(), format!("'{}'", target), "NULL".to_string())
        } else {
            ("0".to_string(), format!("'{}'", target), format!("X'{}'", target_hex))
        }
    } else {
        ("0".to_string(), "'UNUSED'".to_string(), "NULL".to_string())
    };

    let sql = format!(
        "INSERT OR REPLACE INTO access \
         (service, client, client_type, auth_value, auth_reason, auth_version, \
          csreq, policy_id, indirect_object_identifier_type, indirect_object_identifier, \
          indirect_object_code_identity, flags, last_modified) \
         VALUES ('{}', '{}', 0, 2, 4, 1, X'{}', NULL, {}, {}, {}, 0, \
          CAST(strftime('%s','now') AS INTEGER));",
        service, client, csreq_hex, io_type, io_id, io_csreq
    );

    eprintln!("[Permissions] TCC insert: service={}, needs_admin={}", service, needs_admin);

    if needs_admin {
        // Use osascript with admin privileges (shows password dialog)
        let escaped_sql = sql.replace('\'', "'\\''");
        let shell_cmd = format!("sqlite3 '{}' '{}'", tcc_path, escaped_sql);
        let escaped = shell_cmd.replace('\\', "\\\\").replace('"', "\\\"");

        let result = std::process::Command::new("osascript")
            .args(["-e", &format!("do shell script \"{}\" with administrator privileges", escaped)])
            .output();

        match result {
            Ok(o) => {
                if !o.status.success() {
                    eprintln!("[Permissions] TCC admin insert failed: {}", String::from_utf8_lossy(&o.stderr));
                }
                o.status.success()
            }
            Err(e) => {
                eprintln!("[Permissions] TCC osascript failed: {}", e);
                false
            }
        }
    } else {
        // User TCC.db — can write directly without admin
        let result = std::process::Command::new("sqlite3")
            .args([&tcc_path, &sql])
            .output();

        match result {
            Ok(o) => {
                if !o.status.success() {
                    eprintln!("[Permissions] TCC insert failed: {}", String::from_utf8_lossy(&o.stderr));
                }
                o.status.success()
            }
            Err(e) => {
                eprintln!("[Permissions] sqlite3 failed: {}", e);
                false
            }
        }
    }
}

/// Grant Full Disk Access using the shared TCC entry insertion.
#[cfg(target_os = "macos")]
fn grant_fda_via_tcc_db() -> bool {
    grant_tcc_entry("kTCCServiceSystemPolicyAllFiles", "com.agentx.desktop", None)
}

/// Request automation permission on the main thread using NSAppleScript.
/// Sends a real Apple Event to System Events, triggering the TCC dialog.
#[cfg(target_os = "macos")]
fn request_automation_on_main_thread() -> bool {
    extern "C" {
        static _dispatch_main_q: std::ffi::c_void;
        fn dispatch_sync_f(
            queue: *mut std::ffi::c_void,
            context: *mut std::ffi::c_void,
            work: extern "C" fn(*mut std::ffi::c_void),
        );
    }

    extern "C" fn do_request(ctx_ptr: *mut std::ffi::c_void) {
        let result_ptr = ctx_ptr as *mut bool;
        unsafe {
            // Get NSAppleScript class
            let cls = match objc2::runtime::AnyClass::get(
                std::ffi::CStr::from_bytes_with_nul_unchecked(b"NSAppleScript\0"),
            ) {
                Some(c) => c,
                None => {
                    eprintln!("[Permissions] NSAppleScript class not found");
                    *result_ptr = false;
                    return;
                }
            };

            // Create NSString source
            let src_cls =
                objc2::runtime::AnyClass::get(std::ffi::CStr::from_bytes_with_nul_unchecked(
                    b"NSString\0",
                ))
                .unwrap();
            let source_cstr = std::ffi::CStr::from_bytes_with_nul_unchecked(
                b"tell application \"System Events\" to return \"\"\0",
            );
            let ns_source: *mut objc2::runtime::AnyObject =
                objc2::msg_send![src_cls, stringWithUTF8String: source_cstr.as_ptr()];

            // [[NSAppleScript alloc] initWithSource:]
            let script: *mut objc2::runtime::AnyObject = objc2::msg_send![cls, alloc];
            let script: *mut objc2::runtime::AnyObject =
                objc2::msg_send![script, initWithSource: ns_source];

            if script.is_null() {
                eprintln!("[Permissions] Failed to create NSAppleScript");
                *result_ptr = false;
                return;
            }

            // [script executeAndReturnError:]
            let mut error_dict: *mut objc2::runtime::AnyObject = std::ptr::null_mut();
            let _result: *mut objc2::runtime::AnyObject = objc2::msg_send![
                script,
                executeAndReturnError: &mut error_dict as *mut *mut objc2::runtime::AnyObject
            ];

            let granted = error_dict.is_null();
            eprintln!(
                "[Permissions] NSAppleScript on main thread: success={}",
                granted
            );
            *result_ptr = granted;
        }
    }

    let mut granted = false;
    unsafe {
        eprintln!("[Permissions] Dispatching automation request to main thread...");
        dispatch_sync_f(
            std::ptr::addr_of!(_dispatch_main_q) as *mut std::ffi::c_void,
            &mut granted as *mut bool as *mut std::ffi::c_void,
            do_request,
        );
    }
    granted
}

// Simulate paste (Cmd+V) via osascript — used by contextbar "Apply" action
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn simulate_paste() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        crate::translate::simulate_key_with_cmd(0x09) // 0x09 = kVK_V
            .map_err(|e| format!("Failed to simulate Cmd+V: {}", e))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Share Extension commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn share_is_installed() -> Result<bool, String> {
    Ok(crate::share::is_installed())
}

#[tauri::command]
pub fn share_check_pending(app: AppHandle) -> Result<(), String> {
    if let Some(action) = crate::share::consume_pending_action() {
        let _ = app.emit("share:action", serde_json::to_value(&action).unwrap());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Terminal PTY commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn terminal_create(
    state: State<'_, SidecarState>,
    session_id: String,
    cols: u32,
    rows: u32,
    cwd: Option<String>,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "terminal:create",
        serde_json::json!([session_id, cols, rows, cwd]),
    )
    .await
}

#[tauri::command]
pub async fn terminal_write(
    state: State<'_, SidecarState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    sidecar_notify(
        &state,
        "terminal:write",
        serde_json::json!([session_id, data]),
    )
    .await
}

#[tauri::command]
pub async fn terminal_resize(
    state: State<'_, SidecarState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    sidecar_notify(
        &state,
        "terminal:resize",
        serde_json::json!([session_id, cols, rows]),
    )
    .await
}

#[tauri::command]
pub async fn terminal_destroy(
    state: State<'_, SidecarState>,
    session_id: String,
) -> Result<Value, String> {
    sidecar_call(
        &state,
        "terminal:destroy",
        serde_json::json!([session_id]),
    )
    .await
}
