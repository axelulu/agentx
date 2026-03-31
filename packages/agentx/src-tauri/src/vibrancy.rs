use tauri::window::{Effect, EffectState, EffectsBuilder};

/// Must match CSS `rounded-xl` = calc(0.75rem + 4px) = 16px
const CORNER_RADIUS: f64 = 16.0;

fn build_effects() -> tauri::utils::config::WindowEffectsConfig {
    EffectsBuilder::new()
        .effect(Effect::Popover)
        .state(EffectState::Active)
        .radius(CORNER_RADIUS)
        .build()
}

/// Apply native vibrancy + rounded corners to a popup window.
#[cfg(target_os = "macos")]
pub fn apply_popup_vibrancy(win: &tauri::WebviewWindow) {
    if let Err(e) = win.set_effects(Some(build_effects())) {
        eprintln!("[vibrancy] set_effects failed: {e}");
    }
    apply_corner_radius(win);
}

/// Tauri command: frontend calls this when the theme changes.
/// Sets NSWindow appearance AND reapplies vibrancy so the material re-renders.
#[tauri::command]
pub fn set_native_appearance(window: tauri::WebviewWindow, dark: bool) {
    #[cfg(target_os = "macos")]
    {
        use objc2::msg_send;
        use objc2_app_kit::{NSAppearance, NSWindow};
        use objc2_foundation::NSString;

        let Ok(ns_win_ptr) = window.ns_window() else { return };
        let ns_window: &NSWindow = unsafe { &*(ns_win_ptr as *const NSWindow) };

        unsafe {
            let name = if dark {
                NSString::from_str("NSAppearanceNameDarkAqua")
            } else {
                NSString::from_str("NSAppearanceNameAqua")
            };
            if let Some(appearance) = NSAppearance::appearanceNamed(&name) {
                let _: () = msg_send![ns_window, setAppearance: &*appearance];
            }
        }

        // Reapply vibrancy so the material re-renders with the new appearance
        let _ = window.set_effects(Some(build_effects()));
    }
}

#[cfg(target_os = "macos")]
fn apply_corner_radius(win: &tauri::WebviewWindow) {
    use objc2::msg_send;
    use objc2_app_kit::NSWindow;

    let Ok(ns_win_ptr) = win.ns_window() else { return };
    let ns_window: &NSWindow = unsafe { &*(ns_win_ptr as *const NSWindow) };

    unsafe {
        let Some(content_view) = ns_window.contentView() else { return };
        content_view.setWantsLayer(true);
        if let Some(layer) = content_view.layer() {
            let _: () = msg_send![&layer, setCornerRadius: CORNER_RADIUS];
            let _: () = msg_send![&layer, setMasksToBounds: true];
        }
        ns_window.setHasShadow(true);
        ns_window.invalidateShadow();
    }
}
