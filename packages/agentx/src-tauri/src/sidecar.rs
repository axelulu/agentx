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
    /// Wait for the sidecar process to be ready (up to ~10 seconds).
    async fn wait_ready(&self) -> Result<(), String> {
        for _ in 0..100 {
            if self.inner.lock().await.is_some() {
                return Ok(());
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        Err("Sidecar not running after 10s timeout".to_string())
    }

    /// Send a JSON-RPC request to the sidecar and wait for the response.
    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        self.wait_ready().await?;
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
        self.wait_ready().await?;
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

    // Resolve the sidecar JS bundle path (.cjs to avoid ESM/CJS conflicts
    // when the parent package.json has "type": "module")
    let sidecar_path = if cfg!(debug_assertions) {
        // Dev mode: CARGO_MANIFEST_DIR points to src-tauri/, go up to packages/agentx/
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir
            .parent()
            .unwrap_or(&manifest_dir)
            .join("sidecar")
            .join("dist")
            .join("index.cjs")
    } else {
        // Production: use the bundled resource
        resource_dir.join("sidecar").join("index.cjs")
    };

    // Use node (not bun) — node-pty requires native Node.js addon support
    let program = "node".to_string();
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

    // Resolve agent-browser binary path
    let browser_bin = if cfg!(debug_assertions) {
        // Dev: use system-installed agent-browser if available
        if which_exists("agent-browser") {
            "agent-browser".to_string()
        } else {
            String::new()
        }
    } else {
        // Production: Tauri externalBin places binaries in Contents/MacOS/
        // (sibling to the main executable), not in Resources/
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()));
        match exe_dir {
            Some(dir) => dir.join("agent-browser").to_string_lossy().to_string(),
            None => String::new(),
        }
    };

    // On macOS, GUI apps launched from Finder/Dock have a minimal PATH that
    // doesn't include Homebrew, nvm, volta, etc.  Augment PATH so we can find `node`.
    let augmented_path = augment_path();

    eprintln!("[Sidecar] Spawning: {} {:?}", program, all_args);
    eprintln!("[Sidecar] AGENTX_BROWSER_BIN={}", browser_bin);
    eprintln!("[Sidecar] PATH={}", augmented_path);

    let mut child = Command::new(&program)
        .args(&all_args)
        .env("PATH", &augmented_path)
        .env("AGENTX_BROWSER_BIN", &browser_bin)
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
                Err(_) => {
                    // Non-JSON lines come from console.log in the runtime or
                    // third-party libraries.  They are harmless — just forward
                    // to stderr so they show up in the dev console without
                    // flooding it with scary "Failed to parse" messages.
                    eprintln!("{}", line);
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
        "terminal:data" => {
            let _ = app.emit("terminal:data", params);
        }
        "terminal:exit" => {
            let _ = app.emit("terminal:exit", params);
        }
        _ => {
            // Forward unknown notifications as generic events
            let _ = app.emit(method, params);
        }
    }
}

/// Build an augmented PATH that includes common Node.js installation locations.
/// On macOS, GUI apps inherit a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin) which
/// doesn't include Homebrew, nvm, volta, fnm, mise, etc.
fn augment_path() -> String {
    let current = std::env::var("PATH").unwrap_or_default();
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

    let mut extra_dirs: Vec<String> = Vec::new();

    // Homebrew (Apple Silicon + Intel)
    extra_dirs.push("/opt/homebrew/bin".to_string());
    extra_dirs.push("/usr/local/bin".to_string());

    // nvm — resolve the current default
    let nvm_dir = std::env::var("NVM_DIR")
        .unwrap_or_else(|_| format!("{}/.nvm", home));
    // nvm stores the active version via an alias; the easiest portable check
    // is to look at the `default` alias and resolve the path.
    let nvm_default = std::path::Path::new(&nvm_dir).join("alias").join("default");
    if let Ok(version_alias) = std::fs::read_to_string(&nvm_default) {
        let version = version_alias.trim();
        // The alias might be "lts/*", "18", "v20.11.0", etc.
        // Walk the versions dir to find a match.
        let versions_dir = std::path::Path::new(&nvm_dir).join("versions").join("node");
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            let mut candidates: Vec<_> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().to_string())
                .collect();
            candidates.sort();
            candidates.reverse(); // newest first
            // Find an exact match or prefix match
            if let Some(matched) = candidates.iter().find(|v| {
                *v == version || v.strip_prefix('v').map_or(false, |s| s.starts_with(version))
            }) {
                extra_dirs.push(
                    versions_dir.join(matched).join("bin").to_string_lossy().to_string(),
                );
            } else if let Some(latest) = candidates.first() {
                // Fallback: just use the latest installed version
                extra_dirs.push(
                    versions_dir.join(latest).join("bin").to_string_lossy().to_string(),
                );
            }
        }
    } else {
        // No default alias — just pick the newest installed version if any
        let versions_dir = std::path::Path::new(&nvm_dir).join("versions").join("node");
        if let Ok(entries) = std::fs::read_dir(&versions_dir) {
            let mut candidates: Vec<_> = entries
                .filter_map(|e| e.ok())
                .map(|e| e.file_name().to_string_lossy().to_string())
                .collect();
            candidates.sort();
            if let Some(latest) = candidates.last() {
                extra_dirs.push(
                    versions_dir.join(latest).join("bin").to_string_lossy().to_string(),
                );
            }
        }
    }

    // volta
    extra_dirs.push(format!("{}/.volta/bin", home));

    // fnm
    let fnm_dir = format!("{}/.local/share/fnm/aliases/default/bin", home);
    extra_dirs.push(fnm_dir);

    // mise / rtx
    extra_dirs.push(format!("{}/.local/share/mise/shims", home));
    extra_dirs.push(format!("{}/.local/share/rtx/shims", home));

    // asdf
    extra_dirs.push(format!("{}/.asdf/shims", home));

    // Common user-local bin
    extra_dirs.push(format!("{}/.local/bin", home));

    // Also try to read the user's default shell PATH via a quick login shell invocation
    // (cached per process lifetime)
    if let Some(shell_path) = resolve_shell_path() {
        for dir in shell_path.split(':') {
            if !dir.is_empty() && !extra_dirs.contains(&dir.to_string()) {
                extra_dirs.push(dir.to_string());
            }
        }
    }

    // Prepend extra dirs that actually exist
    let mut parts: Vec<&str> = Vec::new();
    for dir in &extra_dirs {
        if std::path::Path::new(dir).is_dir() && !current.split(':').any(|p| p == dir.as_str()) {
            parts.push(dir);
        }
    }
    // Append original PATH
    if !current.is_empty() {
        parts.push(&current);
    }

    parts.join(":")
}

/// Try to get the user's full PATH from a login shell invocation.
fn resolve_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
    let output = std::process::Command::new(&shell)
        .args(["-l", "-c", "echo $PATH"])
        .output()
        .ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(path);
        }
    }
    None
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
