//! Scan installed macOS applications and extract icons for the command palette.

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledApp {
    pub name: String,
    #[serde(rename = "bundleId")]
    pub bundle_id: String,
    pub path: String,
}

/// Managed Tauri state — caches app list and icons.
pub struct InstalledAppsCache {
    apps: Mutex<Option<Vec<InstalledApp>>>,
    icons: Mutex<HashMap<String, String>>,
}

impl Default for InstalledAppsCache {
    fn default() -> Self {
        Self {
            apps: Mutex::new(None),
            icons: Mutex::new(HashMap::new()),
        }
    }
}

impl InstalledAppsCache {
    /// Return cached app list, scanning on first call.
    pub fn list_installed(&self) -> Vec<InstalledApp> {
        let mut guard = self.apps.lock().unwrap();
        if let Some(ref apps) = *guard {
            return apps.clone();
        }
        let apps = scan_applications();
        *guard = Some(apps.clone());
        apps
    }

    /// Return cached icon data URI, extracting on first call.
    pub fn get_icon(&self, bundle_id: &str) -> Option<String> {
        // Check cache
        {
            let cache = self.icons.lock().unwrap();
            if let Some(icon) = cache.get(bundle_id) {
                return Some(icon.clone());
            }
        }

        // Find the app path
        let app_path = {
            let guard = self.apps.lock().unwrap();
            guard
                .as_ref()
                .and_then(|apps| apps.iter().find(|a| a.bundle_id == bundle_id))
                .map(|a| a.path.clone())
        };

        let app_path = app_path?;
        let icon = extract_icon_base64(&app_path)?;

        // Cache it
        {
            let mut cache = self.icons.lock().unwrap();
            cache.insert(bundle_id.to_string(), icon.clone());
        }

        Some(icon)
    }
}

// ---------------------------------------------------------------------------
// Scanning
// ---------------------------------------------------------------------------

fn scan_applications() -> Vec<InstalledApp> {
    let mut results = Vec::new();
    let mut seen_ids = HashMap::new();

    let home = std::env::var("HOME").unwrap_or_default();
    let dirs = [
        PathBuf::from("/Applications"),
        PathBuf::from(format!("{}/Applications", home)),
        PathBuf::from("/System/Applications"),
    ];

    for dir in &dirs {
        scan_dir(dir, &mut results, &mut seen_ids, 0);
    }

    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    results
}

/// Recursively scan a directory for .app bundles (max depth 2 to cover
/// subdirectories like /Applications/Utilities/).
fn scan_dir(
    dir: &Path,
    results: &mut Vec<InstalledApp>,
    seen_ids: &mut HashMap<String, usize>,
    depth: u8,
) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map_or(false, |e| e == "app") {
            if let Some(app) = parse_app_bundle(&path) {
                // Deduplicate by bundle_id — keep the first one found
                // (/Applications takes priority over /System/Applications)
                if !seen_ids.contains_key(&app.bundle_id) {
                    seen_ids.insert(app.bundle_id.clone(), results.len());
                    results.push(app);
                }
            }
        } else if path.is_dir() && depth < 2 {
            scan_dir(&path, results, seen_ids, depth + 1);
        }
    }
}

/// Parse a .app bundle, extracting name and bundle ID from Info.plist.
fn parse_app_bundle(path: &Path) -> Option<InstalledApp> {
    let plist = path.join("Contents/Info.plist");
    if !plist.exists() {
        return None;
    }

    // Use plutil to convert plist to JSON — gets all fields in one process spawn
    let output = Command::new("plutil")
        .args([
            "-convert",
            "json",
            "-o",
            "-",
            &plist.to_string_lossy(),
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;

    let bundle_id = json
        .get("CFBundleIdentifier")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())?;

    // Prefer CFBundleDisplayName > CFBundleName > filename
    let name = json
        .get("CFBundleDisplayName")
        .and_then(|v| v.as_str())
        .or_else(|| json.get("CFBundleName").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            path.file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default()
        });

    if name.is_empty() || bundle_id.is_empty() {
        return None;
    }

    Some(InstalledApp {
        name,
        bundle_id,
        path: path.to_string_lossy().to_string(),
    })
}

// ---------------------------------------------------------------------------
// Icon extraction
// ---------------------------------------------------------------------------

fn extract_icon_base64(app_path: &str) -> Option<String> {
    let plist = format!("{}/Contents/Info.plist", app_path);

    // Get icon filename from plist
    let output = Command::new("plutil")
        .args(["-convert", "json", "-o", "-", &plist])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout).ok()?;

    let icon_name = json
        .get("CFBundleIconFile")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "AppIcon".to_string());

    // Append .icns if not present
    let icon_filename = if icon_name.ends_with(".icns") {
        icon_name
    } else {
        format!("{}.icns", icon_name)
    };

    let icns_path = format!("{}/Contents/Resources/{}", app_path, icon_filename);
    if !Path::new(&icns_path).exists() {
        return None;
    }

    // Convert to 32x32 PNG via sips
    let hash = {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        icns_path.hash(&mut h);
        h.finish()
    };
    let tmp = format!("/tmp/agentx_icon_{}.png", hash);

    let status = Command::new("sips")
        .args([
            "-s", "format", "png", "-z", "32", "32", &icns_path, "--out", &tmp,
        ])
        .stderr(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .status()
        .ok()?;

    if !status.success() {
        return None;
    }

    let bytes = std::fs::read(&tmp).ok()?;
    let _ = std::fs::remove_file(&tmp);

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:image/png;base64,{}", b64))
}
