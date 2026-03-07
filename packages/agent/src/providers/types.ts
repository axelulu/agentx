export interface ProviderConfig {
  apiKey?: string;
  getApiKey?: () => string | Promise<string>;
  baseUrl?: string;
  defaultModel?: string;
}
