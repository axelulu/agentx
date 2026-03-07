/**
 * Prompt Translation Module
 *
 * Bidirectional YAML prompt file translation (Chinese↔English) with parallel workers
 * Uses Gemini 2.5 Pro for high-quality translations
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";

// Translation directions
export type TranslationDirection = "zh-to-en" | "en-to-zh";

interface TranslationTask {
  sourcePath: string;
  targetPath: string;
  relativePath: string;
}

interface TranslationConfig {
  sourceDir: string;
  targetDir: string;
  sourceLang: string;
  targetLang: string;
  prompt: string;
}

interface WorkerResult {
  task: TranslationTask;
  success: boolean;
  error?: string;
}

export interface PromptTranslatorOptions {
  promptsDir: string;
  direction: TranslationDirection;
  workers: number;
  apiKey?: string;
  model?: string;
}

// OpenRouter API interface
interface OpenRouterClient {
  chat: (params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    max_tokens: number;
    temperature: number;
  }) => Promise<{ choices: Array<{ message: { content: string } }> }>;
}

function createOpenRouterClient(apiKey: string): OpenRouterClient {
  return {
    async chat(params) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vife.ai",
          "X-Title": "Vife L10n CLI",
        },
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          max_tokens: params.max_tokens,
          temperature: params.temperature,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
      }

      return response.json();
    },
  };
}

// Color output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Get translation prompt based on direction
 */
function getTranslationPrompt(direction: TranslationDirection): string {
  if (direction === "zh-to-en") {
    return `You are a professional translator. Translate the following YAML prompt file from Chinese to English.

IMPORTANT RULES:
1. Only translate the Chinese text content, keep all YAML structure, keys, and syntax unchanged
2. Keep all variable placeholders like {{variable_name}} unchanged
3. Keep all XML-like tags like <tag_name> unchanged
4. Keep all code examples unchanged
5. Maintain the exact same YAML structure and indentation
6. Keep meta fields (name, version, description) in English
7. The translation should be professional and suitable for AI system prompts
8. Keep any English text that already exists unchanged

Here is the YAML content to translate:`;
  } else {
    return `You are a professional translator. Translate the following YAML prompt file from English to Chinese.

IMPORTANT RULES:
1. Only translate the English text content, keep all YAML structure, keys, and syntax unchanged
2. Keep all variable placeholders like {{variable_name}} unchanged
3. Keep all XML-like tags like <tag_name> unchanged
4. Keep all code examples unchanged
5. Maintain the exact same YAML structure and indentation
6. Keep meta fields (name, version) unchanged, but translate description to Chinese
7. The translation should be professional and suitable for AI system prompts
8. Keep any technical terms or code unchanged
9. Use simplified Chinese (简体中文) for the translation

Here is the YAML content to translate:`;
  }
}

/**
 * Get translation configuration based on direction
 */
function getTranslationConfig(
  promptsDir: string,
  direction: TranslationDirection,
): TranslationConfig {
  const prompt = getTranslationPrompt(direction);

  if (direction === "zh-to-en") {
    return {
      sourceDir: join(promptsDir, "zh"),
      targetDir: join(promptsDir, "en"),
      sourceLang: "Chinese",
      targetLang: "English",
      prompt,
    };
  } else {
    return {
      sourceDir: join(promptsDir, "en"),
      targetDir: join(promptsDir, "zh"),
      sourceLang: "English",
      targetLang: "Chinese",
      prompt,
    };
  }
}

/**
 * Recursively find all YAML files in a directory
 */
function findYamlFiles(dir: string, baseDir: string = dir): TranslationTask[] {
  const tasks: TranslationTask[] = [];

  if (!existsSync(dir)) {
    return tasks;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      tasks.push(...findYamlFiles(fullPath, baseDir));
    } else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
      tasks.push({
        sourcePath: fullPath,
        targetPath: "", // Will be set later
        relativePath: relative(baseDir, fullPath),
      });
    }
  }

  return tasks;
}

/**
 * Estimate if a YAML structure is complete by checking for balanced structure
 */
function isYamlStructureComplete(original: string, translated: string): boolean {
  // Count top-level keys in original
  const originalTopKeys = (original.match(/^[a-z_]+:/gm) || []).length;
  const translatedTopKeys = (translated.match(/^[a-z_]+:/gm) || []).length;

  if (translatedTopKeys < originalTopKeys) {
    return false;
  }

  // Check if the translated content ends properly (not mid-sentence)
  const trimmed = translated.trim();
  // If it ends with an incomplete line (no newline and no proper ending)
  if (trimmed.endsWith("-") || trimmed.endsWith(":")) {
    // Could be valid YAML, do additional check
    const lastLine = trimmed.split("\n").pop() ?? "";
    // If the last line looks like it was cut off mid-content
    if (lastLine.length > 0 && !lastLine.endsWith("|") && lastLine.includes(" ")) {
      const lastChar = lastLine[lastLine.length - 1] ?? "";
      if (!/[.!?。！？\-:|]/.test(lastChar)) {
        return false;
      }
    }
  }

  // Compare line counts - translated should be at least 80% of original
  // (accounting for potential language compression)
  const originalLines = original.split("\n").length;
  const translatedLines = translated.split("\n").length;
  if (translatedLines < originalLines * 0.7) {
    return false;
  }

  return true;
}

/**
 * Translate YAML content using OpenRouter with retry and validation
 */
async function translateContent(
  content: string,
  prompt: string,
  client: OpenRouterClient,
  model: string,
  maxRetries: number = 3,
): Promise<string> {
  // Calculate appropriate max_tokens based on content size
  // Rough estimate: 1 token ≈ 4 characters, add 50% buffer for translation expansion
  const estimatedTokens = Math.ceil((content.length / 4) * 1.5);
  // Use at least 16384 tokens, max 65536 tokens
  const maxTokens = Math.min(65536, Math.max(16384, estimatedTokens));

  const fullPrompt = `${prompt}

\`\`\`yaml
${content}
\`\`\`

CRITICAL REQUIREMENTS:
1. Translate ALL Chinese text to English while preserving the exact YAML structure
2. Keep all keys, indentation, and formatting unchanged
3. Do NOT skip, summarize, or truncate any content
4. Output ONLY the translated YAML content - no explanations, no markdown code blocks, no extra text
5. The output must be valid YAML with identical structure to the input
6. Preserve all special characters, placeholders (like {variable}), and technical terms`;

  let lastError: Error | null = null;
  let lastResult: string = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat({
        model,
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: maxTokens,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error("No text content in response");
      }

      // Clean up potential markdown code blocks
      let result = text.trim();
      if (result.startsWith("```yaml")) {
        result = result.slice(7);
      }
      if (result.startsWith("```")) {
        result = result.slice(3);
      }
      if (result.endsWith("```")) {
        result = result.slice(0, -3);
      }
      result = result.trim();

      // Validate completeness
      if (isYamlStructureComplete(content, result)) {
        return result;
      }

      lastResult = result;
      lastError = new Error(
        `Translation appears truncated (attempt ${attempt}/${maxRetries}): ` +
          `original ${content.split("\n").length} lines, ` +
          `translated ${result.split("\n").length} lines`,
      );

      if (attempt < maxRetries) {
        // Wait before retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // If we have a partial result that's reasonably complete, use it with a warning
  if (lastResult && lastResult.split("\n").length > content.split("\n").length * 0.5) {
    log(`  ⚠ Using potentially incomplete translation after ${maxRetries} attempts`, "yellow");
    return lastResult;
  }

  throw lastError || new Error("Translation failed after all retries");
}

/**
 * Worker function to translate a single file
 */
async function translateFile(
  task: TranslationTask,
  prompt: string,
  client: OpenRouterClient,
  model: string,
  workerId: number,
): Promise<WorkerResult> {
  const startTime = Date.now();

  try {
    const content = readFileSync(task.sourcePath, "utf-8");
    const originalLines = content.split("\n").length;

    const translated = await translateContent(content, prompt, client, model);
    const translatedLines = translated.split("\n").length;

    // Validate translated YAML
    try {
      parseYaml(translated);
    } catch {
      log(`  [Worker ${workerId}] ⚠ YAML validation warning for ${task.relativePath}`, "yellow");
    }

    // Log a warning if there's a significant line count difference
    const lineRatio = translatedLines / originalLines;
    if (lineRatio < 0.8 || lineRatio > 1.3) {
      log(
        `  [Worker ${workerId}] ⚠ Line count difference: ${originalLines} → ${translatedLines} (${(lineRatio * 100).toFixed(0)}%) for ${task.relativePath}`,
        "yellow",
      );
    }

    // Ensure target directory exists
    const targetDir = dirname(task.targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Ensure file ends with newline
    const finalContent = translated.endsWith("\n") ? translated : translated + "\n";
    writeFileSync(task.targetPath, finalContent, "utf-8");

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(
      `  [Worker ${workerId}] ✓ ${task.relativePath} (${duration}s, ${originalLines}→${translatedLines} lines)`,
      "green",
    );

    return { task, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`  [Worker ${workerId}] ✗ ${task.relativePath}: ${errorMessage}`, "red");
    return { task, success: false, error: errorMessage };
  }
}

/**
 * Process tasks with multiple workers
 */
async function processWithWorkers(
  tasks: TranslationTask[],
  prompt: string,
  client: OpenRouterClient,
  model: string,
  numWorkers: number,
): Promise<WorkerResult[]> {
  const results: WorkerResult[] = [];
  let taskIndex = 0;
  const totalTasks = tasks.length;

  // Create worker function
  async function worker(workerId: number): Promise<void> {
    while (true) {
      const currentIndex = taskIndex++;
      if (currentIndex >= totalTasks) {
        break;
      }

      const task = tasks[currentIndex];
      const result = await translateFile(task!, prompt, client, model, workerId);
      results.push(result);
    }
  }

  // Start all workers
  const workerPromises: Promise<void>[] = [];
  for (let i = 1; i <= numWorkers; i++) {
    workerPromises.push(worker(i));
  }

  // Wait for all workers to complete
  await Promise.all(workerPromises);

  return results;
}

/**
 * Main prompt translation function
 */
export async function translatePrompts(
  options: PromptTranslatorOptions,
): Promise<{ successful: number; failed: number; duration: string }> {
  const { promptsDir, direction, workers, apiKey, model = "google/gemini-3-pro-preview" } = options;

  log("\n╔════════════════════════════════════════════╗", "blue");
  log("║   Prompt Translation Script (Parallel)     ║", "blue");
  log("╚════════════════════════════════════════════╝\n", "blue");

  log(`Model: ${model}`, "cyan");
  log(`Workers: ${workers}`, "cyan");
  log(
    `Direction: ${direction === "zh-to-en" ? "Chinese → English" : "English → Chinese"}\n`,
    "cyan",
  );

  // Check API Key
  const openrouterApiKey = apiKey || process.env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Please provide it via --api-key or OPENROUTER_API_KEY environment variable.",
    );
  }

  // Initialize OpenRouter client
  const client = createOpenRouterClient(openrouterApiKey);

  // Get translation configuration
  const config = getTranslationConfig(promptsDir, direction);

  // Find all YAML files
  log(`Scanning source directory: ${config.sourceDir}`, "blue");
  const tasks = findYamlFiles(config.sourceDir);

  if (tasks.length === 0) {
    log("No YAML files found to translate.", "yellow");
    return { successful: 0, failed: 0, duration: "0s" };
  }

  // Set target paths
  for (const task of tasks) {
    task.targetPath = join(config.targetDir, task.relativePath);
  }

  log(`Found ${tasks.length} files to translate\n`, "blue");

  // Group files by directory for display
  const byDirectory = new Map<string, TranslationTask[]>();
  for (const task of tasks) {
    const dir = dirname(task.relativePath);
    if (!byDirectory.has(dir)) {
      byDirectory.set(dir, []);
    }
    byDirectory.get(dir)!.push(task);
  }

  log("Files to translate:", "magenta");
  for (const [dir, dirTasks] of byDirectory) {
    log(`  ${dir}/ (${dirTasks.length} files)`, "gray");
  }
  log("", "reset");

  // Start translation
  const startTime = Date.now();
  log("Starting parallel translation...\n", "blue");

  const results = await processWithWorkers(tasks, config.prompt, client, model, workers);

  // Summary
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  log("\n╔════════════════════════════════════════════╗", "green");
  log("║           Translation Complete             ║", "green");
  log("╚════════════════════════════════════════════╝", "green");
  log(`  Total files: ${tasks.length}`, "reset");
  log(`  Successful: ${successful}`, "green");
  if (failed > 0) {
    log(`  Failed: ${failed}`, "red");
  }
  log(`  Total time: ${duration}s`, "cyan");
  log(`  Avg time per file: ${(parseFloat(duration) / tasks.length).toFixed(1)}s`, "cyan");
  log("", "reset");

  if (failed > 0) {
    log("Failed files:", "red");
    for (const result of results) {
      if (!result.success) {
        log(`  - ${result.task.relativePath}: ${result.error}`, "red");
      }
    }
  }

  return { successful, failed, duration: `${duration}s` };
}

/**
 * Print usage information for translate-prompts command
 */
export function printTranslatePromptsUsage(): void {
  log("\nUsage: l10n translate-prompts [options]\n", "blue");
  log("Options:", "yellow");
  log("  --dir=<path>        Prompts directory path (required)", "reset");
  log(
    "  --direction=<dir>   Translation direction: en-to-zh or zh-to-en (default: en-to-zh)",
    "reset",
  );
  log("  --workers=<n>       Number of parallel workers (default: 5, max: 20)", "reset");
  log(
    "  --api-key=<key>     OpenRouter API key (or use l10n.config.json or OPENROUTER_API_KEY env var)",
    "reset",
  );
  log(
    "  --model=<model>     OpenRouter model name (default: google/gemini-2.0-flash-001)",
    "reset",
  );
  log("\nAPI Key Priority:", "yellow");
  log("  1. --api-key command line argument", "reset");
  log("  2. apiKey field in l10n.config.json", "reset");
  log("  3. OPENROUTER_API_KEY environment variable", "reset");
  log("\nExamples:", "yellow");
  log("  l10n translate-prompts --dir=./src/agent/prompts", "reset");
  log("  l10n translate-prompts --dir=./prompts --direction=zh-to-en", "reset");
  log("  l10n translate-prompts --dir=./prompts --workers=10", "reset");
}
