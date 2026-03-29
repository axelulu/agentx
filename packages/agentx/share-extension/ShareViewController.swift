import Cocoa
import UniformTypeIdentifiers

/// Headless Share Extension handler for AgentX.
///
/// Receives shared items (text, URLs, images, files) from any macOS app's
/// share menu, serializes them to a JSON file at ~/.agentx/pending-share-action.json,
/// and opens the main app via the agentx://share deep link.
@objc(ShareViewController)
class ShareViewController: NSViewController {

    override func loadView() {
        // Minimal hidden view — we process headlessly and dismiss immediately
        self.view = NSView(frame: .zero)
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        processSharedItems()
    }

    // MARK: - Processing

    private func processSharedItems() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            complete(error: nil)
            return
        }

        let group = DispatchGroup()
        var collectedItems: [[String: Any]] = []
        let lock = NSLock()

        for extensionItem in extensionItems {
            guard let attachments = extensionItem.attachments else { continue }

            for attachment in attachments {
                group.enter()
                processAttachment(attachment) { item in
                    if let item = item {
                        lock.lock()
                        collectedItems.append(item)
                        lock.unlock()
                    }
                    group.leave()
                }
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }

            if collectedItems.isEmpty {
                self.complete(error: nil)
                return
            }

            let payload: [String: Any] = [
                "timestamp": Date().timeIntervalSince1970,
                "items": collectedItems
            ]

            self.saveAndLaunch(payload)
        }
    }

    private func processAttachment(_ provider: NSItemProvider, completion: @escaping ([String: Any]?) -> Void) {
        // 1. Try URL (handles both web URLs and file URLs)
        if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
                guard let self = self else { completion(nil); return }

                if let url = item as? URL {
                    if url.isFileURL {
                        let destPath = self.copyFileToSharedDir(url)
                        completion([
                            "type": "file",
                            "path": destPath ?? url.path,
                            "name": url.lastPathComponent
                        ])
                    } else {
                        completion(["type": "url", "url": url.absoluteString])
                    }
                } else if let urlData = item as? Data, let url = URL(dataRepresentation: urlData, relativeTo: nil) {
                    completion(["type": "url", "url": url.absoluteString])
                } else {
                    completion(nil)
                }
            }
            return
        }

        // 2. Try image
        if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] item, _ in
                guard let self = self else { completion(nil); return }

                if let url = item as? URL {
                    let destPath = self.copyFileToSharedDir(url)
                    completion([
                        "type": "image",
                        "path": destPath ?? url.path,
                        "name": url.lastPathComponent
                    ])
                } else if let image = item as? NSImage {
                    if let path = self.saveImageToSharedDir(image) {
                        completion(["type": "image", "path": path, "name": "shared-image.png"])
                    } else {
                        completion(nil)
                    }
                } else if let data = item as? Data {
                    if let path = self.saveDataToSharedDir(data, name: "shared-image.png") {
                        completion(["type": "image", "path": path, "name": "shared-image.png"])
                    } else {
                        completion(nil)
                    }
                } else {
                    completion(nil)
                }
            }
            return
        }

        // 3. Try plain text
        if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, _ in
                if let text = item as? String {
                    completion(["type": "text", "text": text])
                } else if let data = item as? Data, let text = String(data: data, encoding: .utf8) {
                    completion(["type": "text", "text": text])
                } else {
                    completion(nil)
                }
            }
            return
        }

        // 4. Try any file/data
        if provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.data.identifier, options: nil) { [weak self] item, _ in
                guard let self = self else { completion(nil); return }

                if let url = item as? URL {
                    let destPath = self.copyFileToSharedDir(url)
                    completion([
                        "type": "file",
                        "path": destPath ?? url.path,
                        "name": url.lastPathComponent
                    ])
                } else if let data = item as? Data {
                    if let path = self.saveDataToSharedDir(data, name: "shared-file") {
                        completion(["type": "file", "path": path, "name": "shared-file"])
                    } else {
                        completion(nil)
                    }
                } else {
                    completion(nil)
                }
            }
            return
        }

        completion(nil)
    }

    // MARK: - File helpers

    private func sharedDir() -> URL {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let dir = home.appendingPathComponent(".agentx/shared-content")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private func agentxDir() -> URL {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let dir = home.appendingPathComponent(".agentx")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// Copy a file URL to the shared directory, returning the destination path.
    private func copyFileToSharedDir(_ url: URL) -> String? {
        let dir = sharedDir()
        let uuid = UUID().uuidString.prefix(8)
        let destName = "\(uuid)-\(url.lastPathComponent)"
        let dest = dir.appendingPathComponent(destName)
        do {
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.copyItem(at: url, to: dest)
            return dest.path
        } catch {
            NSLog("[ShareExtension] Failed to copy file: \(error)")
            return nil
        }
    }

    /// Save an NSImage as PNG to the shared directory.
    private func saveImageToSharedDir(_ image: NSImage) -> String? {
        guard let tiffData = image.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiffData),
              let pngData = bitmap.representation(using: .png, properties: [:]) else {
            return nil
        }
        return saveDataToSharedDir(pngData, name: "shared-image.png")
    }

    /// Save raw data to the shared directory.
    private func saveDataToSharedDir(_ data: Data, name: String) -> String? {
        let dir = sharedDir()
        let uuid = UUID().uuidString.prefix(8)
        let dest = dir.appendingPathComponent("\(uuid)-\(name)")
        do {
            try data.write(to: dest)
            return dest.path
        } catch {
            NSLog("[ShareExtension] Failed to save data: \(error)")
            return nil
        }
    }

    // MARK: - Save & Launch

    private func saveAndLaunch(_ payload: [String: Any]) {
        let dir = agentxDir()
        let jsonPath = dir.appendingPathComponent("pending-share-action.json")

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted])
            try jsonData.write(to: jsonPath)
        } catch {
            NSLog("[ShareExtension] Failed to write JSON: \(error)")
            complete(error: error)
            return
        }

        // Open AgentX via deep link
        if let url = URL(string: "agentx://share") {
            NSWorkspace.shared.open(url)
        }

        complete(error: nil)
    }

    // MARK: - Completion

    private func complete(error: Error?) {
        if let error = error {
            extensionContext?.cancelRequest(withError: error)
        } else {
            extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
}
