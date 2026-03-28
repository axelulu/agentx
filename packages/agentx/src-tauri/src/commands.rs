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

#[cfg(target_os = "macos")]
fn check_permission_status(perm_type: &str) -> String {
    match perm_type {
        "accessibility" => {
            if crate::accessibility::is_trusted() {
                "granted".to_string()
            } else {
                "denied".to_string()
            }
        }
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
