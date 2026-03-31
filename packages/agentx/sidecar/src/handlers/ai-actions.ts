import type { ProviderConfig } from "@agentx/runtime";
import { readJsonFile } from "../stores";
import type { HandlerMap } from "./register-handlers";

/** Shared helper: call active provider's API for one-shot completions. */
async function callActiveProvider(
  providersPath: string,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ text: string; error?: string }> {
  const providers = readJsonFile<ProviderConfig[]>(providersPath, []);
  const activeProvider = providers.find((p) => p.isActive) || providers[0];

  if (!activeProvider) {
    return { text: "", error: "No AI provider configured. Please set up a provider in Settings." };
  }

  const temperature = options?.temperature ?? 0.3;
  const maxTokens = options?.maxTokens ?? 4096;

  let apiUrl: string;
  let headers: Record<string, string>;
  let body: unknown;

  if (activeProvider.type === "anthropic") {
    apiUrl =
      (activeProvider.baseUrl || "https://api.anthropic.com").replace(/\/+$/, "") + "/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": activeProvider.apiKey,
      "anthropic-version": "2023-06-01",
    };
    body = {
      model: activeProvider.defaultModel || "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    };
  } else {
    let baseUrl = (activeProvider.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    if (activeProvider.type === "gemini" && !activeProvider.baseUrl) {
      baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
    }
    apiUrl = `${baseUrl}/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${activeProvider.apiKey}`,
    };
    const defaultModel =
      activeProvider.type === "gemini"
        ? "gemini-2.0-flash"
        : activeProvider.defaultModel || "gpt-4o";
    body = {
      model: activeProvider.defaultModel || defaultModel,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };
  }

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const respText = await resp.text();
  if (!resp.ok) {
    return { text: "", error: `API error (${resp.status}): ${respText.slice(0, 200)}` };
  }

  const json = JSON.parse(respText);

  let resultText: string;
  if (activeProvider.type === "anthropic") {
    resultText =
      json.content?.[0]?.text || json.content?.map((c: { text: string }) => c.text).join("") || "";
  } else {
    resultText = json.choices?.[0]?.message?.content || "";
  }

  return { text: resultText.trim() };
}

export function registerAIActionHandlers(handlers: HandlerMap, providersPath: string): void {
  // Translate
  handlers["translate:run"] = async (text: string, targetLang: string) => {
    const langNames: Record<string, string> = {
      zh: "Chinese (Simplified)",
      en: "English",
      ja: "Japanese",
      ko: "Korean",
      fr: "French",
      de: "German",
      es: "Spanish",
      ru: "Russian",
      pt: "Portuguese",
      ar: "Arabic",
    };
    const targetName = langNames[targetLang] || targetLang;
    const systemPrompt = `You are a professional translator. Translate the given text to ${targetName}. Only output the translated text, nothing else. Do not add explanations, quotes, or formatting. Preserve the original formatting (line breaks, paragraphs, etc).`;

    try {
      return await callActiveProvider(providersPath, systemPrompt, text, { temperature: 0.2 });
    } catch (err) {
      return { text: "", error: err instanceof Error ? err.message : "Translation failed" };
    }
  };

  // Shortcuts.app integration
  handlers["shortcuts:run"] = async (prompt: string, systemPrompt?: string | null) => {
    const sysPrompt =
      systemPrompt || "You are a helpful assistant. Respond concisely and directly.";
    try {
      return await callActiveProvider(providersPath, sysPrompt, prompt);
    } catch (err) {
      return { text: "", error: err instanceof Error ? err.message : "Shortcut action failed" };
    }
  };

  // Clipboard AI Pipeline
  handlers["clipboard:process"] = async (text: string, action: string) => {
    const actionPrompts: Record<string, string> = {
      translate:
        "You are a professional translator. Detect the source language automatically. If the text is in Chinese, translate to English. If it is in any other language, translate to Chinese (Simplified). Only output the translated text, nothing else. Preserve the original formatting.",
      summarize:
        "You are an expert summarizer. Summarize the given text concisely in the same language as the input. Keep the key points and structure. Only output the summary, nothing else.",
      explain:
        "You are a helpful assistant. Explain the given text clearly and concisely in the same language as the input. Focus on the meaning and context. Only output the explanation, nothing else.",
      rewrite:
        "You are a professional writer. Rewrite the given text to improve clarity, readability, and style while preserving the original meaning. Keep the same language. Only output the rewritten text, nothing else.",
      "code-explain":
        "You are an expert programmer. Explain the given code clearly and concisely. Describe what it does, the key logic, and any notable patterns. Use the same language as any comments in the code, or Chinese if no comments. Only output the explanation, nothing else.",
      format:
        "You are a format conversion assistant. Convert the given text to a cleaner, more structured format. For example: JSON to YAML, messy text to Markdown table, unformatted code to properly formatted code, etc. Infer the best target format. Only output the converted result, nothing else.",
    };

    const systemPrompt =
      actionPrompts[action] ||
      "You are a helpful assistant. Process the given text according to the user's intent. Only output the result, nothing else.";

    try {
      return await callActiveProvider(providersPath, systemPrompt, text);
    } catch (err) {
      return { text: "", error: err instanceof Error ? err.message : "Processing failed" };
    }
  };

  // File Tags: AI analysis
  handlers["fileTags:analyze"] = async (
    path: string,
    contentPreview: string,
    metadata: unknown,
  ) => {
    const fileName = path.split("/").pop() || path;
    const systemPrompt = `You are a file analysis assistant. Analyze the given file and return a JSON object with:
- "tags": array of 2-5 short descriptive tags (in English, lowercase, relevant to the file content/type)
- "summary": a one-sentence summary of what this file is/does
- "category": a single category like "source-code", "document", "config", "image", "data", "script", etc.
- "language": programming language if applicable, otherwise omit

Return ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `File: ${fileName}
${metadata ? `Metadata: ${JSON.stringify(metadata)}` : ""}

Content preview:
${contentPreview.slice(0, 3000)}`;

    try {
      const result = await callActiveProvider(providersPath, systemPrompt, userPrompt, {
        temperature: 0,
        maxTokens: 1024,
      });

      if (result.error) {
        return { tags: [], summary: "", error: result.error };
      }

      const cleaned = result.text
        .trim()
        .replace(/^```json\s*/, "")
        .replace(/```\s*$/, "");
      const parsed = JSON.parse(cleaned);
      return {
        tags: parsed.tags || [],
        summary: parsed.summary || "",
        category: parsed.category || "",
        language: parsed.language,
        topics: parsed.topics,
      };
    } catch (err) {
      return {
        tags: [],
        summary: "",
        error: err instanceof Error ? err.message : "Analysis failed",
      };
    }
  };
}
