import Foundation
import QuickLookUI
import UniformTypeIdentifiers

// ---------------------------------------------------------------------------
// Quick Look Preview Extension for .agentx conversation files
// ---------------------------------------------------------------------------

class PreviewProvider: QLPreviewProvider {

    func providePreview(
        for request: QLFilePreviewRequest
    ) async throws -> QLPreviewReply {
        let data = try Data(contentsOf: request.fileURL)
        guard let json = try JSONSerialization.jsonObject(with: data)
                as? [String: Any] else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let html = Self.renderHTML(from: json)

        return QLPreviewReply(
            dataOfContentType: .html,
            contentSize: CGSize(width: 800, height: 1200)
        ) { _ in
            Data(html.utf8)
        }
    }

    // MARK: - HTML rendering

    static func renderHTML(from json: [String: Any]) -> String {
        let title = json["title"] as? String ?? "Untitled Conversation"
        let exportedAt = json["exportedAt"] as? String ?? ""
        let messages = json["messages"] as? [[String: Any]] ?? []

        var body = ""
        for msg in messages {
            let role = msg["role"] as? String ?? "unknown"
            let content = msg["content"] as? String ?? ""
            let timestamp = msg["timestamp"] as? Double ?? 0
            let toolCalls = msg["toolCalls"] as? [[String: Any]] ?? []

            let roleName = role == "user" ? "You" : "Assistant"
            let roleClass = role == "user" ? "user" : "assistant"
            let avatar = role == "user" ? "👤" : "✦"
            let timeStr = Self.formatTimestamp(timestamp)

            body += "<div class=\"message \(roleClass)\">"
            body += "<div class=\"message-header\">"
            body += "<span class=\"avatar\">\(avatar)</span>"
            body += "<span class=\"role\">\(esc(roleName))</span>"
            body += "<span class=\"time\">\(esc(timeStr))</span>"
            body += "</div>"

            if !content.isEmpty {
                body += "<div class=\"content\"><pre>\(esc(content))</pre></div>"
            }

            if !toolCalls.isEmpty {
                body += "<div class=\"tool-calls\">"
                for tc in toolCalls {
                    let name = tc["name"] as? String ?? "unknown"
                    body += "<div class=\"tool-call\">"
                    body += "<div class=\"tool-name\">⚙ \(esc(name))</div>"

                    if let args = tc["arguments"],
                       let argsData = try? JSONSerialization.data(
                           withJSONObject: args, options: .prettyPrinted),
                       let argsStr = String(data: argsData, encoding: .utf8) {
                        body += "<pre class=\"tool-args\">\(esc(argsStr))</pre>"
                    }

                    if let result = tc["result"] as? [String: Any],
                       let resultContent = result["content"] as? String {
                        let truncated = resultContent.count > 500
                            ? String(resultContent.prefix(500)) + "…"
                            : resultContent
                        body += "<div class=\"tool-result\">"
                        body += "<pre>\(esc(truncated))</pre></div>"
                    }

                    body += "</div>"
                }
                body += "</div>"
            }

            body += "</div>"
        }

        let messageCount = messages.count
        let userCount = messages.filter { ($0["role"] as? String) == "user" }.count
        let assistantCount = messageCount - userCount

        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        <title>\(esc(title))</title>
        <style>
        :root {
          --bg: #ffffff;
          --fg: #1a1a1a;
          --muted: #8e8e93;
          --border: #e5e5ea;
          --card-user: #f2f2f7;
          --card-assistant: #ffffff;
          --accent: #007aff;
          --tool-bg: #f5f5f7;
          --tool-border: #d1d1d6;
          --result-bg: #e8f5e9;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #1c1c1e;
            --fg: #f5f5f7;
            --muted: #8e8e93;
            --border: #38383a;
            --card-user: #2c2c2e;
            --card-assistant: #1c1c1e;
            --accent: #0a84ff;
            --tool-bg: #2c2c2e;
            --tool-border: #48484a;
            --result-bg: #1b3a1b;
          }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif;
          background: var(--bg);
          color: var(--fg);
          line-height: 1.5;
          padding: 32px;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .header h1 {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.3px;
          margin-bottom: 6px;
        }
        .meta {
          color: var(--muted);
          font-size: 12px;
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .meta .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--tool-bg);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 500;
        }
        .message {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          border: 1px solid var(--border);
        }
        .message.user {
          background: var(--card-user);
        }
        .message.assistant {
          background: var(--card-assistant);
        }
        .message-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .avatar {
          font-size: 14px;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: var(--tool-bg);
        }
        .message.assistant .avatar {
          color: var(--accent);
          font-size: 12px;
        }
        .role {
          font-weight: 600;
          font-size: 13px;
        }
        .time {
          color: var(--muted);
          font-size: 11px;
          margin-left: auto;
        }
        .content pre {
          white-space: pre-wrap;
          word-wrap: break-word;
          font-family: inherit;
          font-size: 13px;
          line-height: 1.55;
        }
        .tool-calls {
          margin-top: 10px;
        }
        .tool-call {
          background: var(--tool-bg);
          border: 1px solid var(--tool-border);
          border-radius: 8px;
          padding: 10px 12px;
          margin-top: 6px;
          font-size: 12px;
        }
        .tool-name {
          font-weight: 600;
          font-size: 12px;
          margin-bottom: 6px;
          color: var(--muted);
        }
        .tool-args {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
          font-size: 11px;
          white-space: pre-wrap;
          word-break: break-all;
          color: var(--muted);
          max-height: 120px;
          overflow: hidden;
        }
        .tool-result {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--tool-border);
        }
        .tool-result pre {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', Consolas, monospace;
          font-size: 11px;
          white-space: pre-wrap;
          word-break: break-all;
          max-height: 100px;
          overflow: hidden;
        }
        </style>
        </head>
        <body>
        <div class="header">
          <h1>\(esc(title))</h1>
          <div class="meta">
            <span>\(esc(exportedAt))</span>
            <span class="badge">\(messageCount) messages</span>
            <span class="badge">👤 \(userCount)  ✦ \(assistantCount)</span>
          </div>
        </div>
        \(body)
        </body>
        </html>
        """
    }

    // MARK: - Helpers

    private static func esc(_ str: String) -> String {
        str.replacingOccurrences(of: "&", with: "&amp;")
           .replacingOccurrences(of: "<", with: "&lt;")
           .replacingOccurrences(of: ">", with: "&gt;")
           .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private static func formatTimestamp(_ ms: Double) -> String {
        guard ms > 0 else { return "" }
        let date = Date(timeIntervalSince1970: ms / 1000)
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        fmt.timeStyle = .short
        return fmt.string(from: date)
    }
}
