use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const SERVICES_DIR: &str = "Library/Services";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinderAction {
    pub action: String,
    pub files: Vec<String>,
}

/// Returns the path to the pending finder action file.
fn pending_action_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".agentx").join("pending-finder-action.json")
}

/// Check for and consume a pending finder action file.
pub fn consume_pending_action() -> Option<FinderAction> {
    let path = pending_action_path();
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&path).ok()?;
    let _ = std::fs::remove_file(&path);
    serde_json::from_str(&content).ok()
}

/// Check if Quick Action workflows are installed.
pub fn is_installed() -> bool {
    let home = std::env::var("HOME").unwrap_or_default();
    let services = PathBuf::from(&home).join(SERVICES_DIR);
    services.join("Analyze with AgentX.workflow").exists()
}

/// Install Quick Action workflows to ~/Library/Services/
pub fn install() -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let services = PathBuf::from(&home).join(SERVICES_DIR);
    std::fs::create_dir_all(&services)
        .map_err(|e| format!("Failed to create Services directory: {}", e))?;

    // Ensure ~/.agentx directory exists for the pending action file
    let agentx_dir = PathBuf::from(&home).join(".agentx");
    std::fs::create_dir_all(&agentx_dir)
        .map_err(|e| format!("Failed to create .agentx directory: {}", e))?;

    let actions = [
        ("Analyze with AgentX", "analyze"),
        ("Summarize with AgentX", "summarize"),
        ("Rename with AgentX", "rename"),
    ];

    for (name, action) in &actions {
        create_workflow(&services, name, action)?;
    }

    // Flush macOS services cache so the new Quick Actions appear immediately
    let _ = std::process::Command::new("/System/Library/CoreServices/pbs")
        .arg("-flush")
        .output();

    Ok(())
}

/// Uninstall Quick Action workflows from ~/Library/Services/
pub fn uninstall() -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let services = PathBuf::from(&home).join(SERVICES_DIR);

    let workflows = [
        "Analyze with AgentX.workflow",
        "Summarize with AgentX.workflow",
        "Rename with AgentX.workflow",
    ];

    for name in &workflows {
        let path = services.join(name);
        if path.exists() {
            std::fs::remove_dir_all(&path)
                .map_err(|e| format!("Failed to remove {}: {}", name, e))?;
        }
    }

    // Flush cache
    let _ = std::process::Command::new("/System/Library/CoreServices/pbs")
        .arg("-flush")
        .output();

    Ok(())
}

/// Create a single Quick Action workflow bundle.
fn create_workflow(
    services_dir: &PathBuf,
    display_name: &str,
    action_name: &str,
) -> Result<(), String> {
    let workflow_dir = services_dir.join(format!("{}.workflow", display_name));
    let contents_dir = workflow_dir.join("Contents");
    // FIX: document.wflow must be in Contents/Resources/, not Contents/
    let resources_dir = contents_dir.join("Resources");
    std::fs::create_dir_all(&resources_dir)
        .map_err(|e| format!("Failed to create workflow directory: {}", e))?;

    // Write document.wflow into Resources/
    let wflow = generate_wflow(action_name);
    std::fs::write(resources_dir.join("document.wflow"), wflow)
        .map_err(|e| format!("Failed to write document.wflow: {}", e))?;

    // Write Info.plist into Contents/ (pbs reads NSServices from here)
    let info_plist = generate_info_plist(display_name);
    std::fs::write(contents_dir.join("Info.plist"), info_plist)
        .map_err(|e| format!("Failed to write Info.plist: {}", e))?;

    Ok(())
}

fn generate_shell_script(action_name: &str) -> String {
    let script = r#"#!/bin/zsh
FILES_JSON="["
FIRST=true
for f in "$@"; do
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    FILES_JSON="$FILES_JSON,"
  fi
  ESCAPED=$(echo "$f" | sed 's/\\/\\\\/g; s/"/\\"/g')
  FILES_JSON="$FILES_JSON\"$ESCAPED\""
done
FILES_JSON="$FILES_JSON]"
mkdir -p "$HOME/.agentx"
echo "{\"action\":\"__ACTION__\",\"files\":$FILES_JSON}" > "$HOME/.agentx/pending-finder-action.json"
open -a "AgentX"
"#;
    script.replace("__ACTION__", action_name)
}

fn generate_wflow(action_name: &str) -> String {
    let script = generate_shell_script(action_name);
    // Escape XML special characters in the script
    let script_escaped = script
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>AMApplicationBuild</key>
	<string>523</string>
	<key>AMApplicationVersion</key>
	<string>2.10</string>
	<key>AMDocumentVersion</key>
	<string>2</string>
	<key>actions</key>
	<array>
		<dict>
			<key>action</key>
			<dict>
				<key>AMAccepts</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Optional</key>
					<false/>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.path</string>
					</array>
				</dict>
				<key>AMActionVersion</key>
				<string>1.0.2</string>
				<key>AMProvides</key>
				<dict>
					<key>Container</key>
					<string>List</string>
					<key>Types</key>
					<array>
						<string>com.apple.cocoa.string</string>
					</array>
				</dict>
				<key>ActionBundlePath</key>
				<string>/System/Library/Automator/Run Shell Script.action</string>
				<key>ActionName</key>
				<string>Run Shell Script</string>
				<key>ActionParameters</key>
				<dict>
					<key>COMMAND_STRING</key>
					<string>{script}</string>
					<key>CheckedForUserDefaultShell</key>
					<true/>
					<key>inputMethod</key>
					<integer>1</integer>
					<key>shell</key>
					<string>/bin/zsh</string>
					<key>source</key>
					<string></string>
				</dict>
				<key>BundleIdentifier</key>
				<string>com.apple.RunShellScript</string>
				<key>CFBundleVersion</key>
				<string>1.0.2</string>
				<key>CanShowSelectedItemsWhenRun</key>
				<false/>
				<key>CanShowWhenRun</key>
				<true/>
				<key>Category</key>
				<array>
					<string>AMCategoryUtilities</string>
				</array>
				<key>Class Name</key>
				<string>RunShellScriptAction</string>
				<key>InputUUID</key>
				<string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
				<key>Keywords</key>
				<array>
					<string>Shell</string>
					<string>Script</string>
				</array>
				<key>OutputUUID</key>
				<string>F5F5F5F5-A6A6-B7B7-C8C8-D9D9D9D9D9D9</string>
				<key>UUID</key>
				<string>AABBCCDD-EEFF-0011-2233-445566778899</string>
				<key>UnlocalizedApplications</key>
				<array>
					<string>Automator</string>
				</array>
				<key>arguments</key>
				<dict>
					<key>0</key>
					<dict>
						<key>default value</key>
						<string>/bin/zsh</string>
						<key>name</key>
						<string>shell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>0</string>
					</dict>
					<key>1</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>source</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>1</string>
					</dict>
					<key>2</key>
					<dict>
						<key>default value</key>
						<integer>1</integer>
						<key>name</key>
						<string>inputMethod</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>2</string>
					</dict>
					<key>3</key>
					<dict>
						<key>default value</key>
						<string></string>
						<key>name</key>
						<string>COMMAND_STRING</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>3</string>
					</dict>
					<key>4</key>
					<dict>
						<key>default value</key>
						<false/>
						<key>name</key>
						<string>CheckedForUserDefaultShell</string>
						<key>required</key>
						<string>0</string>
						<key>type</key>
						<string>0</string>
						<key>uuid</key>
						<string>4</string>
					</dict>
				</dict>
				<key>isViewVisible</key>
				<true/>
				<key>location</key>
				<string>449.500000:253.000000</string>
				<key>nibPath</key>
				<string>/System/Library/Automator/Run Shell Script.action/Contents/Resources/Base.lproj/main.nib</string>
			</dict>
		</dict>
	</array>
	<key>connectors</key>
	<dict/>
	<key>workflowMetaData</key>
	<dict>
		<key>serviceInputTypeIdentifier</key>
		<string>com.apple.Automator.fileSystemObject</string>
		<key>serviceOutputTypeIdentifier</key>
		<string>com.apple.Automator.nothing</string>
		<key>serviceProcessesInput</key>
		<integer>0</integer>
		<key>workflowTypeIdentifier</key>
		<string>com.apple.Automator.servicesMenu</string>
	</dict>
</dict>
</plist>"#,
        script = script_escaped
    )
}

fn generate_info_plist(display_name: &str) -> String {
    let bundle_id = format!(
        "com.agentx.desktop.service.{}",
        display_name.to_lowercase().replace(' ', "-")
    );
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleIdentifier</key>
	<string>{bundle_id}</string>
	<key>CFBundleName</key>
	<string>{name}</string>
	<key>CFBundleShortVersionString</key>
	<string>1.0</string>
	<key>NSServices</key>
	<array>
		<dict>
			<key>NSMenuItem</key>
			<dict>
				<key>default</key>
				<string>{name}</string>
			</dict>
			<key>NSMessage</key>
			<string>runWorkflowAsService</string>
			<key>NSSendFileTypes</key>
			<array>
				<string>public.item</string>
			</array>
		</dict>
	</array>
</dict>
</plist>"#,
        bundle_id = bundle_id,
        name = display_name
    )
}
