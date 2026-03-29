use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A single item received from the Share Extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SharedItem {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "url")]
    Url { url: String },
    #[serde(rename = "image")]
    Image { path: String, name: String },
    #[serde(rename = "file")]
    File { path: String, name: String },
}

/// Payload written by the Share Extension.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShareAction {
    pub timestamp: f64,
    pub items: Vec<SharedItem>,
}

/// Returns the path to the pending share action file.
fn pending_action_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home)
        .join(".agentx")
        .join("pending-share-action.json")
}

/// Check for and consume a pending share action.
/// Reads the JSON file written by the Share Extension and deletes it.
pub fn consume_pending_action() -> Option<ShareAction> {
    let path = pending_action_path();
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);
    serde_json::from_str(&content).ok()
}

/// Clean up shared content files older than 1 hour.
/// Called periodically to prevent accumulation of temp files.
pub fn cleanup_shared_content() {
    let home = std::env::var("HOME").unwrap_or_default();
    let shared_dir = PathBuf::from(home).join(".agentx").join("shared-content");
    if !shared_dir.exists() {
        return;
    }

    let one_hour_ago = std::time::SystemTime::now()
        - std::time::Duration::from_secs(3600);

    if let Ok(entries) = std::fs::read_dir(&shared_dir) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if modified < one_hour_ago {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
}

/// Check if the Share Extension is installed in the app bundle.
pub fn is_installed() -> bool {
    // In a running app, check if the PlugIns directory contains our extension
    if let Ok(exe) = std::env::current_exe() {
        // exe is at AgentX.app/Contents/MacOS/AgentX
        if let Some(contents) = exe.parent().and_then(|p| p.parent()) {
            let plugin_path = contents.join("PlugIns").join("ShareExtension.appex");
            return plugin_path.exists();
        }
    }
    false
}
