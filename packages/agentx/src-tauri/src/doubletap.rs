//! Double-tap modifier key shortcut detection via NSEvent global monitor.
//!
//! Standard global shortcuts (modifier+key) use `tauri-plugin-global-shortcut`.
//! Double-tap shortcuts (pressing a modifier twice within 400ms) need a custom
//! event monitor because the OS hotkey API doesn't support this pattern.
//!
//! Format: `"DoubleTap:Ctrl"`, `"DoubleTap:Option"`, `"DoubleTap:Cmd"`, `"DoubleTap:Shift"`

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::AppHandle;

/// Fixed threshold: two presses within 400ms counts as a double-tap.
const DOUBLETAP_THRESHOLD_MS: u64 = 400;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

struct Registration {
    shortcut_id: String,
    flag_bit: u64,
}

/// Parse the modifier name from a `"DoubleTap:Modifier"` string.
/// Also accepts (and ignores) a legacy third segment like `"DoubleTap:Ctrl:450"`.
fn parse_modifier(shortcut: &str) -> Option<&str> {
    let rest = shortcut.strip_prefix("DoubleTap:")?;
    // Take only the modifier name, ignore anything after a second ':'
    Some(rest.split(':').next().unwrap_or(rest))
}

static REGISTRATIONS: Mutex<Option<HashMap<String, Registration>>> = Mutex::new(None);

/// Per-modifier tracking for the detection algorithm.
struct ModifierTrack {
    /// Timestamp (ms) of the last lone press of this modifier.
    last_press_ms: u64,
    /// Whether the modifier was released since the last press (needed to
    /// distinguish press-release-press from press-hold).
    released: bool,
}

static TRACK: Mutex<Option<HashMap<u64, ModifierTrack>>> = Mutex::new(None);
static PREV_FLAGS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[cfg(target_os = "macos")]
static mut GLOBAL_MONITOR_PTR: *mut std::ffi::c_void = std::ptr::null_mut();
#[cfg(target_os = "macos")]
static mut LOCAL_MONITOR_PTR: *mut std::ffi::c_void = std::ptr::null_mut();

/// Stored AppHandle so the monitor block can dispatch actions.
static APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);

// ---------------------------------------------------------------------------
// Modifier mapping
// ---------------------------------------------------------------------------

/// macOS modifier flag bits.
const FLAG_SHIFT: u64 = 1 << 17;
const FLAG_CTRL: u64 = 1 << 18;
const FLAG_OPTION: u64 = 1 << 19;
const FLAG_CMD: u64 = 1 << 20;

/// Map a modifier name (from the shortcut string) to its macOS flag bit.
pub fn modifier_flag(name: &str) -> Option<u64> {
    match name {
        "Ctrl" => Some(FLAG_CTRL),
        "Shift" => Some(FLAG_SHIFT),
        "Option" => Some(FLAG_OPTION),
        "Cmd" => Some(FLAG_CMD),
        _ => None,
    }
}

/// All modifier bits we care about.
const ALL_MOD_FLAGS: u64 = FLAG_SHIFT | FLAG_CTRL | FLAG_OPTION | FLAG_CMD;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Validate a double-tap shortcut string.  Returns `Ok(true)` if valid.
pub fn validate(shortcut: &str) -> Result<bool, String> {
    let modifier = parse_modifier(shortcut)
        .ok_or_else(|| "Not a DoubleTap shortcut".to_string())?;
    if modifier_flag(modifier).is_some() {
        Ok(true)
    } else {
        Err(format!("Invalid double-tap modifier: {modifier}"))
    }
}

/// Check if a double-tap shortcut is registered (any id).
pub fn is_registered(shortcut: &str) -> bool {
    let modifier = match parse_modifier(shortcut) {
        Some(m) => m,
        None => return false,
    };
    let flag = match modifier_flag(modifier) {
        Some(f) => f,
        None => return false,
    };
    let guard = REGISTRATIONS.lock().unwrap();
    if let Some(map) = guard.as_ref() {
        map.values().any(|r| r.flag_bit == flag)
    } else {
        false
    }
}

/// Find which shortcut id owns a double-tap shortcut (for conflict detection).
pub fn find_owner(shortcut: &str) -> Option<String> {
    let modifier = parse_modifier(shortcut)?;
    let flag = modifier_flag(modifier)?;
    let guard = REGISTRATIONS.lock().unwrap();
    guard
        .as_ref()?
        .values()
        .find(|r| r.flag_bit == flag)
        .map(|r| r.shortcut_id.clone())
}

/// Register a double-tap shortcut for a feature id.
/// Installs the global NSEvent monitor lazily on first registration.
pub fn register(app: &AppHandle, id: &str, shortcut: &str) -> Result<(), String> {
    let modifier = parse_modifier(shortcut)
        .ok_or_else(|| "Not a DoubleTap shortcut".to_string())?;
    let flag = modifier_flag(modifier)
        .ok_or_else(|| format!("Invalid modifier: {modifier}"))?;

    // Store app handle for the monitor callback
    {
        let mut handle = APP_HANDLE.lock().unwrap();
        *handle = Some(app.clone());
    }

    // Add registration
    {
        let mut guard = REGISTRATIONS.lock().unwrap();
        let map = guard.get_or_insert_with(HashMap::new);
        map.insert(
            id.to_string(),
            Registration {
                shortcut_id: id.to_string(),
                flag_bit: flag,
            },
        );
    }

    // Ensure tracking map exists
    {
        let mut guard = TRACK.lock().unwrap();
        guard.get_or_insert_with(HashMap::new);
    }

    // Install monitor if not yet installed
    #[cfg(target_os = "macos")]
    install_monitor();

    Ok(())
}

/// Unregister a double-tap shortcut by feature id.
/// Removes the global monitor if no registrations remain.
pub fn unregister(id: &str) {
    let mut guard = REGISTRATIONS.lock().unwrap();
    if let Some(map) = guard.as_mut() {
        map.remove(id);
        if map.is_empty() {
            drop(guard);
            #[cfg(target_os = "macos")]
            remove_monitor();
        }
    }
}

// ---------------------------------------------------------------------------
// macOS NSEvent monitor
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
fn install_monitor() {
    use objc2::msg_send;

    unsafe {
        if !GLOBAL_MONITOR_PTR.is_null() {
            return; // already installed
        }

        let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();

        // NSEventMaskFlagsChanged = 1 << 12 = 4096
        let mask: u64 = 1 << 12;

        // Global monitor — fires when modifier keys change in OTHER apps.
        let global_block =
            block2::StackBlock::new(|event: *const objc2::runtime::AnyObject| {
                if event.is_null() {
                    return;
                }
                let raw_flags: u64 = msg_send![event, modifierFlags];
                let flags = raw_flags & ALL_MOD_FLAGS;
                handle_flags_changed(flags);
            });

        let gm: *mut objc2::runtime::AnyObject = msg_send![
            ns_event_cls,
            addGlobalMonitorForEventsMatchingMask: mask
            handler: &*global_block
        ];
        GLOBAL_MONITOR_PTR = gm as *mut std::ffi::c_void;

        // Local monitor — fires when modifier keys change in OUR app
        // (e.g. when the quickchat NSPanel is key window).
        // addLocalMonitorForEventsMatchingMask returns the (possibly modified)
        // event; we pass it through unchanged.
        let local_block = block2::StackBlock::new(
            |event: *const objc2::runtime::AnyObject| -> *const objc2::runtime::AnyObject {
                if !event.is_null() {
                    let raw_flags: u64 = msg_send![event, modifierFlags];
                    let flags = raw_flags & ALL_MOD_FLAGS;
                    handle_flags_changed(flags);
                }
                event // pass event through
            },
        );

        let lm: *mut objc2::runtime::AnyObject = msg_send![
            ns_event_cls,
            addLocalMonitorForEventsMatchingMask: mask
            handler: &*local_block
        ];
        LOCAL_MONITOR_PTR = lm as *mut std::ffi::c_void;
    }
}

#[cfg(target_os = "macos")]
fn remove_monitor() {
    use objc2::msg_send;
    unsafe {
        let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();
        if !GLOBAL_MONITOR_PTR.is_null() {
            let monitor = GLOBAL_MONITOR_PTR as *mut objc2::runtime::AnyObject;
            let _: () = msg_send![ns_event_cls, removeMonitor: monitor];
            GLOBAL_MONITOR_PTR = std::ptr::null_mut();
        }
        if !LOCAL_MONITOR_PTR.is_null() {
            let monitor = LOCAL_MONITOR_PTR as *mut objc2::runtime::AnyObject;
            let _: () = msg_send![ns_event_cls, removeMonitor: monitor];
            LOCAL_MONITOR_PTR = std::ptr::null_mut();
        }
    }
}

// ---------------------------------------------------------------------------
// Detection algorithm
// ---------------------------------------------------------------------------

fn handle_flags_changed(new_flags: u64) {
    use std::sync::atomic::Ordering;

    let old_flags = PREV_FLAGS.swap(new_flags, Ordering::SeqCst);
    let changed = old_flags ^ new_flags;
    if changed == 0 {
        return;
    }

    // Determine which single modifier toggled.
    // If multiple changed at once, ignore (user pressed two modifiers simultaneously).
    let toggled_bit = if changed.count_ones() == 1 {
        changed
    } else {
        // Check if exactly one of our tracked bits changed
        let our_changed = changed & ALL_MOD_FLAGS;
        if our_changed.count_ones() == 1 {
            our_changed
        } else {
            return;
        }
    };

    // Is this bit among our tracked modifiers?
    if toggled_bit & ALL_MOD_FLAGS == 0 {
        return;
    }

    let is_press = (new_flags & toggled_bit) != 0;

    let now_ms = {
        use std::time::SystemTime;
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    };

    let mut track_guard = TRACK.lock().unwrap();
    let track_map = match track_guard.as_mut() {
        Some(m) => m,
        None => return,
    };

    if is_press {
        // Check for double-tap: same modifier pressed again after being released
        if let Some(t) = track_map.get(&toggled_bit) {
            if t.released && (now_ms - t.last_press_ms) < DOUBLETAP_THRESHOLD_MS {
                // Double-tap detected! Find the registered action.
                drop(track_guard);
                fire_doubletap(toggled_bit);

                // Reset tracking for this modifier
                let mut tg = TRACK.lock().unwrap();
                if let Some(m) = tg.as_mut() {
                    m.remove(&toggled_bit);
                }
                return;
            }
        }
        // Record this press
        track_map.insert(
            toggled_bit,
            ModifierTrack {
                last_press_ms: now_ms,
                released: false,
            },
        );
    } else {
        // Release — mark as released for double-tap detection
        if let Some(t) = track_map.get_mut(&toggled_bit) {
            t.released = true;
        }
    }
}

fn fire_doubletap(flag_bit: u64) {
    // Find which shortcut id is registered for this modifier
    let shortcut_id = {
        let guard = REGISTRATIONS.lock().unwrap();
        guard
            .as_ref()
            .and_then(|map| {
                map.values()
                    .find(|r| r.flag_bit == flag_bit)
                    .map(|r| r.shortcut_id.clone())
            })
    };

    let Some(id) = shortcut_id else { return };

    // Get the stored app handle and dispatch
    let app = {
        let guard = APP_HANDLE.lock().unwrap();
        guard.clone()
    };

    if let Some(app) = app {
        crate::window::dispatch_shortcut_action(&app, &id);
    }
}
