use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

const INITIAL_WIDTH: f64 = 200.0;
const INITIAL_HEIGHT: f64 = 40.0;

#[cfg(target_os = "macos")]
static mut ISLAND_CLICK_MONITOR_PTR: *mut std::ffi::c_void = std::ptr::null_mut();

/// Global mouse-moved monitor: makes the panel key when cursor enters its frame.
/// This enables WKWebView hover/click even when another app is in the foreground.
#[cfg(target_os = "macos")]
static mut ISLAND_HOVER_MONITOR_PTR: *mut std::ffi::c_void = std::ptr::null_mut();
#[cfg(target_os = "macos")]
static mut ISLAND_MOUSE_INSIDE: bool = false;

// ---------------------------------------------------------------------------
// macOS: NSPanel for Dynamic Island — persistent, non-activating overlay
// ---------------------------------------------------------------------------
//
// Adapted from quickchat.rs with key differences:
//   - No blur handler (panel is persistent, never hides on focus loss)
//   - No global click monitor
//   - Positioned at top center of screen (near notch area)
//   - Supports dynamic resize for expand/collapse transitions
//   - canJoinAllSpaces so it appears on all virtual desktops
//   - No vibrancy (pixel art style uses opaque dark background)
// ---------------------------------------------------------------------------

#[cfg(target_os = "macos")]
static mut ISLAND_PANEL_PTR: *mut std::ffi::c_void = std::ptr::null_mut();

/// Ensure the AgentXKeyPanel class is registered (shared with quickchat).
/// We need canBecomeKeyWindow=YES for the expanded state's buttons.
#[cfg(target_os = "macos")]
fn ensure_panel_class() -> &'static objc2::runtime::AnyClass {
    // The class is registered by quickchat::ensure_panel_class() at startup.
    // If quickchat hasn't registered it yet, register it here.
    if let Some(cls) = objc2::runtime::AnyClass::get(c"AgentXKeyPanel") {
        return cls;
    }
    // Fallback: register it ourselves (same logic as quickchat.rs)
    static ISLAND_PANEL_CLASS_REGISTERED: std::sync::Once = std::sync::Once::new();
    ISLAND_PANEL_CLASS_REGISTERED.call_once(|| {
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

/// Create the NSPanel for the Dynamic Island and move the WKWebView into it.
#[cfg(target_os = "macos")]
fn setup_island_panel(win: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2_app_kit::NSWindow;

    unsafe {
        if !ISLAND_PANEL_PTR.is_null() {
            return;
        }

        let cls = ensure_panel_class();

        // Create NSPanel
        let panel: *mut objc2::runtime::AnyObject = msg_send![cls, alloc];
        let rect = objc2_foundation::NSRect::new(
            objc2_foundation::NSPoint::new(0.0, 0.0),
            objc2_foundation::NSSize::new(INITIAL_WIDTH, INITIAL_HEIGHT),
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
        // Accept mouse moved events WITHOUT requiring click-to-activate.
        // This makes CSS :hover and JS mouseenter work on any desktop.
        let _: () = msg_send![panel, setAcceptsMouseMovedEvents: true];

        // canJoinAllSpaces — panel appears on all virtual desktops
        // NSWindowCollectionBehaviorCanJoinAllSpaces = 1 << 0 = 1
        let _: () = msg_send![panel, setCollectionBehavior: 1usize];

        // Transparent background (no vibrancy — pixel art provides its own bg)
        let _: () = msg_send![panel, setOpaque: false];
        let clear_cls = objc2::runtime::AnyClass::get(c"NSColor").unwrap();
        let clear: *mut objc2::runtime::AnyObject = msg_send![clear_cls, clearColor];
        let _: () = msg_send![panel, setBackgroundColor: clear];

        // Corner radius (pill shape)
        let panel_ref: &NSWindow = &*(panel as *const NSWindow);
        if let Some(panel_content) = panel_ref.contentView() {
            panel_content.setWantsLayer(true);
            if let Some(layer) = panel_content.layer() {
                let _: () = msg_send![&layer, setCornerRadius: 20.0f64];
                let _: () = msg_send![&layer, setMasksToBounds: true];
            }
            panel_ref.setHasShadow(true);
            panel_ref.invalidateShadow();
        }

        // Move WKWebView from Tauri's window to our panel
        let Ok(ns_win_ptr) = win.ns_window() else { return };
        let ns_window: &NSWindow = &*(ns_win_ptr as *const NSWindow);
        if let Some(content_view) = ns_window.contentView() {
            if let Some(wk_class) = objc2::runtime::AnyClass::get(c"WKWebView") {
                if let Some(wk_view) = find_webview(&*content_view, wk_class) {
                    let _: () = msg_send![wk_view, removeFromSuperview];
                    let panel_content: *mut objc2::runtime::AnyObject =
                        msg_send![panel, contentView];
                    let _: () = msg_send![panel_content, addSubview: wk_view];
                    let bounds: objc2_foundation::NSRect =
                        msg_send![panel_content, bounds];
                    let _: () = msg_send![wk_view, setFrame: bounds];
                    let mask: usize = 18; // NSViewWidthSizable | NSViewHeightSizable
                    let _: () = msg_send![wk_view, setAutoresizingMask: mask];
                }
            }
        }

        ISLAND_PANEL_PTR = panel as *mut std::ffi::c_void;
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

/// Position the island panel at the top center of the main screen.
#[cfg(target_os = "macos")]
fn position_island_at_top_center(panel: *mut objc2::runtime::AnyObject) {
    use objc2::msg_send;

    unsafe {
        use objc2_app_kit::NSScreen;
        use objc2_foundation::MainThreadMarker;

        let screen_frame = MainThreadMarker::new()
            .and_then(|mtm| NSScreen::mainScreen(mtm))
            .map(|s| s.frame())
            .unwrap_or_else(|| {
                objc2_foundation::NSRect::new(
                    objc2_foundation::NSPoint::new(0.0, 0.0),
                    objc2_foundation::NSSize::new(1440.0, 900.0),
                )
            });

        let panel_frame: objc2_foundation::NSRect = msg_send![panel, frame];
        let w = panel_frame.size.width;
        let h = panel_frame.size.height;

        // Center horizontally, position at top with 8px offset
        // NSScreen coords: origin at bottom-left, Y increases upward
        let x = screen_frame.origin.x + (screen_frame.size.width - w) / 2.0;
        let y = screen_frame.origin.y + screen_frame.size.height - h - 8.0;

        let new_frame = objc2_foundation::NSRect::new(
            objc2_foundation::NSPoint::new(x, y),
            objc2_foundation::NSSize::new(w, h),
        );
        let _: () = msg_send![panel, setFrame: new_frame display: true];
    }
}

/// Install a global mouse-moved monitor that makes the island panel key
/// when the cursor enters its frame. This enables WKWebView hover/click
/// even when another app is focused (nonactivating panel won't steal focus).
#[cfg(target_os = "macos")]
fn install_island_hover_monitor() {
    use objc2::msg_send;

    unsafe {
        remove_island_hover_monitor();

        if ISLAND_PANEL_PTR.is_null() {
            return;
        }

        let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();
        // NSMouseMovedMask = 1 << 5 = 32
        let mask: u64 = 1 << 5;

        let block = block2::StackBlock::new(|_event: *const objc2::runtime::AnyObject| {
            if ISLAND_PANEL_PTR.is_null() {
                return;
            }
            let panel = ISLAND_PANEL_PTR as *mut objc2::runtime::AnyObject;

            // Get current mouse position (screen coords)
            let ns_event_cls2 = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();
            let mouse_loc: objc2_foundation::NSPoint = msg_send![ns_event_cls2, mouseLocation];
            let panel_frame: objc2_foundation::NSRect = msg_send![panel, frame];

            let inside = mouse_loc.x >= panel_frame.origin.x
                && mouse_loc.x <= panel_frame.origin.x + panel_frame.size.width
                && mouse_loc.y >= panel_frame.origin.y
                && mouse_loc.y <= panel_frame.origin.y + panel_frame.size.height;

            if inside && !ISLAND_MOUSE_INSIDE {
                ISLAND_MOUSE_INSIDE = true;
                // Make panel key so WKWebView receives hover/click events.
                // nonactivating panel: this won't bring the app to foreground.
                let nil: *const objc2::runtime::AnyObject = std::ptr::null();
                let _: () = msg_send![panel, makeKeyAndOrderFront: nil];
            } else if !inside && ISLAND_MOUSE_INSIDE {
                ISLAND_MOUSE_INSIDE = false;
                // Resign key status so keyboard goes back to the focused app
                let _: () = msg_send![panel, resignKeyWindow];
            }
        });

        let monitor: *mut objc2::runtime::AnyObject = msg_send![
            ns_event_cls,
            addGlobalMonitorForEventsMatchingMask: mask
            handler: &*block
        ];
        ISLAND_HOVER_MONITOR_PTR = monitor as *mut std::ffi::c_void;
    }
}

#[cfg(target_os = "macos")]
fn remove_island_hover_monitor() {
    use objc2::msg_send;
    unsafe {
        if !ISLAND_HOVER_MONITOR_PTR.is_null() {
            let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();
            let monitor = ISLAND_HOVER_MONITOR_PTR as *mut objc2::runtime::AnyObject;
            let _: () = msg_send![ns_event_cls, removeMonitor: monitor];
            ISLAND_HOVER_MONITOR_PTR = std::ptr::null_mut();
        }
    }
}

#[cfg(target_os = "macos")]
fn show_island_native(win: &tauri::WebviewWindow) {
    use objc2::msg_send;

    unsafe {
        if ISLAND_PANEL_PTR.is_null() {
            setup_island_panel(win);
        }
        if ISLAND_PANEL_PTR.is_null() {
            let _ = win.show();
            return;
        }
        let panel = ISLAND_PANEL_PTR as *mut objc2::runtime::AnyObject;

        // Sync appearance with system theme
        if let Ok(ns_win_ptr) = win.ns_window() {
            let tauri_win: &objc2_app_kit::NSWindow =
                &*(ns_win_ptr as *const objc2_app_kit::NSWindow);
            let win_appearance: *const objc2::runtime::AnyObject =
                msg_send![tauri_win, effectiveAppearance];
            if !win_appearance.is_null() {
                let _: () = msg_send![panel, setAppearance: win_appearance];
            }
        }

        position_island_at_top_center(panel);

        // Show panel (orderFront, not makeKeyAndOrderFront — don't steal key status on startup)
        let nil: *const objc2::runtime::AnyObject = std::ptr::null();
        let _: () = msg_send![panel, orderFront: nil];

        // Install hover monitor so the island responds to hover even when other apps are focused
        install_island_hover_monitor();
    }
}

#[cfg(target_os = "macos")]
fn hide_island_native() {
    use objc2::msg_send;
    unsafe {
        if ISLAND_PANEL_PTR.is_null() {
            return;
        }
        let panel = ISLAND_PANEL_PTR as *mut objc2::runtime::AnyObject;
        let nil: *const objc2::runtime::AnyObject = std::ptr::null();
        let _: () = msg_send![panel, orderOut: nil];
    }
}

#[cfg(target_os = "macos")]
fn resize_island_native(width: f64, height: f64, animated: bool) {
    use objc2::msg_send;
    unsafe {
        if ISLAND_PANEL_PTR.is_null() {
            return;
        }
        let panel = ISLAND_PANEL_PTR as *mut objc2::runtime::AnyObject;

        // Get current frame to preserve X center and Y top-alignment
        let current_frame: objc2_foundation::NSRect = msg_send![panel, frame];

        // Keep the panel centered horizontally and anchored to the top
        // In NSScreen coords (Y up): top edge = origin.y + height
        let current_top = current_frame.origin.y + current_frame.size.height;
        let current_center_x = current_frame.origin.x + current_frame.size.width / 2.0;

        let new_x = current_center_x - width / 2.0;
        let new_y = current_top - height; // anchor to top edge

        let new_frame = objc2_foundation::NSRect::new(
            objc2_foundation::NSPoint::new(new_x, new_y),
            objc2_foundation::NSSize::new(width, height),
        );

        if animated {
            // NSAnimationContext + custom CAMediaTimingFunction for fast-slow-fast curve.
            // This runs on the system compositor at 60fps.
            let ctx_cls = objc2::runtime::AnyClass::get(c"NSAnimationContext").unwrap();
            let _: () = msg_send![ctx_cls, beginGrouping];
            let ctx: *mut objc2::runtime::AnyObject = msg_send![ctx_cls, currentContext];
            let _: () = msg_send![ctx, setDuration: 0.42f64];
            let _: () = msg_send![ctx, setAllowsImplicitAnimation: true];

            // Custom cubic-bezier(0.76, 0, 0.24, 1) = fast-slow-fast.
            // `functionWithControlPoints::::` has unnamed selector parts which
            // msg_send! can't handle, so we use raw objc_msgSend via transmute.
            let timing_cls = objc2::runtime::AnyClass::get(c"CAMediaTimingFunction").unwrap();
            let sel = objc2::ffi::sel_registerName(
                c"functionWithControlPoints::::".as_ptr(),
            )
            .unwrap();
            type TimingSend = unsafe extern "C-unwind" fn(
                *const std::ffi::c_void,
                objc2::runtime::Sel,
                f32,
                f32,
                f32,
                f32,
            ) -> *mut objc2::runtime::AnyObject;
            let send: TimingSend =
                std::mem::transmute(objc2::ffi::objc_msgSend as *const ());
            let timing = send(
                timing_cls as *const _ as *const std::ffi::c_void,
                sel,
                0.83f32, 0.0f32, 0.17f32, 1.0f32,
            );
            let _: () = msg_send![ctx, setTimingFunction: timing];

            let animator: *mut objc2::runtime::AnyObject = msg_send![panel, animator];
            let _: () = msg_send![animator, setFrame: new_frame display: true];

            let _: () = msg_send![ctx_cls, endGrouping];
        } else {
            let _: () = msg_send![panel, setFrame: new_frame display: true];
        }
    }
}

/// Sync the island panel appearance (Aqua / DarkAqua).
#[cfg(target_os = "macos")]
pub fn sync_island_appearance_native(dark: bool) {
    use objc2::msg_send;
    use objc2_app_kit::NSAppearance;
    use objc2_foundation::NSString;

    unsafe {
        if ISLAND_PANEL_PTR.is_null() {
            return;
        }
        let panel = ISLAND_PANEL_PTR as *mut objc2::runtime::AnyObject;

        let name = if dark {
            NSString::from_str("NSAppearanceNameDarkAqua")
        } else {
            NSString::from_str("NSAppearanceNameAqua")
        };
        let Some(appearance) = NSAppearance::appearanceNamed(&name) else {
            return;
        };
        let _: () = msg_send![panel, setAppearance: &*appearance];

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
pub fn sync_island_appearance_native(_dark: bool) {}

/// Install a global mouse-down monitor that emits "island:click-outside"
/// when the user clicks anywhere outside the island panel.
#[cfg(target_os = "macos")]
fn install_island_click_monitor(app: &AppHandle) {
    use objc2::msg_send;

    unsafe {
        remove_island_click_monitor();

        if ISLAND_PANEL_PTR.is_null() {
            return;
        }

        let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();
        // NSLeftMouseDownMask (1<<1) | NSRightMouseDownMask (1<<3) = 10
        let mask: u64 = (1 << 1) | (1 << 3);

        let app_clone = app.clone();
        let block = block2::StackBlock::new(move |_event: *const objc2::runtime::AnyObject| {
            // Any click outside the app → collapse
            let _ = app_clone.emit("island:click-outside", ());
        });
        let monitor: *mut objc2::runtime::AnyObject = msg_send![
            ns_event_cls,
            addGlobalMonitorForEventsMatchingMask: mask
            handler: &*block
        ];
        ISLAND_CLICK_MONITOR_PTR = monitor as *mut std::ffi::c_void;
    }
}

#[cfg(target_os = "macos")]
fn remove_island_click_monitor() {
    use objc2::msg_send;

    unsafe {
        if !ISLAND_CLICK_MONITOR_PTR.is_null() {
            let ns_event_cls = objc2::runtime::AnyClass::get(c"NSEvent").unwrap();
            let monitor = ISLAND_CLICK_MONITOR_PTR as *mut objc2::runtime::AnyObject;
            let _: () = msg_send![ns_event_cls, removeMonitor: monitor];
            ISLAND_CLICK_MONITOR_PTR = std::ptr::null_mut();
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn install_island_click_monitor(_app: &AppHandle) {}
#[cfg(not(target_os = "macos"))]
fn remove_island_click_monitor() {}

// Non-macOS fallbacks
#[cfg(not(target_os = "macos"))]
fn show_island_native(win: &tauri::WebviewWindow) {
    let _ = win.show();
}
#[cfg(not(target_os = "macos"))]
fn hide_island_native() {}
#[cfg(not(target_os = "macos"))]
fn resize_island_native(_width: f64, _height: f64, _animated: bool) {}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Pre-create the island Tauri window so the WKWebView is ready at startup.
pub fn precreate_island_window(app: &AppHandle) {
    if app.get_webview_window("island").is_some() {
        return;
    }
    let url = WebviewUrl::App("/island.html".into());
    let win = match WebviewWindowBuilder::new(app, "island", url)
        .title("Dynamic Island")
        .inner_size(INITIAL_WIDTH, INITIAL_HEIGHT)
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
            eprintln!("[Island] Failed to pre-create window: {e}");
            return;
        }
    };

    // Show the island after a short delay to let the webview load
    let win_clone = win.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(800)).await;
        let _ = win_clone.emit("island:ready", ());
    });
}

/// Show the island panel. Called after sidecar is ready.
pub fn show_island(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("island") {
        show_island_native(&win);
    }
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn show_island_panel(app: AppHandle) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        show_island(&handle);
    });
}

#[tauri::command]
pub fn hide_island_panel(app: AppHandle) {
    let _ = app.run_on_main_thread(move || {
        hide_island_native();
    });
}

#[tauri::command]
pub fn resize_island_panel(app: AppHandle, width: f64, height: f64, animated: Option<bool>) {
    let anim = animated.unwrap_or(false);
    let _ = app.run_on_main_thread(move || {
        resize_island_native(width, height, anim);
    });
}

#[tauri::command]
pub fn sync_island_panel_appearance(app: AppHandle, dark: bool) {
    let _ = app.run_on_main_thread(move || {
        sync_island_appearance_native(dark);
    });
}

/// Called by frontend when island expands/collapses.
/// When expanded=true: installs a global click monitor → emits "island:click-outside"
/// When expanded=false: removes the monitor
#[tauri::command]
pub fn island_set_expanded(app: AppHandle, expanded: bool) {
    let handle = app.clone();
    let _ = app.run_on_main_thread(move || {
        if expanded {
            install_island_click_monitor(&handle);
        } else {
            remove_island_click_monitor();
        }
    });
}

