use serde_json::Value;
use std::process::Command;

// ---------------------------------------------------------------------------
// macOS Finder Tags via xattr
// ---------------------------------------------------------------------------

/// Read Finder tags from a file using mdls
pub fn get_finder_tags(path: &str) -> Result<Vec<String>, String> {
    let output = Command::new("mdls")
        .args(["-name", "kMDItemUserTags", "-raw", path])
        .output()
        .map_err(|e| format!("Failed to run mdls: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();

    if trimmed == "(null)" || trimmed.is_empty() {
        return Ok(vec![]);
    }

    // mdls outputs plist-style:  (\n    "tag1",\n    "tag2"\n)
    let tags: Vec<String> = trimmed
        .trim_start_matches('(')
        .trim_end_matches(')')
        .split(',')
        .map(|s| {
            s.trim()
                .trim_matches('"')
                .trim_end_matches("\n0") // mdls color suffix
                .trim_end_matches("\n1")
                .trim_end_matches("\n2")
                .trim_end_matches("\n3")
                .trim_end_matches("\n4")
                .trim_end_matches("\n5")
                .trim_end_matches("\n6")
                .to_string()
        })
        .filter(|s| !s.is_empty())
        .collect();

    Ok(tags)
}

/// Set Finder tags on a file using xattr with plist
pub fn set_finder_tags(path: &str, tags: &[String]) -> Result<(), String> {
    // Build a bplist-compatible XML plist for tags
    let mut plist = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
         <plist version=\"1.0\">\n<array>\n",
    );

    for tag in tags {
        // Finder tags are stored as "TagName\n{colorIndex}" — use 0 for no color
        plist.push_str(&format!("\t<string>{}\n0</string>\n", escape_xml(tag)));
    }
    plist.push_str("</array>\n</plist>");

    // Write the plist to a temp file, then use xattr to set it
    let tmp_path = format!("/tmp/agentx_tags_{}.plist", std::process::id());
    std::fs::write(&tmp_path, &plist)
        .map_err(|e| format!("Failed to write temp plist: {}", e))?;

    // Convert XML plist to binary plist
    let convert = Command::new("plutil")
        .args(["-convert", "binary1", &tmp_path])
        .output()
        .map_err(|e| format!("Failed to convert plist: {}", e))?;

    if !convert.status.success() {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!(
            "plutil failed: {}",
            String::from_utf8_lossy(&convert.stderr)
        ));
    }

    // Read binary plist bytes
    let plist_bytes = std::fs::read(&tmp_path)
        .map_err(|e| format!("Failed to read binary plist: {}", e))?;
    let _ = std::fs::remove_file(&tmp_path);

    // Write xattr using hex encoding
    let hex = plist_bytes
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<String>();

    let status = Command::new("xattr")
        .args([
            "-wx",
            "com.apple.metadata:_kMDItemUserTags",
            &hex,
            path,
        ])
        .status()
        .map_err(|e| format!("Failed to set xattr: {}", e))?;

    if !status.success() {
        return Err("xattr command failed".to_string());
    }

    Ok(())
}

/// Set Spotlight comment (kMDItemComment) on a file
pub fn set_spotlight_comment(path: &str, comment: &str) -> Result<(), String> {
    // Build XML plist for the comment string
    let plist = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
         <!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n\
         <plist version=\"1.0\">\n\
         <string>{}</string>\n\
         </plist>",
        escape_xml(comment)
    );

    let tmp_path = format!("/tmp/agentx_comment_{}.plist", std::process::id());
    std::fs::write(&tmp_path, &plist)
        .map_err(|e| format!("Failed to write temp plist: {}", e))?;

    let convert = Command::new("plutil")
        .args(["-convert", "binary1", &tmp_path])
        .output()
        .map_err(|e| format!("Failed to convert plist: {}", e))?;

    if !convert.status.success() {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(format!(
            "plutil failed: {}",
            String::from_utf8_lossy(&convert.stderr)
        ));
    }

    let plist_bytes = std::fs::read(&tmp_path)
        .map_err(|e| format!("Failed to read binary plist: {}", e))?;
    let _ = std::fs::remove_file(&tmp_path);

    let hex = plist_bytes
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<String>();

    let status = Command::new("xattr")
        .args([
            "-wx",
            "com.apple.metadata:kMDItemComment",
            &hex,
            path,
        ])
        .status()
        .map_err(|e| format!("Failed to set comment xattr: {}", e))?;

    if !status.success() {
        return Err("xattr command failed for comment".to_string());
    }

    Ok(())
}

/// Get Spotlight comment from a file
pub fn get_spotlight_comment(path: &str) -> Result<String, String> {
    let output = Command::new("mdls")
        .args(["-name", "kMDItemComment", "-raw", path])
        .output()
        .map_err(|e| format!("Failed to run mdls: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();

    if trimmed == "(null)" || trimmed.is_empty() {
        return Ok(String::new());
    }

    Ok(trimmed.to_string())
}

/// Get file metadata (kind, size, dates) via mdls for AI analysis context
pub fn get_file_metadata(path: &str) -> Result<Value, String> {
    let output = Command::new("mdls")
        .args(["-plist", "-", path])
        .output()
        .map_err(|e| format!("Failed to run mdls: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "mdls failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Parse the plist output to extract key metadata
    let plist_str = String::from_utf8_lossy(&output.stdout);

    // Extract key fields using mdls with specific names (simpler approach)
    let fields = ["kMDItemContentType", "kMDItemKind", "kMDItemFSSize",
                  "kMDItemFSName", "kMDItemContentCreationDate", "kMDItemContentModificationDate",
                  "kMDItemDisplayName"];

    let mut metadata = serde_json::Map::new();
    // Store the raw plist for reference
    metadata.insert("raw".to_string(), Value::String(plist_str.to_string()));

    for field in fields {
        let field_output = Command::new("mdls")
            .args(["-name", field, "-raw", path])
            .output();

        if let Ok(out) = field_output {
            let val = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if val != "(null)" && !val.is_empty() {
                metadata.insert(field.to_string(), Value::String(val));
            }
        }
    }

    Ok(Value::Object(metadata))
}

/// Set custom xattr for AgentX AI analysis results
pub fn set_agentx_metadata(path: &str, analysis_json: &str) -> Result<(), String> {
    let status = Command::new("xattr")
        .args(["-w", "com.agentx.analysis", analysis_json, path])
        .status()
        .map_err(|e| format!("Failed to set AgentX xattr: {}", e))?;

    if !status.success() {
        return Err("xattr command failed for AgentX metadata".to_string());
    }

    Ok(())
}

/// Get custom AgentX analysis metadata from a file
pub fn get_agentx_metadata(path: &str) -> Result<Option<String>, String> {
    let output = Command::new("xattr")
        .args(["-p", "com.agentx.analysis", path])
        .output()
        .map_err(|e| format!("Failed to read AgentX xattr: {}", e))?;

    if !output.status.success() {
        return Ok(None);
    }

    let val = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if val.is_empty() {
        Ok(None)
    } else {
        Ok(Some(val))
    }
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
