use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

// ---------------------------------------------------------------------------
// Clipboard History Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: u64,
    pub text: String,
    pub content_type: String,    // "text" | "code" | "url" | "json" | "base64" | "markdown"
    pub language: Option<String>, // detected programming language for code
    pub preview: String,          // first ~100 chars
    pub app_source: Option<String>,
    pub timestamp: u64,
    pub pinned: bool,
    pub favorite: bool,
}

/// Shared clipboard history state.
pub struct ClipboardHistoryState {
    entries: Arc<Mutex<Vec<ClipboardEntry>>>,
    next_id: Arc<Mutex<u64>>,
    last_content: Arc<Mutex<String>>,
    monitoring: Arc<Mutex<bool>>,
    dirty: Arc<Mutex<bool>>,
    retention_seconds: Arc<Mutex<Option<u64>>>,
    /// Tracks the last non-AgentX frontmost app name, updated every 800ms
    /// by the clipboard monitor. Used to restore focus after showing the
    /// clipboard panel without stealing focus.
    last_external_app: Arc<Mutex<String>>,
    /// PID of the last non-AgentX frontmost app.
    last_external_pid: Arc<Mutex<i32>>,
}

impl Default for ClipboardHistoryState {
    fn default() -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
            next_id: Arc::new(Mutex::new(1)),
            last_content: Arc::new(Mutex::new(String::new())),
            monitoring: Arc::new(Mutex::new(false)),
            dirty: Arc::new(Mutex::new(false)),
            retention_seconds: Arc::new(Mutex::new(None)),
            last_external_app: Arc::new(Mutex::new(String::new())),
            last_external_pid: Arc::new(Mutex::new(0)),
        }
    }
}

/// Returns the path to the clipboard history JSON file (~/.agentx/clipboard-history.json).
fn clipboard_history_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".agentx")
        .join("clipboard-history.json")
}

const MAX_HISTORY: usize = 200;

// ---------------------------------------------------------------------------
// Content Detection
// ---------------------------------------------------------------------------

/// Detect content type from text.
pub fn detect_content_type(text: &str) -> (String, Option<String>) {
    let trimmed = text.trim();

    // URL
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        if trimmed.lines().count() <= 2 && !trimmed.contains(' ') {
            return ("url".to_string(), None);
        }
    }

    // JSON
    if (trimmed.starts_with('{') && trimmed.ends_with('}'))
        || (trimmed.starts_with('[') && trimmed.ends_with(']'))
    {
        if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
            return ("json".to_string(), None);
        }
    }

    // Base64 (long single-line strings of base64 chars)
    if trimmed.len() > 20
        && !trimmed.contains(' ')
        && trimmed.lines().count() == 1
        && trimmed
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=')
    {
        if base64::Engine::decode(&base64::engine::general_purpose::STANDARD, trimmed).is_ok() {
            return ("base64".to_string(), None);
        }
    }

    // Markdown detection
    let md_indicators = [
        trimmed.starts_with("# "),
        trimmed.contains("\n## "),
        trimmed.contains("\n- "),
        trimmed.contains("\n* "),
        trimmed.contains("```"),
        trimmed.contains("[]("),
        trimmed.contains("**"),
    ];
    if md_indicators.iter().filter(|&&x| x).count() >= 2 {
        return ("markdown".to_string(), None);
    }

    // Code detection with language
    let lang = detect_language(trimmed);
    if lang.is_some() {
        return ("code".to_string(), lang);
    }

    ("text".to_string(), None)
}

/// Detect programming language from code text.
fn detect_language(text: &str) -> Option<String> {
    let patterns: &[(&str, &[&str])] = &[
        (
            "rust",
            &[
                "fn ", "let mut ", "impl ", "pub fn", "use std::", "-> Result",
            ],
        ),
        (
            "python",
            &["def ", "import ", "from ", "class ", "self.", "if __name__"],
        ),
        (
            "javascript",
            &[
                "const ",
                "let ",
                "var ",
                "function ",
                "=> ",
                "require(",
                "module.exports",
            ],
        ),
        (
            "typescript",
            &[
                "interface ",
                "type ",
                ": string",
                ": number",
                "export ",
                "import {",
            ],
        ),
        (
            "swift",
            &["func ", "var ", "let ", "guard ", "struct ", "import Foundation"],
        ),
        ("go", &["func ", "package ", "import ", "fmt.", ":= ", "go "]),
        (
            "java",
            &[
                "public class",
                "private ",
                "protected ",
                "System.out",
                "import java",
            ],
        ),
        (
            "html",
            &["<html", "<div", "<span", "<head", "<!DOCTYPE", "<body"],
        ),
        ("css", &["{", "}", "color:", "margin:", "padding:", "display:"]),
        ("sql", &["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "CREATE TABLE", "FROM "]),
        ("shell", &["#!/bin/", "echo ", "export ", "if [", "fi", "done"]),
    ];

    let mut best_match: Option<(&str, usize)> = None;

    for (lang, indicators) in patterns {
        let score = indicators.iter().filter(|&&p| text.contains(p)).count();
        if score >= 2 {
            if best_match.map_or(true, |(_, s)| score > s) {
                best_match = Some((lang, score));
            }
        }
    }

    best_match.map(|(lang, _)| lang.to_string())
}

// ---------------------------------------------------------------------------
// Native Clipboard Operations
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
pub fn get_clipboard_text() -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("pbpaste")
        .output()
        .map_err(|e| format!("Failed to read clipboard: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Err("Clipboard is empty".to_string());
    }

    Ok(text)
}

#[cfg(not(target_os = "macos"))]
pub fn get_clipboard_text() -> Result<String, String> {
    Err("Clipboard pipeline is only supported on macOS".to_string())
}

#[cfg(target_os = "macos")]
pub fn set_clipboard_text(text: &str) -> Result<(), String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let mut child = Command::new("pbcopy")
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to write clipboard: {}", e))?;

    if let Some(ref mut stdin) = child.stdin {
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to pbcopy stdin: {}", e))?;
    }
    child
        .wait()
        .map_err(|e| format!("pbcopy failed: {}", e))?;

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn set_clipboard_text(_text: &str) -> Result<(), String> {
    Err("Clipboard pipeline is only supported on macOS".to_string())
}

/// Get the foreground application name (macOS only).
#[cfg(target_os = "macos")]
fn get_frontmost_app_name() -> Option<String> {
    use std::process::Command;
    let output = Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events" to get name of first application process whose frontmost is true"#,
        ])
        .output()
        .ok()?;
    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

#[cfg(not(target_os = "macos"))]
fn get_frontmost_app_name() -> Option<String> {
    None
}

// ---------------------------------------------------------------------------
// Format Transformations
// ---------------------------------------------------------------------------

pub fn transform_text(text: &str, transform: &str) -> Result<String, String> {
    match transform {
        "json-format" => {
            let val: serde_json::Value =
                serde_json::from_str(text).map_err(|e| format!("Invalid JSON: {}", e))?;
            serde_json::to_string_pretty(&val)
                .map_err(|e| format!("JSON format error: {}", e))
        }
        "json-minify" => {
            let val: serde_json::Value =
                serde_json::from_str(text).map_err(|e| format!("Invalid JSON: {}", e))?;
            serde_json::to_string(&val).map_err(|e| format!("JSON minify error: {}", e))
        }
        "base64-encode" => {
            use base64::Engine;
            Ok(base64::engine::general_purpose::STANDARD.encode(text.as_bytes()))
        }
        "base64-decode" => {
            use base64::Engine;
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(text.trim())
                .map_err(|e| format!("Base64 decode error: {}", e))?;
            String::from_utf8(bytes).map_err(|e| format!("UTF-8 decode error: {}", e))
        }
        "url-encode" => Ok(urlencoding(text)),
        "url-decode" => Ok(urldecoding(text)),
        "uppercase" => Ok(text.to_uppercase()),
        "lowercase" => Ok(text.to_lowercase()),
        "trim" => Ok(text.trim().to_string()),
        "sort-lines" => {
            let mut lines: Vec<&str> = text.lines().collect();
            lines.sort();
            Ok(lines.join("\n"))
        }
        "unique-lines" => {
            let mut seen = std::collections::HashSet::new();
            let unique: Vec<&str> = text
                .lines()
                .filter(|line| seen.insert(*line))
                .collect();
            Ok(unique.join("\n"))
        }
        "reverse-lines" => {
            let lines: Vec<&str> = text.lines().rev().collect();
            Ok(lines.join("\n"))
        }
        "count-stats" => {
            let chars = text.len();
            let words = text.split_whitespace().count();
            let lines = text.lines().count();
            Ok(format!(
                "Characters: {}\nWords: {}\nLines: {}",
                chars, words, lines
            ))
        }
        "markdown-to-text" => {
            // Simple markdown stripping
            let result = text
                .lines()
                .map(|line| {
                    let l = line.trim_start_matches('#').trim();
                    let l = l.replace("**", "").replace("__", "");
                    let l = l.replace('*', "").replace('_', "");
                    // Strip links [text](url) -> text
                    let mut out = String::new();
                    let mut chars = l.chars().peekable();
                    while let Some(c) = chars.next() {
                        if c == '[' {
                            let mut link_text = String::new();
                            for nc in chars.by_ref() {
                                if nc == ']' {
                                    break;
                                }
                                link_text.push(nc);
                            }
                            // skip (url)
                            if chars.peek() == Some(&'(') {
                                chars.next();
                                for nc in chars.by_ref() {
                                    if nc == ')' {
                                        break;
                                    }
                                }
                            }
                            out.push_str(&link_text);
                        } else {
                            out.push(c);
                        }
                    }
                    out
                })
                .collect::<Vec<_>>()
                .join("\n");
            Ok(result)
        }
        "escape-html" => {
            Ok(text
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
                .replace('"', "&quot;")
                .replace('\'', "&#39;"))
        }
        "unescape-html" => {
            Ok(text
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'"))
        }
        _ => Err(format!("Unknown transform: {}", transform)),
    }
}

fn urlencoding(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(b as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", b));
            }
        }
    }
    result
}

fn urldecoding(s: &str) -> String {
    let mut result = Vec::new();
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(val) = u8::from_str_radix(
                &String::from_utf8_lossy(&bytes[i + 1..i + 3]),
                16,
            ) {
                result.push(val);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'+' {
            result.push(b' ');
        } else {
            result.push(bytes[i]);
        }
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

// ---------------------------------------------------------------------------
// History Management
// ---------------------------------------------------------------------------

impl ClipboardHistoryState {
    /// Add a new entry to the history.
    pub fn add_entry(&self, text: String) -> ClipboardEntry {
        let (content_type, language) = detect_content_type(&text);
        let preview = text.chars().take(100).collect::<String>();
        let app_source = get_frontmost_app_name();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut id_lock = self.next_id.lock().unwrap();
        let id = *id_lock;
        *id_lock += 1;
        drop(id_lock);

        let entry = ClipboardEntry {
            id,
            text,
            content_type,
            language,
            preview,
            app_source,
            timestamp,
            pinned: false,
            favorite: false,
        };

        let mut entries = self.entries.lock().unwrap();
        entries.insert(0, entry.clone());

        // Trim history (keep pinned/favorited even if over limit)
        while entries.len() > MAX_HISTORY {
            if let Some(pos) = entries.iter().rposition(|e| !e.pinned && !e.favorite) {
                entries.remove(pos);
            } else {
                break;
            }
        }

        // Mark dirty for debounced save in the monitor loop
        *self.dirty.lock().unwrap() = true;

        entry
    }

    /// Get all entries.
    pub fn get_entries(&self) -> Vec<ClipboardEntry> {
        self.entries.lock().unwrap().clone()
    }

    /// Search entries by text.
    pub fn search_entries(&self, query: &str) -> Vec<ClipboardEntry> {
        let q = query.to_lowercase();
        self.entries
            .lock()
            .unwrap()
            .iter()
            .filter(|e| {
                e.text.to_lowercase().contains(&q)
                    || e.content_type.to_lowercase().contains(&q)
                    || e.language
                        .as_ref()
                        .map_or(false, |l| l.to_lowercase().contains(&q))
                    || e.app_source
                        .as_ref()
                        .map_or(false, |a| a.to_lowercase().contains(&q))
            })
            .cloned()
            .collect()
    }

    /// Delete an entry by id.
    pub fn delete_entry(&self, id: u64) -> bool {
        let mut entries = self.entries.lock().unwrap();
        if let Some(pos) = entries.iter().position(|e| e.id == id) {
            entries.remove(pos);
            drop(entries);
            self.save_to_disk();
            true
        } else {
            false
        }
    }

    /// Toggle pin on an entry.
    pub fn toggle_pin(&self, id: u64) -> Option<bool> {
        let mut entries = self.entries.lock().unwrap();
        if let Some(entry) = entries.iter_mut().find(|e| e.id == id) {
            entry.pinned = !entry.pinned;
            let result = entry.pinned;
            drop(entries);
            self.save_to_disk();
            Some(result)
        } else {
            None
        }
    }

    /// Toggle favorite on an entry.
    pub fn toggle_favorite(&self, id: u64) -> Option<bool> {
        let mut entries = self.entries.lock().unwrap();
        if let Some(entry) = entries.iter_mut().find(|e| e.id == id) {
            entry.favorite = !entry.favorite;
            let result = entry.favorite;
            drop(entries);
            self.save_to_disk();
            Some(result)
        } else {
            None
        }
    }

    /// Clear all non-pinned, non-favorited entries.
    pub fn clear_history(&self) {
        let mut entries = self.entries.lock().unwrap();
        entries.retain(|e| e.pinned || e.favorite);
        drop(entries);
        self.save_to_disk();
    }

    /// Check if content is new (different from last recorded).
    pub fn is_new_content(&self, text: &str) -> bool {
        let last = self.last_content.lock().unwrap();
        *last != text
    }

    /// Update last recorded content.
    pub fn set_last_content(&self, text: String) {
        let mut last = self.last_content.lock().unwrap();
        *last = text;
    }

    /// Check if monitoring is active.
    pub fn is_monitoring(&self) -> bool {
        *self.monitoring.lock().unwrap()
    }

    /// Set monitoring state.
    pub fn set_monitoring(&self, active: bool) {
        *self.monitoring.lock().unwrap() = active;
    }

    // -----------------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------------

    /// Save clipboard history to disk (atomic write).
    pub fn save_to_disk(&self) {
        let entries = self.entries.lock().unwrap().clone();
        let path = clipboard_history_path();

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let json = match serde_json::to_string_pretty(&entries) {
            Ok(j) => j,
            Err(e) => {
                eprintln!("[Clipboard] Failed to serialize history: {}", e);
                return;
            }
        };

        // Atomic write: write to .tmp then rename
        let tmp_path = path.with_extension("json.tmp");
        if let Err(e) = std::fs::write(&tmp_path, &json) {
            eprintln!("[Clipboard] Failed to write temp file: {}", e);
            return;
        }
        if let Err(e) = std::fs::rename(&tmp_path, &path) {
            eprintln!("[Clipboard] Failed to rename temp file: {}", e);
        }
    }

    /// Load clipboard history from disk.
    pub fn load_from_disk(&self) {
        let path = clipboard_history_path();
        if !path.exists() {
            return;
        }

        let data = match std::fs::read_to_string(&path) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[Clipboard] Failed to read history file: {}", e);
                return;
            }
        };

        let loaded: Vec<ClipboardEntry> = match serde_json::from_str(&data) {
            Ok(v) => v,
            Err(e) => {
                eprintln!("[Clipboard] Failed to parse history file: {}", e);
                return;
            }
        };

        // Set next_id to max(id) + 1
        let max_id = loaded.iter().map(|e| e.id).max().unwrap_or(0);
        *self.next_id.lock().unwrap() = max_id + 1;

        // Set last_content to the most recent entry to avoid re-capturing it
        if let Some(first) = loaded.first() {
            *self.last_content.lock().unwrap() = first.text.clone();
        }

        *self.entries.lock().unwrap() = loaded;
        eprintln!(
            "[Clipboard] Loaded {} entries from disk",
            self.entries.lock().unwrap().len()
        );
    }

    /// Flush dirty state to disk if needed. Called from the monitor loop.
    pub fn flush_if_dirty(&self) {
        let mut dirty = self.dirty.lock().unwrap();
        if *dirty {
            *dirty = false;
            drop(dirty);
            self.save_to_disk();
        }
    }

    // -----------------------------------------------------------------------
    // Retention
    // -----------------------------------------------------------------------

    /// Set the retention period in seconds. `None` means keep forever.
    pub fn set_retention(&self, seconds: Option<u64>) {
        *self.retention_seconds.lock().unwrap() = seconds;
    }

    /// Get the current retention period.
    pub fn get_retention(&self) -> Option<u64> {
        *self.retention_seconds.lock().unwrap()
    }

    /// Remove entries older than the retention period (preserves pinned/favorited).
    pub fn cleanup_expired(&self) -> bool {
        let retention = *self.retention_seconds.lock().unwrap();
        let retention = match retention {
            Some(s) => s,
            None => return false, // keep forever
        };

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut entries = self.entries.lock().unwrap();
        let before = entries.len();
        entries.retain(|e| e.pinned || e.favorite || (now - e.timestamp) <= retention);
        let removed = entries.len() < before;
        removed
    }

    // -----------------------------------------------------------------------
    // External app tracking (for focus restoration)
    // -----------------------------------------------------------------------

    /// Get the last known non-AgentX frontmost app name.
    pub fn get_last_external_app(&self) -> String {
        self.last_external_app.lock().unwrap().clone()
    }

    /// Get the PID of the last known non-AgentX frontmost app.
    pub fn get_last_external_pid(&self) -> i32 {
        *self.last_external_pid.lock().unwrap()
    }

    /// Update the last external app if the current frontmost app is not us.
    /// Uses PID comparison (not name) for reliability.
    fn track_frontmost_app(&self) {
        let own_pid = std::process::id() as i32;
        #[cfg(target_os = "macos")]
        {
            use std::process::Command;
            if let Ok(output) = Command::new("osascript")
                .args([
                    "-e",
                    r#"tell application "System Events"
                        set p to first application process whose frontmost is true
                        return (unix id of p) & "|" & (name of p)
                    end tell"#,
                ])
                .output()
            {
                let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if let Some((pid_str, name)) = result.split_once('|') {
                    if let Ok(pid) = pid_str.parse::<i32>() {
                        if pid != own_pid {
                            *self.last_external_app.lock().unwrap() = name.to_string();
                            *self.last_external_pid.lock().unwrap() = pid;
                        }
                    }
                }
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = own_pid;
            if let Some(name) = get_frontmost_app_name() {
                *self.last_external_app.lock().unwrap() = name;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Clipboard Monitor (polls clipboard for changes)
// ---------------------------------------------------------------------------

pub fn start_clipboard_monitor(app: &AppHandle) {
    let state: tauri::State<'_, ClipboardHistoryState> = app.state();

    if state.is_monitoring() {
        return;
    }
    state.set_monitoring(true);

    // Read current clipboard to avoid capturing stale content as "new"
    if let Ok(current) = get_clipboard_text() {
        state.set_last_content(current);
    }

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(800)).await;

            let state: tauri::State<'_, ClipboardHistoryState> = handle.state();
            if !state.is_monitoring() {
                break;
            }

            // Track the frontmost app (for focus restoration on clipboard shortcut)
            state.track_frontmost_app();

            if let Ok(text) = get_clipboard_text() {
                if state.is_new_content(&text) {
                    state.set_last_content(text.clone());
                    let entry = state.add_entry(text);
                    let _ = handle.emit("clipboard:new-entry", &entry);
                }
            }

            // Cleanup expired entries based on retention period
            if state.cleanup_expired() {
                *state.dirty.lock().unwrap() = true;
            }

            // Flush dirty state to disk (debounced save)
            state.flush_if_dirty();
        }
    });
}

pub fn stop_clipboard_monitor(app: &AppHandle) {
    let state: tauri::State<'_, ClipboardHistoryState> = app.state();
    state.set_monitoring(false);
}

