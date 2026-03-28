use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

const SWIFT_OCR_SOURCE: &str = r#"
import Foundation
import Vision
import AppKit

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: ocr <image_path>\n", stderr)
    exit(1)
}
let imagePath = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: imagePath),
      let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let cgImage = bitmap.cgImage else {
    fputs("Error: Cannot load image at: \(imagePath)\n", stderr)
    exit(1)
}

let semaphore = DispatchSemaphore(value: 0)
var resultText = ""

let request = VNRecognizeTextRequest { request, error in
    if let error = error {
        fputs("OCR error: \(error.localizedDescription)\n", stderr)
        semaphore.signal()
        return
    }
    guard let observations = request.results as? [VNRecognizedTextObservation] else {
        semaphore.signal()
        return
    }
    let lines = observations.compactMap { $0.topCandidates(1).first?.string }
    resultText = lines.joined(separator: "\n")
    semaphore.signal()
}
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US", "ja", "ko"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
do {
    try handler.perform([request])
} catch {
    fputs("Perform error: \(error.localizedDescription)\n", stderr)
    exit(1)
}
semaphore.wait()
print(resultText)
"#;

/// Get or compile the OCR helper binary. Compiled once, cached for app lifetime.
#[cfg(target_os = "macos")]
fn get_ocr_binary() -> Result<PathBuf, String> {
    use std::process::Command;

    let cache_dir = std::env::var("HOME")
        .map(|h| PathBuf::from(h).join("Library/Caches/com.agentx.app"))
        .unwrap_or_else(|_| std::env::temp_dir().join("com.agentx.app"));
    let binary_path = cache_dir.join("ocr_helper");
    let source_path = cache_dir.join("ocr_helper.swift");

    // Fast path: if binary already exists and is recent enough, use it
    if binary_path.exists() {
        return Ok(binary_path);
    }

    // Compile the Swift OCR helper
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache dir: {}", e))?;

    std::fs::write(&source_path, SWIFT_OCR_SOURCE)
        .map_err(|e| format!("Failed to write Swift source: {}", e))?;

    eprintln!("[OCR] Compiling OCR helper (one-time)...");
    let output = Command::new("swiftc")
        .args([
            "-O",
            "-o",
            binary_path.to_str().unwrap(),
            source_path.to_str().unwrap(),
            "-framework",
            "Vision",
            "-framework",
            "AppKit",
        ])
        .output()
        .map_err(|e| format!("Failed to compile OCR helper: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("OCR helper compilation failed: {}", stderr));
    }

    eprintln!("[OCR] OCR helper compiled successfully");
    Ok(binary_path)
}

/// Run macOS Vision framework OCR on an image file.
/// Uses a pre-compiled Swift binary for fast execution (~100ms).
#[cfg(target_os = "macos")]
pub fn run_ocr(image_path: &str) -> Result<String, String> {
    use std::process::Command;

    let binary = get_ocr_binary()?;

    let output = Command::new(&binary)
        .arg(image_path)
        .output()
        .map_err(|e| format!("Failed to run OCR: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("OCR failed: {}", stderr));
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(text)
}

#[cfg(not(target_os = "macos"))]
pub fn run_ocr(_image_path: &str) -> Result<String, String> {
    Err("OCR is only supported on macOS".to_string())
}

/// Run OCR on base64-encoded image data.
/// Writes to a temp file, runs OCR, cleans up.
pub fn ocr_from_base64(image_base64: &str) -> Result<String, String> {
    let image_data = STANDARD
        .decode(image_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let tmp_path = format!(
        "/tmp/agentx_ocr_{}.png",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    std::fs::write(&tmp_path, &image_data)
        .map_err(|e| format!("Failed to write temp image: {}", e))?;

    let result = run_ocr(&tmp_path);

    let _ = std::fs::remove_file(&tmp_path);

    result
}

/// Register the OCR global shortcut (Option+O).
/// Flow: hide window → sidecar screencapture → OCR → show window + emit result
pub fn register_ocr_shortcut(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    // Pre-compile OCR binary in background on startup
    std::thread::spawn(|| {
        #[cfg(target_os = "macos")]
        if let Err(e) = get_ocr_binary() {
            eprintln!("[OCR] Pre-compilation failed: {}", e);
        }
    });

    let shortcut: Shortcut = "Option+O".parse()?;
    let handle = app.clone();

    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let h = handle.clone();

                // Emit event to frontend to trigger capture via sidecar
                // (sidecar has proper screen recording permissions)
                let _ = h.emit("ocr:trigger", ());
            }
        })?;

    Ok(())
}
