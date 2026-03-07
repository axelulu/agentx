import { createOpenAIProvider } from "@workspace/agent";
import type { StreamFn } from "@workspace/agent";

interface OpenAIAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Create a StreamFn using the agent package's OpenAI provider.
 */
export function createOpenAIStreamFn(config: OpenAIAdapterConfig): StreamFn {
  return createOpenAIProvider({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
  });
}
