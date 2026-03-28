use serde::{Deserialize, Serialize};
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
}

impl Default for ClipboardHistoryState {
    fn default() -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
            next_id: Arc::new(Mutex::new(1)),
            last_content: Arc::new(Mutex::new(String::new())),
            monitoring: Arc::new(Mutex::new(false)),
        }
    }
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
            Some(entry.pinned)
        } else {
            None
        }
    }

    /// Toggle favorite on an entry.
    pub fn toggle_favorite(&self, id: u64) -> Option<bool> {
        let mut entries = self.entries.lock().unwrap();
        if let Some(entry) = entries.iter_mut().find(|e| e.id == id) {
            entry.favorite = !entry.favorite;
            Some(entry.favorite)
        } else {
            None
        }
    }

    /// Clear all non-pinned, non-favorited entries.
    pub fn clear_history(&self) {
        let mut entries = self.entries.lock().unwrap();
        entries.retain(|e| e.pinned || e.favorite);
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

            if let Ok(text) = get_clipboard_text() {
                if state.is_new_content(&text) {
                    state.set_last_content(text.clone());
                    let entry = state.add_entry(text);
                    let _ = handle.emit("clipboard:new-entry", &entry);
                }
            }
        }
    });
}

pub fn stop_clipboard_monitor(app: &AppHandle) {
    let state: tauri::State<'_, ClipboardHistoryState> = app.state();
    state.set_monitoring(false);
}

