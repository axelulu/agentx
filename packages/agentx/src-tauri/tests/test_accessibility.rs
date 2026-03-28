// Quick smoke test for the accessibility module
// Run with: cargo test --test test_accessibility -- --nocapture

#[cfg(target_os = "macos")]
mod tests {
    #[test]
    fn test_is_trusted() {
        // This just checks the API call works without crashing
        let trusted = agentx_lib::accessibility::is_trusted();
        println!("[ax_is_trusted] trusted = {}", trusted);
        // Can be true or false depending on system settings
    }

    #[test]
    fn test_get_frontmost_app() {
        if !agentx_lib::accessibility::is_trusted() {
            println!("[SKIP] Accessibility not trusted, skipping get_frontmost_app");
            return;
        }
        match agentx_lib::accessibility::get_frontmost_app() {
            Ok(info) => println!("[ax_get_frontmost_app]\n{}", serde_json::to_string_pretty(&info).unwrap()),
            Err(e) => println!("[ax_get_frontmost_app] Error: {}", e),
        }
    }

    #[test]
    fn test_get_focused_element() {
        if !agentx_lib::accessibility::is_trusted() {
            println!("[SKIP] Accessibility not trusted, skipping get_focused_element");
            return;
        }
        match agentx_lib::accessibility::get_focused_element(None) {
            Ok(el) => println!("[ax_get_focused_element]\n{}", serde_json::to_string_pretty(&el).unwrap()),
            Err(e) => println!("[ax_get_focused_element] Error: {}", e),
        }
    }

    #[test]
    fn test_get_ui_tree_compact() {
        if !agentx_lib::accessibility::is_trusted() {
            println!("[SKIP] Accessibility not trusted, skipping get_ui_tree");
            return;
        }
        match agentx_lib::accessibility::get_ui_tree(None, 2, true) {
            Ok(tree) => {
                let json = serde_json::to_string_pretty(&tree).unwrap();
                // Print first 2000 chars to avoid flooding
                let truncated = if json.len() > 2000 { &json[..2000] } else { &json };
                println!("[ax_get_ui_tree compact depth=2]\n{}", truncated);
                if json.len() > 2000 {
                    println!("... (truncated, total {} bytes)", json.len());
                }
            }
            Err(e) => println!("[ax_get_ui_tree] Error: {}", e),
        }
    }

    #[test]
    fn test_list_apps() {
        if !agentx_lib::accessibility::is_trusted() {
            println!("[SKIP] Accessibility not trusted, skipping list_apps");
            return;
        }
        match agentx_lib::accessibility::list_apps_with_windows() {
            Ok(apps) => println!("[ax_list_apps]\n{}", serde_json::to_string_pretty(&apps).unwrap()),
            Err(e) => println!("[ax_list_apps] Error: {}", e),
        }
    }

    #[test]
    fn test_get_element_attributes() {
        if !agentx_lib::accessibility::is_trusted() {
            println!("[SKIP] Accessibility not trusted, skipping get_element_attributes");
            return;
        }
        match agentx_lib::accessibility::get_element_attributes(None) {
            Ok(attrs) => println!("[ax_get_attributes] {:?}", attrs),
            Err(e) => println!("[ax_get_attributes] Error: {}", e),
        }
    }
}
