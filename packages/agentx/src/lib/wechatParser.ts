export interface WeChatMessage {
  timestamp: string;
  sender: string;
  text: string;
}

export interface ParsedChat {
  participants: string[];
  messages: WeChatMessage[];
}

export interface ParticipantInfo {
  name: string;
  messageCount: number;
  sampleMessages: string[];
}

/**
 * Parse WeChat text export — supports two common formats:
 * Format A (multiline): timestamp on one line with sender, content on following lines
 * Format B (single line): [timestamp] sender: message
 */
export function parseWeChatText(raw: string): ParsedChat {
  const lines = raw.split("\n");
  const messages: WeChatMessage[] = [];

  // Format A: "2024-01-15 14:30 张三" followed by message content lines
  const formatA = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)\s+(.+)$/;
  // Format B: "[2024-01-15 14:30] 张三: 消息内容" or "[2024/1/15 14:30:00] 张三：消息"
  const formatB = /^\[(.+?)\]\s*(.+?)[:：]\s*(.*)$/;

  // Try Format A first
  let formatACount = 0;
  for (const line of lines) {
    if (formatA.test(line.trim())) formatACount++;
  }

  if (formatACount >= 2) {
    // Parse as Format A
    let current: { timestamp: string; sender: string; lines: string[] } | null = null;
    for (const line of lines) {
      const m = line.trim().match(formatA);
      if (m) {
        if (current) {
          messages.push({
            timestamp: current.timestamp,
            sender: current.sender,
            text: current.lines.join("\n").trim(),
          });
        }
        current = { timestamp: m[1], sender: m[2], lines: [] };
      } else if (current) {
        current.lines.push(line);
      }
    }
    if (current && current.lines.length > 0) {
      messages.push({
        timestamp: current.timestamp,
        sender: current.sender,
        text: current.lines.join("\n").trim(),
      });
    }
  } else {
    // Try Format B
    for (const line of lines) {
      const m = line.trim().match(formatB);
      if (m) {
        messages.push({ timestamp: m[1], sender: m[2].trim(), text: m[3] });
      }
    }
  }

  const participants = [...new Set(messages.map((m) => m.sender))];
  return { participants, messages };
}

/**
 * Parse WeChat HTML export — attempts DOM parsing, falls back to text extraction.
 */
export function parseWeChatHTML(html: string): ParsedChat {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Try common WeChat HTML export structures
  // Look for repeated message containers
  const messages: WeChatMessage[] = [];

  // Strategy: find elements that contain sender/time/content patterns
  const msgElements = doc.querySelectorAll(
    ".message, .msg, .chat-message, [class*='message'], [class*='msg']",
  );

  if (msgElements.length >= 2) {
    for (const el of msgElements) {
      const senderEl = el.querySelector(
        ".sender, .nickname, .name, [class*='sender'], [class*='nick'], [class*='name']",
      );
      const timeEl = el.querySelector(".time, .timestamp, .date, [class*='time'], [class*='date']");
      const contentEl = el.querySelector(
        ".content, .text, .body, [class*='content'], [class*='text'], [class*='body']",
      );

      const sender = senderEl?.textContent?.trim();
      const time = timeEl?.textContent?.trim();
      const content = contentEl?.textContent?.trim();

      if (sender && content) {
        messages.push({
          timestamp: time || "",
          sender,
          text: content,
        });
      }
    }
  }

  if (messages.length >= 2) {
    const participants = [...new Set(messages.map((m) => m.sender))];
    return { participants, messages };
  }

  // Fallback: strip tags and parse as text
  const textContent = doc.body?.textContent || "";
  return parseWeChatText(textContent);
}

/**
 * Auto-detect format and parse.
 */
export function detectAndParse(content: string): ParsedChat {
  const trimmed = content.trim();
  if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
    return parseWeChatHTML(trimmed);
  }
  return parseWeChatText(trimmed);
}

/**
 * Merge multiple parsed chats into one, deduplicating by timestamp+sender+text.
 */
export function mergeParsedChats(chats: ParsedChat[]): ParsedChat {
  const seen = new Set<string>();
  const messages: WeChatMessage[] = [];
  for (const chat of chats) {
    for (const msg of chat.messages) {
      const key = `${msg.timestamp}|${msg.sender}|${msg.text}`;
      if (!seen.has(key)) {
        seen.add(key);
        messages.push(msg);
      }
    }
  }
  const participants = [...new Set(messages.map((m) => m.sender))];
  return { participants, messages };
}

/**
 * Extract participant info sorted by message count.
 */
export function extractParticipants(parsed: ParsedChat): ParticipantInfo[] {
  const map = new Map<string, { count: number; samples: string[] }>();

  for (const msg of parsed.messages) {
    const entry = map.get(msg.sender) || { count: 0, samples: [] };
    entry.count++;
    if (entry.samples.length < 3) {
      entry.samples.push(msg.text);
    }
    map.set(msg.sender, entry);
  }

  return [...map.entries()]
    .map(([name, info]) => ({
      name,
      messageCount: info.count,
      sampleMessages: info.samples,
    }))
    .sort((a, b) => b.messageCount - a.messageCount);
}

/**
 * Build system prompt for AI roleplay as a specific person from the chat.
 */
export function buildRoleplaySystemPrompt(parsed: ParsedChat, targetPerson: string): string {
  // Format chat history
  const historyLines = parsed.messages.map((m) => `[${m.timestamp}] ${m.sender}: ${m.text}`);

  let historyText = historyLines.join("\n");

  // Truncate from earliest messages if over 80K characters
  const MAX_CHARS = 80_000;
  if (historyText.length > MAX_CHARS) {
    const lines = historyText.split("\n");
    while (historyText.length > MAX_CHARS && lines.length > 1) {
      lines.shift();
      historyText = lines.join("\n");
    }
  }

  return `You are roleplaying as "${targetPerson}" from the following chat history. Study the chat carefully and embody this person's personality, speaking style, vocabulary, emoji habits, message length patterns, and character traits.

<chat_history>
${historyText}
</chat_history>

Rules:
- Always respond as "${targetPerson}" would, matching their tone, vocabulary, emoji usage, and message length
- Use the same language that "${targetPerson}" uses in the chat history
- Stay in character at all times — never break the roleplay
- Mirror their personality traits, opinions, and communication patterns
- If they use short messages, keep yours short; if they write long messages, do the same
- Match their level of formality, humor, and emotional expression`;
}
