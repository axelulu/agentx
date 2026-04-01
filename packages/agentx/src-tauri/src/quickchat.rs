use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const WIN_WIDTH: f64 = 680.0;
const WIN_HEIGHT: f64 = 480.0;

pub struct QuickChatState {
    suppress_blur: Arc<AtomicBool>,
}

// ---------------------------------------------------------------------------
// macOS: Real NSPanel with nonactivating + canBecomeKeyWindow
// ---------------------------------------------------------------------------
//
// Verified native test: accessory app + NSPanel subclass (canBecomeKeyWindow=YES)
// + nonactivating + borderless + move WKWebView from Tauri window to panel:
//   ✓ Keyboard works (typing, ESC, shortcuts)
//   ✓ Hover works
//   ✓ Menu bar stays with browser
//   ✓ Full mouse interaction
//
// Approach:
//   1. Tauri creates its normal NSWindow with WKWebView
//   2. We create a real NSPanel (subclass with canBecomeKeyWindow=YES)
//   3. We move the content view (with WKWebView) from Tauri's window to our panel
//   4. We show/hide the panel instead of Tauri's window
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
static mut PANEL_PTR: *mut std::ffi::c_void = std::ptr::null_mut();

/// Global event monitor handle — stored so we can remove it later.
#[cfg(target_os = "macos")]
static mut GLOBAL_MONITOR_PTR: *mut std::ffi::c_void = std::ptr::null_mut();

#[cfg(target_os = "macos")]
static PANEL_CLASS_REGISTERED: std::sync::Once = std::sync::Once::new();

/// Register a KeyPanel subclass of NSPanel that overrides canBecomeKeyWindow → YES.
/// Borderless panels default to canBecomeKey=NO which blocks ALL input.
#[cfg(target_os = "macos")]
fn ensure_panel_class() -> &'static objc2::runtime::AnyClass {
    PANEL_CLASS_REGISTERED.call_once(|| {
        unsafe {
            let superclass = objc2::runtime::AnyClass::get(c"NSPanel").unwrap();
            let cls = objc2::ffi::objc_allocateClassPair(
                superclass,
                c"AgentXKeyPanel".as_ptr(),
                0,
            );
            assert!(!cls.is_null());

            unsafe extern "C-unwind" fn yes(
                _: *mut objc2::runtime::AnyObject,
                _: objc2::runtime::Sel,
            ) -> objc2::runtime::Bool {
                objc2::runtime::Bool::YES
            }
            let imp: objc2::runtime::Imp =
                std::mem::transmute(yes as unsafe extern "C-unwind" fn(_, _) -> _);
            let sel = objc2::ffi::sel_registerName(c"canBecomeKeyWindow".as_ptr()).unwrap();
            objc2::ffi::class_addMethod(cls, sel, imp, c"B@:".as_ptr());

            objc2::ffi::objc_registerClassPair(cls);
        }
    });
    objc2::runtime::AnyClass::get(c"AgentXKeyPanel").unwrap()
}

/// Create the NSPanel and move the WKWebView content into it.
/// Called once, on main thread.
#[cfg(target_os = "macos")]
fn setup_panel(win: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2_app_kit::NSWindow;

    unsafe {
        if !PANEL_PTR.is_null() {
            return; // already set up
        }

        let cls = ensure_panel_class();

        // Create real NSPanel via alloc + initWithContentRect:styleMask:backing:defer:
        let panel: *mut objc2::runtime::AnyObject = msg_send![cls, alloc];
        let rect = objc2_foundation::NSRect::new(
            objc2_foundation::NSPoint::new(0.0, 0.0),
            objc2_foundation::NSSize::new(WIN_WIDTH, WIN_HEIGHT),
        );
        // styleMask: borderless (0) | nonactivatingPanel (128) = 128
        let panel: *mut objc2::runtime::AnyObject = msg_send![
            panel,
            initWithContentRect: rect
            styleMask: 128usize
            backing: 2usize  // NSBackingStoreBuffered
            defer: false
        ];

        // Panel config
        let _: () = msg_send![panel, setLevel: 3i64]; // NSFloatingWindowLevel
        let _: () = msg_send![panel, setBecomesKeyOnlyIfNeeded: false];
        let _: () = msg_send![panel, setHidesOnDeactivate: false];
        let _: () = msg_send![panel, setFloatingPanel: true];

        // Transparent background
        let _: () = msg_send![panel, setOpaque: false];
        let clear_cls = objc2::runtime::AnyClass::get(c"NSColor").unwrap();
        let clear: *mut objc2::runtime::AnyObject = msg_send![clear_cls, clearColor];
        let _: () = msg_send![panel, setBackgroundColor: clear];

        // Apply vibrancy (gaussian blur).
        let panel_ref: &NSWindow = &*(panel as *const NSWindow);
        if let Some(panel_content) = panel_ref.contentView() {
            // Don't set appearance here — it's set in show_panel_native every time

            let effect_cls = objc2::runtime::AnyClass::get(c"NSVisualEffectView").unwrap();
            let bounds: objc2_foundation::NSRect = msg_send![&*panel_content, bounds];
            let effect_view: *mut objc2::runtime::AnyObject = msg_send![effect_cls, alloc];
            let effect_view: *mut objc2::runtime::AnyObject = msg_send![effect_view, initWithFrame: bounds];
            let _: () = msg_send![effect_view, setMaterial: 21i64];
            let _: () = msg_send![effect_view, setBlendingMode: 0i64];
            let _: () = msg_send![effect_view, setState: 1i64];
            let _: () = msg_send![effect_view, setEmphasized: true];
            let _: () = msg_send![effect_view, setAutoresizingMask: 18usize];

            let nil_view: *const objc2::runtime::AnyObject = std::ptr::null();
            let _: () = msg_send![&*panel_content, addSubview: effect_view positioned: -1i64 relativeTo: nil_view];
            let _: () = msg_send![effect_view, release];
            // No tint overlay — appearance is set dynamically in show_panel_native

            // Corner radius (16px matches CSS rounded-xl)
            panel_content.setWantsLayer(true);
            if let Some(layer) = panel_content.layer() {
                let _: () = msg_send![&layer, setCornerRadius: 16.0f64];
                let _: () = msg_send![&layer, setMasksToBounds: true];
            }
            panel_ref.setHasShadow(true);
            panel_ref.invalidateShadow();
        }

        // Move the WKWebView from Tauri's window to our panel.
        // DON'T nil out Tauri's contentView — tao still references it and will crash.
        // Instead, find the WKWebView, remove it from its parent, and add to the panel.
        let Ok(ns_win_ptr) = win.ns_window() else { return };
        let ns_window: &NSWindow = &*(ns_win_ptr as *const NSWindow);
        if let Some(content_view) = ns_window.contentView() {
            if let Some(wk_class) = objc2::runtime::AnyClass::get(c"WKWebView") {
                if let Some(wk_view) = find_webview(&*content_view, wk_class) {
                    // Remove WKWebView from Tauri's window
                    let _: () = msg_send![wk_view, removeFromSuperview];
                    // Add to our panel's content view
                    let panel_content: *mut objc2::runtime::AnyObject = msg_send![panel, contentView];
                    let _: () = msg_send![panel_content, addSubview: wk_view];
                    // Set frame to fill the panel
                    let bounds: objc2_foundation::NSRect = msg_send![panel_content, bounds];
                    let _: () = msg_send![wk_view, setFrame: bounds];
                    // Auto-resize
                    let mask: usize = 18; // NSViewWidthSizable | NSViewHeightSizable
                    let _: () = msg_send![wk_view, setAutoresizingMask: mask];
                }
            }
        }

        PANEL_PTR = panel as *mut std::ffi::c_void;
    }
}

#[cfg(target_os = "macos")]
fn show_panel_native(win: &tauri::WebviewWindow) {
    use objc2::msg_send;

    unsafe {
        if PANEL_PTR.is_null() {
            setup_panel(win);
        }
        if PANEL_PTR.is_null() {
            let _ = win.show();
            let _ = win.set_focus();
            return;
        }
        let panel = PANEL_PTR as *mut objc2::runtime::AnyObject;

        // NOTE: Do NOT switch activationPolicy here. The NSPanel is already
        // nonactivating + floating + canBecomeKeyWindow — it floats above all
        // windows and takes keyboard input without activating this app.
        // Switching to .accessory and back causes macOS to re-activate the app,
        // which briefly brings the main window to front (visible flash).

        // Center the panel on the screen that contains the mouse cursor.
        // Use NSScreen coordinates directly (origin = bottom-left, Y up)
        // to avoid Tauri ↔ macOS coordinate conversion issues.
        {
            use objc2_app_kit::NSScreen;
            use objc2_foundation::MainThreadMarker;
            let screen_frame = MainThreadMarker::new()
                .and_then(|mtm| NSScreen::mainScreen(mtm))
                .map(|s| s.visibleFrame())
                .unwrap_or_else(|| objc2_foundation::NSRect::new(
                    objc2_foundation::NSPoint::new(0.0, 0.0),
                    objc2_foundation::NSSize::new(1440.0, 900.0),
                ));
            // Center: origin is bottom-left of the visible screen area
            let x = screen_frame.origin.x
                + (screen_frame.size.width - WIN_WIDTH) / 2.0;
            let y = screen_frame.origin.y
                + (screen_frame.size.height - WIN_HEIGHT) / 2.0;
            let panel_rect = objc2_foundation::NSRect::new(
                objc2_foundation::NSPoint::new(x, y),
                objc2_foundation::NSSize::new(WIN_WIDTH, WIN_HEIGHT),
            );
            let _: () = msg_send![panel, setFrame: panel_rect display: true];
        }

        // Set appearance on panel and ALL subviews to match system theme.
        // Copy from Tauri window, then also force on every subview.
        if let Ok(ns_win_ptr) = win.ns_window() {
            let tauri_win: &objc2_app_kit::NSWindow = &*(ns_win_ptr as *const objc2_app_kit::NSWindow);
            let win_appearance: *const objc2::runtime::AnyObject = msg_send![tauri_win, effectiveAppearance];
            if !win_appearance.is_null() {
                let _: () = msg_send![panel, setAppearance: win_appearance];
                // Also set on content view and all its subviews
                let content: *const objc2::runtime::AnyObject = msg_send![panel, contentView];
                if !content.is_null() {
                    let _: () = msg_send![content, setAppearance: win_appearance];
                    let subviews: *const objc2::runtime::AnyObject = msg_send![content, subviews];
                    let count: usize = msg_send![subviews, count];
                    for i in 0..count {
                        let subview: *const objc2::runtime::AnyObject = msg_send![subviews, objectAtIndex: i];
                        let _: () = msg_send![subview, setAppearance: win_appearance];
                    }
                }
            }
        }

        // Show panel
        let nil: *const objc2::runtime::AnyObject = std::ptr::null();
        let _: () = msg_send![panel, makeKeyAndOrderFront: nil];

        // Make WKWebView first responder for keyboard
        let content: *const objc2::runtime::AnyObject = msg_send![panel, contentView];
        if let Some(wk_class) = objc2::runtime::AnyClass::get(c"WKWebView") {
            if let Some(wk) = find_webview(&*content, wk_class) {
                let _: () = msg_send![panel, makeFirstResponder: wk];
            }
        }

        // Install global event monitor: click outside the panel → hide it
        install_global_click_monitor();
    }
}

/// Install a global + local mouse-down monitor that hides the panel when the
/// user clicks anywhere outside it.
#[cfg(target_os = "macos")]
fn install_global_click_monitor() {
    use objc2::msg_send;

    unsafe {
        // Remove previous monitor if any
        remove_global_click_monitor();

        if PANEL_PTR.is_null() {
            return;
        }

        let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();

        // mask: NSLeftMouseDownMask (1 << 1) | NSRightMouseDownMask (1 << 3) = 0b1010 = 10
        let mask: u64 = (1 << 1) | (1 << 3);

        // Global monitor — fires when clicking OUTSIDE the app (other apps, desktop, etc.)
        let block = block2::StackBlock::new(|_event: *const objc2::runtime::AnyObject| {
            // Any click outside the app → hide panel
            hide_panel_standalone();
        });
        let monitor: *mut objc2::runtime::AnyObject = msg_send![
            ns_event_cls,
            addGlobalMonitorForEventsMatchingMask: mask
            handler: &*block
        ];
        GLOBAL_MONITOR_PTR = monitor as *mut std::ffi::c_void;
    }
}

/// Remove the global click monitor.
#[cfg(target_os = "macos")]
fn remove_global_click_monitor() {
    use objc2::msg_send;

    unsafe {
        if !GLOBAL_MONITOR_PTR.is_null() {
            let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();
            let monitor = GLOBAL_MONITOR_PTR as *mut objc2::runtime::AnyObject;
            let _: () = msg_send![ns_event_cls, removeMonitor: monitor];
            GLOBAL_MONITOR_PTR = std::ptr::null_mut();
        }
    }
}

/// Hide the panel without needing a window reference (uses global PANEL_PTR).
/// Only acts if the panel is currently visible — avoids restoring `.regular`
/// activation policy when the panel was never shown (e.g. spurious blur
/// event from newly created Tauri window).
#[cfg(target_os = "macos")]
fn hide_panel_standalone() {
    use objc2::msg_send;
    unsafe {
        if PANEL_PTR.is_null() {
            return;
        }
        let panel = PANEL_PTR as *mut objc2::runtime::AnyObject;
        let visible: bool = msg_send![panel, isVisible];
        if !visible {
            return;
        }
        let nil: *const objc2::runtime::AnyObject = std::ptr::null();
        let _: () = msg_send![panel, orderOut: nil];
        remove_global_click_monitor();
    }
}

#[cfg(target_os = "macos")]
fn hide_panel_native(_win: &tauri::WebviewWindow) {
    hide_panel_standalone();
}

#[cfg(not(target_os = "macos"))]
fn hide_panel_standalone() {}


#[cfg(target_os = "macos")]
fn is_panel_visible(_win: &tauri::WebviewWindow) -> bool {
    use objc2::msg_send;
    unsafe {
        if PANEL_PTR.is_null() {
            return false;
        }
        let panel = PANEL_PTR as *mut objc2::runtime::AnyObject;
        let visible: bool = msg_send![panel, isVisible];
        visible
    }
}

#[cfg(target_os = "macos")]
fn find_webview(
    view: &objc2::runtime::AnyObject,
    wk_class: &objc2::runtime::AnyClass,
) -> Option<*const objc2::runtime::AnyObject> {
    unsafe {
        let is_wk: bool = objc2::msg_send![view, isKindOfClass: wk_class];
        if is_wk {
            return Some(view as *const _);
        }
        let subviews: *const objc2::runtime::AnyObject = objc2::msg_send![view, subviews];
        let count: usize = objc2::msg_send![subviews, count];
        for i in 0..count {
            let sub: *const objc2::runtime::AnyObject =
                objc2::msg_send![subviews, objectAtIndex: i];
            if let Some(found) = find_webview(&*sub, wk_class) {
                return Some(found);
            }
        }
    }
    None
}

/// Update the NSPanel appearance (Aqua / DarkAqua) and reapply vibrancy.
/// Called from the frontend whenever the theme changes so the frosted-glass
/// material matches light or dark mode even while the panel is visible.
#[cfg(target_os = "macos")]
pub fn sync_panel_appearance_native(dark: bool) {
    use objc2::msg_send;
    use objc2_app_kit::NSAppearance;
    use objc2_foundation::NSString;

    unsafe {
        if PANEL_PTR.is_null() {
            return;
        }
        let panel = PANEL_PTR as *mut objc2::runtime::AnyObject;

        let name = if dark {
            NSString::from_str("NSAppearanceNameDarkAqua")
        } else {
            NSString::from_str("NSAppearanceNameAqua")
        };
        let Some(appearance) = NSAppearance::appearanceNamed(&name) else {
            return;
        };

        // Set on panel itself
        let _: () = msg_send![panel, setAppearance: &*appearance];

        // Set on content view and all subviews (vibrancy effect view, WKWebView)
        let content: *const objc2::runtime::AnyObject = msg_send![panel, contentView];
        if !content.is_null() {
            let _: () = msg_send![content, setAppearance: &*appearance];
            let subviews: *const objc2::runtime::AnyObject = msg_send![content, subviews];
            let count: usize = msg_send![subviews, count];
            for i in 0..count {
                let subview: *const objc2::runtime::AnyObject =
                    msg_send![subviews, objectAtIndex: i];
                let _: () = msg_send![subview, setAppearance: &*appearance];
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn sync_panel_appearance_native(_dark: bool) {}

// Non-macOS fallbacks
#[cfg(not(target_os = "macos"))]
fn show_panel_native(win: &tauri::WebviewWindow) { let _ = win.show(); let _ = win.set_focus(); }
#[cfg(not(target_os = "macos"))]
fn hide_panel_native(win: &tauri::WebviewWindow) { let _ = win.hide(); }
#[cfg(not(target_os = "macos"))]
fn is_panel_visible(win: &tauri::WebviewWindow) -> bool { win.is_visible().unwrap_or(false) }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

pub fn show_quickchat_mode(app: &AppHandle, mode: &str) -> Result<(), String> {
    set_suppress_blur(app, true);

    if let Some(win) = app.get_webview_window("quickchat") {
        if is_panel_visible(&win) {
            hide_panel_native(&win);
            return Ok(());
        }
        // show_panel_native centers the panel on screen natively
        show_panel_native(&win);
        let _ = win.emit("quickchat:mode", mode);
        return Ok(());
    }

    // Fallback — window wasn't pre-created; create and show with delay
    create_and_show_quickchat(app, Some(mode.to_string()))?;
    Ok(())
}

pub fn toggle_quickchat_window(
    app: &AppHandle,
    _click_x: f64,
    _click_y: f64,
) -> Result<(), String> {
    set_suppress_blur(app, true);

    if let Some(win) = app.get_webview_window("quickchat") {
        if is_panel_visible(&win) {
            hide_panel_native(&win);
        } else {
            // show_panel_native centers the panel on screen natively
            show_panel_native(&win);
            // Reset frontend to home mode (prevents stale clipboard/chat state)
            let _ = win.emit("quickchat:ready", ());
        }
        return Ok(());
    }

    create_and_show_quickchat(app, None)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/// Pre-create the quickchat Tauri window so the WKWebView is ready before the
/// user ever triggers the shortcut.  Called from app setup (lib.rs).
/// The NSPanel is NOT shown — it will be shown lazily by show_panel_native.
pub fn precreate_quickchat_window(app: &AppHandle) {
    if app.get_webview_window("quickchat").is_some() {
        return; // already exists
    }
    let url = WebviewUrl::App("/quickchat.html".into());
    let win = match WebviewWindowBuilder::new(app, "quickchat", url)
        .title("Quick Chat")
        .inner_size(WIN_WIDTH, WIN_HEIGHT)
        .position(0.0, 0.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .build()
    {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[QuickChat] Failed to pre-create window: {e}");
            return;
        }
    };

    let win_clone = win.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let _ = win_clone.emit("quickchat:ready", ());
    });

    setup_blur_handler(app, &win);
}

/// Fallback: create and immediately show the quickchat window if it wasn't
/// pre-created (should rarely happen).
fn create_and_show_quickchat(app: &AppHandle, mode: Option<String>) -> Result<(), String> {
    precreate_quickchat_window(app);
    // The WKWebView needs time to load; show the panel after a delay.
    let handle = app.clone();
    let handle2 = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
        let _ = handle.run_on_main_thread(move || {
            if let Some(w) = handle2.get_webview_window("quickchat") {
                show_panel_native(&w);
                if let Some(m) = mode {
                    let _ = w.emit("quickchat:mode", m);
                }
            }
        });
    });
    Ok(())
}

fn set_suppress_blur(app: &AppHandle, value: bool) {
    let suppress = if let Some(state) = app.try_state::<QuickChatState>() {
        state.suppress_blur.clone()
    } else {
        let flag = Arc::new(AtomicBool::new(false));
        app.manage(QuickChatState {
            suppress_blur: flag.clone(),
        });
        flag
    };
    suppress.store(value, Ordering::SeqCst);
    if value {
        let reset = suppress.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            reset.store(false, Ordering::SeqCst);
        });
    }
}

/// Tauri command: sync the quickchat NSPanel appearance to match light/dark mode.
#[tauri::command]
pub fn sync_quickchat_panel_appearance(app: AppHandle, dark: bool) {
    let _ = app.run_on_main_thread(move || {
        sync_panel_appearance_native(dark);
    });
}

/// Tauri command: hide the quickchat NSPanel (called from frontend on ESC, etc.).
#[tauri::command]
pub fn hide_quickchat_panel(app: AppHandle) {
    let _ = app.run_on_main_thread(move || {
        hide_panel_standalone();
    });
}

fn setup_blur_handler(app: &AppHandle, win: &tauri::WebviewWindow) {
    let suppress = if let Some(state) = app.try_state::<QuickChatState>() {
        state.suppress_blur.clone()
    } else {
        let flag = Arc::new(AtomicBool::new(false));
        app.manage(QuickChatState {
            suppress_blur: flag.clone(),
        });
        flag
    };

    let win_for_blur = win.clone();
    let suppress_for_blur = suppress;
    win.on_window_event(move |event| {
        if let tauri::WindowEvent::Focused(false) = event {
            let w = win_for_blur.clone();
            let s = suppress_for_blur.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(80)).await;
                if s.load(Ordering::SeqCst) {
                    return;
                }
                hide_panel_native(&w);
            });
        }
    });
}
