import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationStore } from "./conversation-store.js";
import type { ConversationData, MessageData } from "../types.js";

/**
 * JSON file-based conversation store.
 * Each conversation is stored as a directory with metadata.json and messages.json.
 */
export class JsonFileStore implements ConversationStore {
  constructor(private dataPath: string) {}

  async initialize(): Promise<void> {
    await mkdir(this.dataPath, { recursive: true });
  }

  async listConversations(): Promise<ConversationData[]> {
    try {
      const entries = await readdir(this.dataPath, { withFileTypes: true });
      const conversations: ConversationData[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const data = await this.getConversation(entry.name);
        if (data) conversations.push(data);
      }

      return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  }

  async getConversation(id: string): Promise<ConversationData | null> {
    try {
      const metaPath = join(this.dataPath, id, "metadata.json");
      const raw = await readFile(metaPath, "utf-8");
      return JSON.parse(raw) as ConversationData;
    } catch {
      return null;
    }
  }

  async saveConversation(data: ConversationData): Promise<void> {
    const dir = join(this.dataPath, data.id);
    await mkdir(dir, { recursive: true });
    const metaPath = join(dir, "metadata.json");
    await writeFile(metaPath, JSON.stringify(data, null, 2), "utf-8");
  }

  async deleteConversation(id: string): Promise<void> {
    const dir = join(this.dataPath, id);
    await rm(dir, { recursive: true, force: true });
  }

  async getMessages(conversationId: string): Promise<MessageData[]> {
    try {
      const msgPath = join(this.dataPath, conversationId, "messages.json");
      const raw = await readFile(msgPath, "utf-8");
      return JSON.parse(raw) as MessageData[];
    } catch {
      return [];
    }
  }

  async appendMessages(conversationId: string, messages: MessageData[]): Promise<void> {
    const existing = await this.getMessages(conversationId);
    const all = [...existing, ...messages];
    const dir = join(this.dataPath, conversationId);
    await mkdir(dir, { recursive: true });
    const msgPath = join(dir, "messages.json");
    await writeFile(msgPath, JSON.stringify(all, null, 2), "utf-8");
  }

  async replaceMessages(conversationId: string, messages: MessageData[]): Promise<void> {
    const dir = join(this.dataPath, conversationId);
    await mkdir(dir, { recursive: true });
    const msgPath = join(dir, "messages.json");
    await writeFile(msgPath, JSON.stringify(messages, null, 2), "utf-8");
  }
}
