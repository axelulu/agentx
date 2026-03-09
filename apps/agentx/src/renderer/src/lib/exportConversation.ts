import type { Message } from "@/slices/chatSlice";

// ---------------------------------------------------------------------------
// Single message converters
// ---------------------------------------------------------------------------

export function singleMessageToMarkdown(message: Message): string {
  const role = message.role === "user" ? "User" : "Assistant";
  const time = new Date(message.timestamp).toLocaleString();
  let md = `## ${role}\n_${time}_\n\n`;
  md += message.content ?? "";
  if (message.toolCalls && message.toolCalls.length > 0) {
    md += "\n\n### Tool Calls\n";
    for (const tc of message.toolCalls) {
      md += `\n**${tc.name}**\n\`\`\`json\n${JSON.stringify(tc.arguments, null, 2)}\n\`\`\`\n`;
      if (tc.result) {
        md += `\nResult:\n\`\`\`\n${tc.result.content}\n\`\`\`\n`;
      }
    }
  }
  return md;
}

export function singleMessageToJSON(message: Message): string {
  return JSON.stringify(
    {
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      toolCalls: message.toolCalls,
    },
    null,
    2,
  );
}

// ---------------------------------------------------------------------------
// Conversation converters
// ---------------------------------------------------------------------------

export function messagesToMarkdown(messages: Message[], title: string): string {
  let md = `# ${title}\n\n`;
  md += `_Exported on ${new Date().toLocaleString()}_\n\n---\n\n`;

  for (const msg of messages) {
    if (msg.role === "tool") continue; // tool results are folded into assistant messages
    md += singleMessageToMarkdown(msg) + "\n\n---\n\n";
  }

  return md;
}

export function messagesToJSON(messages: Message[], title: string): string {
  return JSON.stringify(
    {
      title,
      exportedAt: new Date().toISOString(),
      messages: messages
        .filter((m) => m.role !== "tool")
        .map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          toolCalls: m.toolCalls,
        })),
    },
    null,
    2,
  );
}

export function messagesToHTML(messages: Message[], title: string): string {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let body = "";
  for (const msg of messages) {
    if (msg.role === "tool") continue;
    const role = msg.role === "user" ? "User" : "Assistant";
    const time = new Date(msg.timestamp).toLocaleString();
    body += `<div class="message ${msg.role}">`;
    body += `<div class="role">${role}</div>`;
    body += `<div class="time">${time}</div>`;
    if (msg.content) {
      body += `<div class="content"><pre>${escapeHtml(msg.content)}</pre></div>`;
    }
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      body += `<div class="tool-calls">`;
      for (const tc of msg.toolCalls) {
        body += `<div class="tool-call"><strong>${escapeHtml(tc.name)}</strong>`;
        body += `<pre>${escapeHtml(JSON.stringify(tc.arguments, null, 2))}</pre>`;
        if (tc.result) {
          body += `<div class="result"><pre>${escapeHtml(tc.result.content)}</pre></div>`;
        }
        body += `</div>`;
      }
      body += `</div>`;
    }
    body += `</div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 32px; }
  .message { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #eee; }
  .role { font-weight: 600; font-size: 14px; }
  .time { color: #999; font-size: 12px; margin-bottom: 8px; }
  .content pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0; font-size: 14px; }
  .tool-calls { margin-top: 12px; }
  .tool-call { background: #f5f5f5; border-radius: 8px; padding: 12px; margin-top: 8px; }
  .tool-call pre { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 12px; white-space: pre-wrap; }
  .result { margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd; }
  .user .role { color: #0066cc; }
  .assistant .role { color: #333; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div class="meta">Exported on ${new Date().toLocaleString()}</div>
${body}
</body>
</html>`;
}
