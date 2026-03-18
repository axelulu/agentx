use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex};

/// Manages the sidecar Node.js process and JSON-RPC communication.
#[derive(Default)]
pub struct SidecarState {
    inner: Arc<Mutex<Option<SidecarInner>>>,
}

struct SidecarInner {
    stdin: tokio::process::ChildStdin,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    next_id: Arc<AtomicU64>,
    _child: tokio::process::Child,
}

impl SidecarState {
    /// Send a JSON-RPC request to the sidecar and wait for the response.
    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let guard = self.inner.lock().await;
        let inner = guard.as_ref().ok_or("Sidecar not running")?;

        let id = inner.next_id.fetch_add(1, Ordering::SeqCst);
        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });

        let (tx, rx) = oneshot::channel();
        inner.pending.lock().await.insert(id, tx);

        let mut line = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        line.push('\n');

        drop(guard);

        // Re-acquire lock for writing
        let mut guard = self.inner.lock().await;
        let inner = guard.as_mut().ok_or("Sidecar not running")?;
        inner
            .stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to sidecar: {}", e))?;
        inner
            .stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;
        drop(guard);

        // Wait for response
        rx.await
            .map_err(|_| "Sidecar response channel closed".to_string())?
    }

    /// Send a fire-and-forget JSON-RPC notification (no id, no response expected).
    pub async fn notify(&self, method: &str, params: Value) -> Result<(), String> {
        let mut guard = self.inner.lock().await;
        let inner = guard.as_mut().ok_or("Sidecar not running")?;

        let request = serde_json::json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
        });

        let mut line = serde_json::to_string(&request).map_err(|e| e.to_string())?;
        line.push('\n');

        inner
            .stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to sidecar: {}", e))?;
        inner
            .stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush sidecar stdin: {}", e))?;

        Ok(())
    }
}

/// Spawn the sidecar process and set up stdin/stdout communication.
pub async fn spawn_sidecar(app: &AppHandle) -> Result<(), String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    // Resolve the sidecar JS bundle path
    let sidecar_path = if cfg!(debug_assertions) {
        // Dev mode: CARGO_MANIFEST_DIR points to src-tauri/, go up to packages/agentx/
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir
            .parent()
            .unwrap_or(&manifest_dir)
            .join("sidecar")
            .join("dist")
            .join("index.js")
    } else {
        // Production: use the bundled resource
        resource_dir.join("sidecar").join("index.js")
    };

    // Always run with node (try bun first in dev for speed)
    let program = if cfg!(debug_assertions) && which_exists("bun") {
        "bun".to_string()
    } else {
        "node".to_string()
    };
    let args = vec![sidecar_path.to_string_lossy().to_string()];

    // Pass data paths as CLI args
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let home_dir = dirs_home();
    let toolkit_path = if cfg!(debug_assertions) {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir
            .parent()
            .unwrap_or(&manifest_dir)
            .join("resources")
            .join("toolkit")
    } else {
        resource_dir.join("toolkit")
    };

    let mut all_args = args;
    all_args.extend([
        "--data-dir".to_string(),
        data_dir.to_string_lossy().to_string(),
        "--toolkit-path".to_string(),
        toolkit_path.to_string_lossy().to_string(),
        "--workspace-path".to_string(),
        home_dir.clone(),
    ]);

    eprintln!("[Sidecar] Spawning: {} {:?}", program, all_args);

    let mut child = Command::new(&program)
        .args(&all_args)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let stdin = child.stdin.take().ok_or("Failed to get sidecar stdin")?;
    let stdout = child.stdout.take().ok_or("Failed to get sidecar stdout")?;

    let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let next_id = Arc::new(AtomicU64::new(1));

    let inner = SidecarInner {
        stdin,
        pending: pending.clone(),
        next_id,
        _child: child,
    };

    // Store in state
    let sidecar_state: tauri::State<'_, SidecarState> = app.state();
    let state_arc = sidecar_state.inner.clone();
    *state_arc.lock().await = Some(inner);

    // Background reader task: parse stdout JSON-RPC responses and notifications
    let app_handle = app.clone();
    let restart_handle = app.clone();
    let restart_state = state_arc.clone();
    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let line = line.trim().to_string();
            if line.is_empty() {
                continue;
            }

            match serde_json::from_str::<Value>(&line) {
                Ok(msg) => {
                    if let Some(id) = msg.get("id").and_then(|v| v.as_u64()) {
                        // Response to a request
                        let mut map = pending.lock().await;
                        if let Some(tx) = map.remove(&id) {
                            if let Some(error) = msg.get("error") {
                                let err_msg = error
                                    .get("message")
                                    .and_then(|m| m.as_str())
                                    .unwrap_or("Unknown sidecar error")
                                    .to_string();
                                let _ = tx.send(Err(err_msg));
                            } else {
                                let result = msg.get("result").cloned().unwrap_or(Value::Null);
                                let _ = tx.send(Ok(result));
                            }
                        }
                    } else if let Some(method) = msg.get("method").and_then(|m| m.as_str()) {
                        // JSON-RPC notification (push event)
                        let params = msg.get("params").cloned().unwrap_or(Value::Null);
                        handle_sidecar_notification(&app_handle, method, params);
                    }
                }
                Err(e) => {
                    eprintln!("[Sidecar] Failed to parse JSON: {} | line: {}", e, line);
                }
            }
        }

        eprintln!("[Sidecar] stdout reader ended — requesting restart");

        // Clear old state so pending calls fail fast
        *restart_state.lock().await = None;

        // Emit a Tauri event so the setup code can trigger a restart
        let _ = restart_handle.emit("sidecar:restart", ());
    });

    eprintln!("[Sidecar] Started successfully");
    Ok(())
}

/// Handle push notifications from the sidecar by forwarding them as Tauri events.
fn handle_sidecar_notification(app: &AppHandle, method: &str, params: Value) {
    match method {
        "agent:event" => {
            let _ = app.emit("agent:event", params);
        }
        "mcp:statusUpdate" => {
            let _ = app.emit("mcp:statusUpdate", params);
        }
        "scheduler:statusUpdate" => {
            let _ = app.emit("scheduler:statusUpdate", params);
        }
        "updater:status" => {
            let _ = app.emit("updater:status", params);
        }
        "notification:show" => {
            // Sidecar requests a native notification — forward as Tauri event
            let _ = app.emit("notification:show", params);
        }
        "notification:navigateToConversation" => {
            let _ = app.emit("notification:navigateToConversation", params);
        }
        _ => {
            // Forward unknown notifications as generic events
            let _ = app.emit(method, params);
        }
    }
}

fn which_exists(name: &str) -> bool {
    std::process::Command::new("which")
        .arg(name)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn dirs_home() -> String {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| "/".to_string())
}
