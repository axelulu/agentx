import type { StreamFn } from "@agentx/agent";
import type { ProviderConfig } from "../types.js";
import { createOpenAIStreamFn } from "./adapters/openai-adapter.js";
import { createAnthropicStreamFn } from "./adapters/anthropic-adapter.js";

/**
 * Manages provider configurations and creates StreamFn instances.
 */
export class ProviderManager {
  private providers = new Map<string, ProviderConfig>();
  private activeId: string | null = null;

  setProvider(config: ProviderConfig): void {
    this.providers.set(config.id, config);
    if (config.isActive || this.providers.size === 1) {
      this.activeId = config.id;
    }
  }

  removeProvider(id: string): void {
    this.providers.delete(id);
    if (this.activeId === id) {
      this.activeId = this.providers.keys().next().value ?? null;
    }
  }

  setActiveProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider "${id}" not found`);
    }
    this.activeId = id;
  }

  getActiveProvider(): ProviderConfig | null {
    if (!this.activeId) return null;
    return this.providers.get(this.activeId) ?? null;
  }

  getProviderConfigs(): ProviderConfig[] {
    return [...this.providers.values()];
  }

  /**
   * Create a StreamFn for the active provider.
   */
  createStreamFn(): StreamFn {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error("No active provider configured");
    }
    return this.createStreamFnForProvider(provider);
  }

  /**
   * Get the default model for the active provider.
   */
  getDefaultModel(): string {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error("No active provider configured");
    }
    return provider.defaultModel ?? getDefaultModelForType(provider.type);
  }

  private createStreamFnForProvider(config: ProviderConfig): StreamFn {
    switch (config.type) {
      case "openai":
      case "custom":
        return createOpenAIStreamFn({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          defaultModel: config.defaultModel,
        });
      case "anthropic":
        return createAnthropicStreamFn({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          defaultModel: config.defaultModel,
        });
      case "gemini":
        // Gemini uses OpenAI-compatible API
        return createOpenAIStreamFn({
          apiKey: config.apiKey,
          baseUrl: config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
          defaultModel: config.defaultModel ?? "gemini-2.0-flash",
        });
    }
  }
}

function getDefaultModelForType(type: ProviderConfig["type"]): string {
  switch (type) {
    case "openai":
      return "gpt-4o";
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "gemini":
      return "gemini-2.0-flash";
    case "custom":
      return "gpt-4o";
  }
}
