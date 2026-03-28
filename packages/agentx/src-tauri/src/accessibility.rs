// macOS Accessibility API integration
// Provides full UI element tree reading and action execution for any application

#![allow(non_upper_case_globals)]

#[cfg(target_os = "macos")]
use core_foundation::{
    array::CFArray,
    base::{CFType, CFTypeRef, TCFType},
    boolean::CFBoolean,
    number::CFNumber,
    string::{CFString, CFStringRef},
};

#[cfg(target_os = "macos")]
use core_graphics::display::CGPoint;

#[cfg(target_os = "macos")]
use serde_json::{json, Value};

// ---------------------------------------------------------------------------
// FFI declarations for macOS Accessibility API
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
type AXUIElementRef = CFTypeRef;

#[cfg(target_os = "macos")]
type AXError = i32;

#[cfg(target_os = "macos")]
const kAXErrorSuccess: AXError = 0;

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXUIElementCreateSystemWide() -> AXUIElementRef;
    fn AXUIElementCreateApplication(pid: i32) -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementCopyAttributeNames(
        element: AXUIElementRef,
        names: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementGetAttributeValueCount(
        element: AXUIElementRef,
        attribute: CFStringRef,
        count: *mut i64,
    ) -> AXError;
    fn AXUIElementPerformAction(
        element: AXUIElementRef,
        action: CFStringRef,
    ) -> AXError;
    fn AXUIElementSetAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: CFTypeRef,
    ) -> AXError;
    fn AXIsProcessTrusted() -> bool;
    fn AXIsProcessTrustedWithOptions(options: CFTypeRef) -> bool;
    fn AXValueGetValue(
        value: AXUIElementRef,
        value_type: u32,
        value_ptr: *mut std::ffi::c_void,
    ) -> bool;
    fn AXValueGetType(value: AXUIElementRef) -> u32;
    fn AXUIElementCopyElementAtPosition(
        application: AXUIElementRef,
        x: f32,
        y: f32,
        element: *mut AXUIElementRef,
    ) -> AXError;
}

// AXValue types
#[cfg(target_os = "macos")]
const kAXValueCGPointType: u32 = 1;
#[cfg(target_os = "macos")]
const kAXValueCGSizeType: u32 = 2;

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Debug, Clone, Copy)]
struct CGSize {
    width: f64,
    height: f64,
}

// ---------------------------------------------------------------------------
// Core Foundation helpers
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
unsafe fn cf_release(r: CFTypeRef) {
    if !r.is_null() {
        core_foundation::base::CFRelease(r);
    }
}

#[cfg(target_os = "macos")]
unsafe fn ax_get_attribute(element: AXUIElementRef, attr: &str) -> Option<CFTypeRef> {
    let cf_attr = CFString::new(attr);
    let mut value: CFTypeRef = std::ptr::null();
    let err = AXUIElementCopyAttributeValue(element, cf_attr.as_concrete_TypeRef(), &mut value);
    if err == kAXErrorSuccess && !value.is_null() {
        Some(value)
    } else {
        None
    }
}

#[cfg(target_os = "macos")]
unsafe fn ax_get_string(element: AXUIElementRef, attr: &str) -> Option<String> {
    let value = ax_get_attribute(element, attr)?;
    let cf_str = CFString::wrap_under_create_rule(value as CFStringRef);
    Some(cf_str.to_string())
}

#[cfg(target_os = "macos")]
unsafe fn ax_get_number(element: AXUIElementRef, attr: &str) -> Option<i64> {
    let value = ax_get_attribute(element, attr)?;
    let cf_num = CFNumber::wrap_under_create_rule(value as _);
    cf_num.to_i64()
}

#[cfg(target_os = "macos")]
unsafe fn ax_get_bool(element: AXUIElementRef, attr: &str) -> Option<bool> {
    let value = ax_get_attribute(element, attr)?;
    let cf_bool = CFBoolean::wrap_under_create_rule(value as _);
    Some(cf_bool == CFBoolean::true_value())
}

#[cfg(target_os = "macos")]
unsafe fn ax_get_position(element: AXUIElementRef) -> Option<(f64, f64)> {
    let value = ax_get_attribute(element, "AXPosition")?;
    let vtype = AXValueGetType(value);
    if vtype == kAXValueCGPointType {
        let mut point = CGPoint::new(0.0, 0.0);
        if AXValueGetValue(
            value,
            kAXValueCGPointType,
            &mut point as *mut CGPoint as *mut std::ffi::c_void,
        ) {
            cf_release(value);
            return Some((point.x, point.y));
        }
    }
    cf_release(value);
    None
}

#[cfg(target_os = "macos")]
unsafe fn ax_get_size(element: AXUIElementRef) -> Option<(f64, f64)> {
    let value = ax_get_attribute(element, "AXSize")?;
    let vtype = AXValueGetType(value);
    if vtype == kAXValueCGSizeType {
        let mut size = CGSize {
            width: 0.0,
            height: 0.0,
        };
        if AXValueGetValue(
            value,
            kAXValueCGSizeType,
            &mut size as *mut CGSize as *mut std::ffi::c_void,
        ) {
            cf_release(value);
            return Some((size.width, size.height));
        }
    }
    cf_release(value);
    None
}

#[cfg(target_os = "macos")]
unsafe fn ax_get_children_count(element: AXUIElementRef) -> i64 {
    let mut count: i64 = 0;
    let cf_attr = CFString::new("AXChildren");
    AXUIElementGetAttributeValueCount(element, cf_attr.as_concrete_TypeRef(), &mut count);
    count
}

// ---------------------------------------------------------------------------
// Frontmost application helpers
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
unsafe fn get_frontmost_pid() -> Option<i32> {
    let system = AXUIElementCreateSystemWide();
    let pid_val = ax_get_attribute(system, "AXFocusedApplication")?;
    // Get PID from the focused application element
    let mut pid: i32 = 0;
    extern "C" {
        fn AXUIElementGetPid(element: AXUIElementRef, pid: *mut i32) -> AXError;
    }
    let err = AXUIElementGetPid(pid_val, &mut pid);
    cf_release(pid_val);
    cf_release(system);
    if err == kAXErrorSuccess {
        Some(pid)
    } else {
        None
    }
}

// ---------------------------------------------------------------------------
// Element serialization
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
unsafe fn serialize_element(element: AXUIElementRef, depth: u32, max_depth: u32) -> Value {
    let mut obj = serde_json::Map::new();

    // Basic attributes
    if let Some(role) = ax_get_string(element, "AXRole") {
        obj.insert("role".into(), json!(role));
    }
    if let Some(subrole) = ax_get_string(element, "AXSubrole") {
        obj.insert("subrole".into(), json!(subrole));
    }
    if let Some(title) = ax_get_string(element, "AXTitle") {
        if !title.is_empty() {
            obj.insert("title".into(), json!(title));
        }
    }
    if let Some(desc) = ax_get_string(element, "AXDescription") {
        if !desc.is_empty() {
            obj.insert("description".into(), json!(desc));
        }
    }
    if let Some(value) = ax_get_string(element, "AXValue") {
        if !value.is_empty() {
            // Truncate very long values
            let truncated = if value.len() > 200 {
                format!("{}...", &value[..200])
            } else {
                value
            };
            obj.insert("value".into(), json!(truncated));
        }
    }
    if let Some(role_desc) = ax_get_string(element, "AXRoleDescription") {
        obj.insert("roleDescription".into(), json!(role_desc));
    }
    if let Some(identifier) = ax_get_string(element, "AXIdentifier") {
        if !identifier.is_empty() {
            obj.insert("identifier".into(), json!(identifier));
        }
    }
    if let Some(label) = ax_get_string(element, "AXLabel") {
        if !label.is_empty() {
            obj.insert("label".into(), json!(label));
        }
    }
    if let Some(help) = ax_get_string(element, "AXHelp") {
        if !help.is_empty() {
            obj.insert("help".into(), json!(help));
        }
    }

    // State attributes
    if let Some(enabled) = ax_get_bool(element, "AXEnabled") {
        if !enabled {
            obj.insert("enabled".into(), json!(false));
        }
    }
    if let Some(focused) = ax_get_bool(element, "AXFocused") {
        if focused {
            obj.insert("focused".into(), json!(true));
        }
    }
    if let Some(selected) = ax_get_bool(element, "AXSelected") {
        if selected {
            obj.insert("selected".into(), json!(true));
        }
    }

    // Position & size
    if let Some((x, y)) = ax_get_position(element) {
        obj.insert("position".into(), json!({"x": x.round(), "y": y.round()}));
    }
    if let Some((w, h)) = ax_get_size(element) {
        obj.insert("size".into(), json!({"width": w.round(), "height": h.round()}));
    }

    // Children (recursive, depth-limited)
    if depth < max_depth {
        let children_count = ax_get_children_count(element);
        if children_count > 0 {
            if let Some(children_ref) = ax_get_attribute(element, "AXChildren") {
                let children: CFArray<CFType> =
                    CFArray::wrap_under_create_rule(children_ref as _);
                let mut child_arr = Vec::new();
                for i in 0..children.len() {
                    let child = children.get(i).unwrap();
                    let child_ref = child.as_CFTypeRef();
                    // Retain before passing since serialize_element doesn't take ownership
                    core_foundation::base::CFRetain(child_ref);
                    let child_json = serialize_element(child_ref, depth + 1, max_depth);
                    cf_release(child_ref);
                    child_arr.push(child_json);
                }
                if !child_arr.is_empty() {
                    obj.insert("children".into(), json!(child_arr));
                }
            }
        }
    } else {
        let children_count = ax_get_children_count(element);
        if children_count > 0 {
            obj.insert("childrenCount".into(), json!(children_count));
        }
    }

    Value::Object(obj)
}

// ---------------------------------------------------------------------------
// Compact element serialization (for large trees)
// Only includes role, title/label, value, and children - skips position/size
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
unsafe fn serialize_element_compact(element: AXUIElementRef, depth: u32, max_depth: u32) -> Value {
    let mut obj = serde_json::Map::new();

    if let Some(role) = ax_get_string(element, "AXRole") {
        obj.insert("role".into(), json!(role));
    }
    if let Some(title) = ax_get_string(element, "AXTitle") {
        if !title.is_empty() {
            obj.insert("title".into(), json!(title));
        }
    }
    if let Some(desc) = ax_get_string(element, "AXDescription") {
        if !desc.is_empty() {
            obj.insert("desc".into(), json!(desc));
        }
    }
    if let Some(value) = ax_get_string(element, "AXValue") {
        if !value.is_empty() {
            let truncated = if value.len() > 100 {
                format!("{}...", &value[..100])
            } else {
                value
            };
            obj.insert("value".into(), json!(truncated));
        }
    }
    if let Some(identifier) = ax_get_string(element, "AXIdentifier") {
        if !identifier.is_empty() {
            obj.insert("id".into(), json!(identifier));
        }
    }
    if let Some(focused) = ax_get_bool(element, "AXFocused") {
        if focused {
            obj.insert("focused".into(), json!(true));
        }
    }

    // Children
    if depth < max_depth {
        let children_count = ax_get_children_count(element);
        if children_count > 0 {
            if let Some(children_ref) = ax_get_attribute(element, "AXChildren") {
                let children: CFArray<CFType> =
                    CFArray::wrap_under_create_rule(children_ref as _);
                let mut child_arr = Vec::new();
                for i in 0..children.len() {
                    let child = children.get(i).unwrap();
                    let child_ref = child.as_CFTypeRef();
                    core_foundation::base::CFRetain(child_ref);
                    let child_json = serialize_element_compact(child_ref, depth + 1, max_depth);
                    cf_release(child_ref);
                    child_arr.push(child_json);
                }
                if !child_arr.is_empty() {
                    obj.insert("children".into(), json!(child_arr));
                }
            }
        }
    } else {
        let children_count = ax_get_children_count(element);
        if children_count > 0 {
            obj.insert("childrenCount".into(), json!(children_count));
        }
    }

    Value::Object(obj)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Check if accessibility permission is granted
#[cfg(target_os = "macos")]
pub fn is_trusted() -> bool {
    unsafe { AXIsProcessTrusted() }
}

/// Prompt user to grant accessibility permission (shows system dialog)
#[cfg(target_os = "macos")]
pub fn prompt_trust() -> bool {
    unsafe {
        let key = CFString::new("AXTrustedCheckOptionPrompt");
        let dict = core_foundation::dictionary::CFDictionary::from_CFType_pairs(&[(
            key.as_CFType(),
            CFBoolean::true_value().as_CFType(),
        )]);
        AXIsProcessTrustedWithOptions(dict.as_CFTypeRef())
    }
}

/// Get info about the frontmost application
#[cfg(target_os = "macos")]
pub fn get_frontmost_app() -> Result<Value, String> {
    unsafe {
        let system = AXUIElementCreateSystemWide();
        let focused_app = ax_get_attribute(system, "AXFocusedApplication")
            .ok_or("Failed to get focused application")?;

        let mut pid: i32 = 0;
        extern "C" {
            fn AXUIElementGetPid(element: AXUIElementRef, pid: *mut i32) -> AXError;
        }
        AXUIElementGetPid(focused_app, &mut pid);

        let title = ax_get_string(focused_app, "AXTitle").unwrap_or_default();
        let role = ax_get_string(focused_app, "AXRole").unwrap_or_default();

        // Get focused window info
        let focused_window = ax_get_attribute(focused_app, "AXFocusedWindow");
        let window_info = if let Some(win) = focused_window {
            let win_title = ax_get_string(win, "AXTitle").unwrap_or_default();
            let pos = ax_get_position(win);
            let size = ax_get_size(win);
            cf_release(win);
            json!({
                "title": win_title,
                "position": pos.map(|(x,y)| json!({"x": x.round(), "y": y.round()})),
                "size": size.map(|(w,h)| json!({"width": w.round(), "height": h.round()})),
            })
        } else {
            json!(null)
        };

        // Count windows
        let window_count = ax_get_children_count(focused_app);

        cf_release(focused_app);
        cf_release(system);

        Ok(json!({
            "pid": pid,
            "name": title,
            "role": role,
            "focusedWindow": window_info,
            "windowCount": window_count,
        }))
    }
}

/// Get selected text from the frontmost app's focused element via AXSelectedText.
/// This is instant — no clipboard manipulation, no Cmd+C simulation.
#[cfg(target_os = "macos")]
pub fn get_selected_text_ax() -> Option<String> {
    unsafe {
        let pid = get_frontmost_pid()?;
        let app = AXUIElementCreateApplication(pid);
        let focused = ax_get_attribute(app, "AXFocusedUIElement");

        let result = focused.and_then(|el| {
            let text = ax_get_string(el, "AXSelectedText");
            cf_release(el);
            text
        }).filter(|s| !s.is_empty());

        cf_release(app);
        result
    }
}

/// Get the UI element tree of the frontmost app's focused window
#[cfg(target_os = "macos")]
pub fn get_ui_tree(pid: Option<i32>, max_depth: u32, compact: bool) -> Result<Value, String> {
    unsafe {
        let target_pid = match pid {
            Some(p) => p,
            None => get_frontmost_pid().ok_or("Failed to get frontmost app PID")?,
        };

        let app = AXUIElementCreateApplication(target_pid);
        let window = ax_get_attribute(app, "AXFocusedWindow")
            .ok_or("Failed to get focused window. App may not have an active window.")?;

        let tree = if compact {
            serialize_element_compact(window, 0, max_depth)
        } else {
            serialize_element(window, 0, max_depth)
        };

        cf_release(window);
        cf_release(app);

        Ok(tree)
    }
}

/// Get the currently focused UI element
#[cfg(target_os = "macos")]
pub fn get_focused_element(pid: Option<i32>) -> Result<Value, String> {
    unsafe {
        let target_pid = match pid {
            Some(p) => p,
            None => get_frontmost_pid().ok_or("Failed to get frontmost app PID")?,
        };

        let app = AXUIElementCreateApplication(target_pid);
        let focused = ax_get_attribute(app, "AXFocusedUIElement")
            .ok_or("Failed to get focused element")?;

        let result = serialize_element(focused, 0, 2);

        cf_release(focused);
        cf_release(app);

        Ok(result)
    }
}

/// Get all attribute names of the focused element (for debugging)
#[cfg(target_os = "macos")]
pub fn get_element_attributes(pid: Option<i32>) -> Result<Vec<String>, String> {
    unsafe {
        let target_pid = match pid {
            Some(p) => p,
            None => get_frontmost_pid().ok_or("Failed to get frontmost app PID")?,
        };

        let app = AXUIElementCreateApplication(target_pid);
        let focused = ax_get_attribute(app, "AXFocusedUIElement")
            .ok_or("Failed to get focused element")?;

        let mut names_ref: CFTypeRef = std::ptr::null();
        let err = AXUIElementCopyAttributeNames(focused, &mut names_ref);

        cf_release(focused);
        cf_release(app);

        if err != kAXErrorSuccess || names_ref.is_null() {
            return Ok(vec![]);
        }

        let names: CFArray<CFString> = CFArray::wrap_under_create_rule(names_ref as _);
        let mut result = Vec::new();
        for i in 0..names.len() {
            if let Some(name) = names.get(i) {
                result.push(name.to_string());
            }
        }
        Ok(result)
    }
}

/// Perform an action on a focused element (e.g., AXPress, AXConfirm)
#[cfg(target_os = "macos")]
pub fn perform_action_on_focused(pid: Option<i32>, action: &str) -> Result<(), String> {
    unsafe {
        let target_pid = match pid {
            Some(p) => p,
            None => get_frontmost_pid().ok_or("Failed to get frontmost app PID")?,
        };

        let app = AXUIElementCreateApplication(target_pid);
        let focused = ax_get_attribute(app, "AXFocusedUIElement")
            .ok_or("Failed to get focused element")?;

        let cf_action = CFString::new(action);
        let err = AXUIElementPerformAction(focused, cf_action.as_concrete_TypeRef());

        cf_release(focused);
        cf_release(app);

        if err == kAXErrorSuccess {
            Ok(())
        } else {
            Err(format!("AXUIElementPerformAction failed with error: {}", err))
        }
    }
}

/// Set a value on the focused element (e.g., set text in a text field)
#[cfg(target_os = "macos")]
pub fn set_value_on_focused(pid: Option<i32>, value: &str) -> Result<(), String> {
    unsafe {
        let target_pid = match pid {
            Some(p) => p,
            None => get_frontmost_pid().ok_or("Failed to get frontmost app PID")?,
        };

        let app = AXUIElementCreateApplication(target_pid);
        let focused = ax_get_attribute(app, "AXFocusedUIElement")
            .ok_or("Failed to get focused element")?;

        let cf_attr = CFString::new("AXValue");
        let cf_value = CFString::new(value);
        let err = AXUIElementSetAttributeValue(
            focused,
            cf_attr.as_concrete_TypeRef(),
            cf_value.as_CFTypeRef(),
        );

        cf_release(focused);
        cf_release(app);

        if err == kAXErrorSuccess {
            Ok(())
        } else {
            Err(format!("AXUIElementSetAttributeValue failed with error: {}", err))
        }
    }
}

/// Get element at a specific screen coordinate
#[cfg(target_os = "macos")]
pub fn get_element_at_position(pid: Option<i32>, x: f32, y: f32) -> Result<Value, String> {
    unsafe {
        let target_pid = match pid {
            Some(p) => p,
            None => get_frontmost_pid().ok_or("Failed to get frontmost app PID")?,
        };

        let app = AXUIElementCreateApplication(target_pid);
        let mut element: AXUIElementRef = std::ptr::null();
        let err = AXUIElementCopyElementAtPosition(app, x, y, &mut element);

        cf_release(app);

        if err != kAXErrorSuccess || element.is_null() {
            return Err(format!("No element found at position ({}, {})", x, y));
        }

        let result = serialize_element(element, 0, 2);
        cf_release(element);

        Ok(result)
    }
}

/// List all running applications with windows (for app selection)
#[cfg(target_os = "macos")]
pub fn list_apps_with_windows() -> Result<Value, String> {
    use std::process::Command;

    // Use AppleScript to get list of running apps with windows
    let output = Command::new("osascript")
        .args([
            "-e",
            r#"
            set appList to {}
            tell application "System Events"
                set procs to every process whose visible is true
                repeat with p in procs
                    set appName to name of p
                    set appPID to unix id of p
                    set winCount to count of windows of p
                    set end of appList to (appPID as text) & "|" & appName & "|" & (winCount as text)
                end repeat
            end tell
            set AppleScript's text item delimiters to ";"
            return appList as text
            "#,
        ])
        .output()
        .map_err(|e| format!("Failed to list apps: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut apps = Vec::new();

    for entry in stdout.trim().split(';') {
        let parts: Vec<&str> = entry.split('|').collect();
        if parts.len() == 3 {
            if let Ok(pid) = parts[0].trim().parse::<i32>() {
                let name = parts[1].trim();
                let win_count = parts[2].trim().parse::<i32>().unwrap_or(0);
                apps.push(json!({
                    "pid": pid,
                    "name": name,
                    "windowCount": win_count,
                }));
            }
        }
    }

    Ok(json!(apps))
}
