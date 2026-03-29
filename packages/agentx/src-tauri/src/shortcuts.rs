use crate::sidecar::SidecarState;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager};
use url::Url;

/// Supported shortcut actions that can be invoked via deep link.
#[derive(Debug, Clone)]
pub struct ShortcutAction {
    pub action: String,
    pub params: HashMap<String, String>,
    pub x_success: Option<String>,
    pub x_error: Option<String>,
    pub x_cancel: Option<String>,
}

/// Parse an `agentx://` deep link URL into a ShortcutAction.
///
/// Supported URL formats:
///   agentx://x-callback-url/<action>?<params>
///   agentx://run/<action>?<params>
///   agentx://<action>?<params>
///
/// Standard x-callback-url params:
///   x-success, x-error, x-cancel — callback URLs
///
/// Supported actions:
///   translate    — text, target_lang
///   chat         — prompt, system_prompt (optional)
///   summarize    — text
///   ask          — prompt (opens main window with prompt)
pub fn parse_deep_link(url_str: &str) -> Result<ShortcutAction, String> {
    let url = Url::parse(url_str).map_err(|e| format!("Invalid URL: {}", e))?;

    if url.scheme() != "agentx" {
        return Err(format!("Unknown scheme: {}", url.scheme()));
    }

    // Parse host + path to determine action
    // agentx://x-callback-url/translate => host="x-callback-url", path="/translate"
    // agentx://translate               => host="translate", path=""
    // agentx://run/translate            => host="run", path="/translate"
    let host = url.host_str().unwrap_or("");
    let path = url.path().trim_start_matches('/');

    let action = match host {
        "x-callback-url" | "run" => {
            if path.is_empty() {
                return Err("Missing action in URL path".to_string());
            }
            path.to_string()
        }
        "" => return Err("Missing action in URL".to_string()),
        _ => {
            // host itself is the action (agentx://translate?text=...)
            if !path.is_empty() {
                format!("{}/{}", host, path)
            } else {
                host.to_string()
            }
        }
    };

    let mut params = HashMap::new();
    let mut x_success = None;
    let mut x_error = None;
    let mut x_cancel = None;

    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "x-success" => x_success = Some(value.to_string()),
            "x-error" => x_error = Some(value.to_string()),
            "x-cancel" => x_cancel = Some(value.to_string()),
            _ => {
                params.insert(key.to_string(), value.to_string());
            }
        }
    }

    Ok(ShortcutAction {
        action,
        params,
        x_success,
        x_error,
        x_cancel,
    })
}

/// Execute a shortcut action and return the result.
pub async fn execute_action(app: &AppHandle, action: ShortcutAction) -> Result<String, String> {
    let sidecar: tauri::State<'_, SidecarState> = app.state();

    match action.action.as_str() {
        "translate" => {
            let text = action
                .params
                .get("text")
                .cloned()
                .unwrap_or_default();
            let target_lang = action
                .params
                .get("target_lang")
                .or_else(|| action.params.get("lang"))
                .cloned()
                .unwrap_or_else(|| "en".to_string());

            if text.is_empty() {
                return Err("Missing 'text' parameter".to_string());
            }

            let result = sidecar
                .call("translate:run", serde_json::json!([text, target_lang]))
                .await?;

            if let Some(error) = result.get("error").and_then(|e| e.as_str()) {
                if !error.is_empty() {
                    return Err(error.to_string());
                }
            }

            Ok(result
                .get("text")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string())
        }

        "chat" | "ask" => {
            let prompt = action
                .params
                .get("prompt")
                .or_else(|| action.params.get("text"))
                .cloned()
                .unwrap_or_default();

            if prompt.is_empty() {
                return Err("Missing 'prompt' parameter".to_string());
            }

            let system_prompt = action.params.get("system_prompt").cloned();

            let result = sidecar
                .call(
                    "shortcuts:run",
                    serde_json::json!([prompt, system_prompt]),
                )
                .await?;

            if let Some(error) = result.get("error").and_then(|e| e.as_str()) {
                if !error.is_empty() {
                    return Err(error.to_string());
                }
            }

            Ok(result
                .get("text")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string())
        }

        "summarize" => {
            let text = action
                .params
                .get("text")
                .cloned()
                .unwrap_or_default();

            if text.is_empty() {
                return Err("Missing 'text' parameter".to_string());
            }

            let system_prompt =
                "You are a summarization assistant. Provide a concise summary of the given text. Only output the summary, nothing else.".to_string();

            let result = sidecar
                .call(
                    "shortcuts:run",
                    serde_json::json!([text, Some(system_prompt)]),
                )
                .await?;

            if let Some(error) = result.get("error").and_then(|e| e.as_str()) {
                if !error.is_empty() {
                    return Err(error.to_string());
                }
            }

            Ok(result
                .get("text")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string())
        }

        "open" => {
            // Just bring the app to foreground
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }

            // Optionally navigate to a conversation
            if let Some(conv_id) = action.params.get("conversation") {
                let _ = app.emit("notification:navigateToConversation", serde_json::json!({ "conversationId": conv_id }));
            }

            Ok("ok".to_string())
        }

        "share" => {
            // Consume pending share action written by the Share Extension
            if let Some(share_action) = crate::share::consume_pending_action() {
                // Bring app to foreground
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }

                // Emit event with the shared content for the frontend to handle
                let _ = app.emit(
                    "share:action",
                    serde_json::to_value(&share_action).unwrap(),
                );

                // Clean up old shared content files in the background
                std::thread::spawn(|| {
                    crate::share::cleanup_shared_content();
                });

                Ok("ok".to_string())
            } else {
                Ok("no_pending_share".to_string())
            }
        }

        _ => Err(format!("Unknown action: {}", action.action)),
    }
}

/// Handle a deep link URL: parse, execute, and fire x-callback-url response.
pub async fn handle_deep_link(app: &AppHandle, url_str: &str) {
    eprintln!("[Shortcuts] Handling deep link: {}", url_str);

    let action = match parse_deep_link(url_str) {
        Ok(a) => a,
        Err(e) => {
            eprintln!("[Shortcuts] Failed to parse deep link: {}", e);
            return;
        }
    };

    let x_success = action.x_success.clone();
    let x_error = action.x_error.clone();

    match execute_action(app, action).await {
        Ok(result) => {
            eprintln!("[Shortcuts] Action succeeded: {} bytes", result.len());

            // Copy result to clipboard for Shortcuts to pick up
            set_clipboard(&result);

            // Emit event so frontend can show result if desired
            let _ = app.emit("shortcuts:result", serde_json::json!({
                "success": true,
                "result": result,
            }));

            // Fire x-success callback if provided
            if let Some(success_url) = x_success {
                let callback = format!(
                    "{}{}result={}",
                    success_url,
                    if success_url.contains('?') { "&" } else { "?" },
                    urlencoding(&result),
                );
                let _ = open::that(&callback);
            }
        }
        Err(error) => {
            eprintln!("[Shortcuts] Action failed: {}", error);

            let _ = app.emit("shortcuts:result", serde_json::json!({
                "success": false,
                "error": error,
            }));

            // Fire x-error callback if provided
            if let Some(error_url) = x_error {
                let callback = format!(
                    "{}{}errorMessage={}",
                    error_url,
                    if error_url.contains('?') { "&" } else { "?" },
                    urlencoding(&error),
                );
                let _ = open::that(&callback);
            }
        }
    }
}

/// Set the macOS clipboard content.
fn set_clipboard(text: &str) {
    let mut child = match std::process::Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[Shortcuts] Failed to run pbcopy: {}", e);
            return;
        }
    };
    if let Some(ref mut stdin) = child.stdin {
        use std::io::Write;
        let _ = stdin.write_all(text.as_bytes());
    }
    let _ = child.wait();
}

/// Simple percent-encoding for URL parameters.
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_xcallback() {
        let action = parse_deep_link(
            "agentx://x-callback-url/translate?text=hello&target_lang=zh&x-success=shortcuts://callback",
        ).unwrap();
        assert_eq!(action.action, "translate");
        assert_eq!(action.params.get("text").unwrap(), "hello");
        assert_eq!(action.params.get("target_lang").unwrap(), "zh");
        assert_eq!(action.x_success.as_deref(), Some("shortcuts://callback"));
    }

    #[test]
    fn test_parse_simple() {
        let action = parse_deep_link("agentx://summarize?text=some+long+text").unwrap();
        assert_eq!(action.action, "summarize");
        assert_eq!(action.params.get("text").unwrap(), "some long text");
    }

    #[test]
    fn test_parse_run_prefix() {
        let action = parse_deep_link("agentx://run/chat?prompt=hello").unwrap();
        assert_eq!(action.action, "chat");
        assert_eq!(action.params.get("prompt").unwrap(), "hello");
    }
}
