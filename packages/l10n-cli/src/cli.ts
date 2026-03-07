#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { TranslationExtractor } from "./extractor.ts";
import {
  printTranslatePromptsUsage,
  translatePrompts,
  type TranslationDirection,
} from "./prompt-translator.ts";
import { Translator } from "./translator.ts";

interface Config {
  sourceLanguage: string;
  targetLanguages: string[];
  sourceDir: string | string[];
  outputDir: string;
  apiKey: string;
}

// Default export function for programmatic access
export default async function cli(args: string[] = process.argv.slice(2)) {
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case "generate":
      // Parse options for generate command
      const skipExisting = args.includes("--skip-existing") || args.includes("-s");
      await generateTranslations(skipExisting);
      break;
    case "extract":
      await extractKeys();
      break;
    case "validate":
      await validateKeys();
      break;
    case "translate-prompts":
      await handleTranslatePrompts(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function generateTranslations(skipExisting: boolean = false) {
  console.log("🚀 Starting translation generation...");

  if (skipExisting) {
    console.log("⏭️  Skip existing translations enabled");
  }

  // 读取配置
  const config = await loadConfig();

  // 提取翻译键
  console.log("📝 Extracting translation keys...");
  const extractor = new TranslationExtractor();

  let extractedKeys: any[];
  if (Array.isArray(config.sourceDir)) {
    console.log(
      `📁 Scanning ${config.sourceDir.length} directories: ${config.sourceDir.join(", ")}`,
    );
    extractedKeys = extractor.extractFromDirectories(config.sourceDir);
  } else {
    console.log(`📁 Scanning directory: ${config.sourceDir}`);
    extractedKeys = extractor.extractFromDirectory(config.sourceDir);
  }

  if (extractedKeys.length === 0) {
    console.log("❌ No translation keys found. Make sure you have l10n.t() calls in your code.");
    return;
  }

  console.log(`✅ Found ${extractedKeys.length} translation keys`);

  // 显示提取统计信息
  const stats = extractor.getExtractionStats();
  console.log(`📊 Extraction Statistics:`);
  console.log(`  • Total keys: ${stats.totalKeys}`);
  console.log(`  • Files processed: ${stats.fileCount}`);

  // 验证提取的键
  const validation = extractor.validateKeys();
  if (validation.invalid.length > 0) {
    console.log(
      `⚠️  Warning: Found ${validation.invalid.length} potentially invalid keys that will be skipped.`,
    );
    validation.invalid.forEach((key) => {
      console.log(`  ❌ "${key.key}" (${key.file}:${key.line})`);
    });
  }

  // 创建输出目录
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true });
  }

  // 初始化翻译器
  const translator = new Translator(config.apiKey || process.env.GOOGLE_AI_API_KEY || "");

  // 生成源语言文件（通常是英文）
  const sourceTemplate = extractor.generateTranslationTemplate();
  const sourceFilePath = join(config.outputDir, `${config.sourceLanguage}.json`);
  writeFileSync(sourceFilePath, JSON.stringify(sourceTemplate, null, 2));
  console.log(`✅ Generated source language file: ${sourceFilePath}`);

  // 翻译到目标语言
  for (const targetLang of config.targetLanguages) {
    if (targetLang === config.sourceLanguage) continue;

    console.log(`🌐 Translating to ${targetLang}...`);

    const targetFilePath = join(config.outputDir, `${targetLang}.json`);

    // 检查是否需要跳过已存在的翻译
    let existingTranslations: Record<string, string> = {};
    let sourceToTranslate = sourceTemplate;

    if (skipExisting && existsSync(targetFilePath)) {
      try {
        const existingContent = readFileSync(targetFilePath, "utf-8");
        existingTranslations = JSON.parse(existingContent);

        // 计算需要翻译的缺失键
        const missingKeys = Object.keys(sourceTemplate).filter(
          (key) => !existingTranslations[key] || existingTranslations[key].trim() === "",
        );

        if (missingKeys.length === 0) {
          console.log(`⏭️  ${targetLang}: All translations exist, skipping`);
          continue;
        }

        // 只翻译缺失的键
        sourceToTranslate = {};
        missingKeys.forEach((key) => {
          sourceToTranslate[key] = sourceTemplate[key]!;
        });

        console.log(
          `📋 ${targetLang}: ${missingKeys.length}/${Object.keys(sourceTemplate).length} keys need translation`,
        );
      } catch (error) {
        console.log(`⚠️  Failed to read existing ${targetLang} file, will translate all keys`);
        existingTranslations = {};
        sourceToTranslate = sourceTemplate;
      }
    }

    try {
      let translatedTemplate: Record<string, string>;

      if (Object.keys(sourceToTranslate).length === 0) {
        // 没有需要翻译的内容
        translatedTemplate = existingTranslations;
      } else {
        // 使用新的批量JSON翻译方法，速度更快
        const newTranslations = await translator.translateJSON(
          sourceToTranslate,
          targetLang,
          config.sourceLanguage,
        );

        // 合并现有翻译和新翻译
        translatedTemplate = { ...existingTranslations, ...newTranslations };
      }

      writeFileSync(targetFilePath, JSON.stringify(translatedTemplate, null, 2));

      if (skipExisting && Object.keys(existingTranslations).length > 0) {
        console.log(
          `✅ Updated ${targetLang} translation file: ${targetFilePath} (${Object.keys(sourceToTranslate).length} new, ${Object.keys(existingTranslations).length} existing)`,
        );
      } else {
        console.log(`✅ Generated ${targetLang} translation file: ${targetFilePath}`);
      }
    } catch (error) {
      console.error(`❌ Failed to translate to ${targetLang}:`, error);

      // 后备方案：使用旧的逐条翻译方法
      console.log(`🔄 Falling back to individual translation for ${targetLang}...`);
      try {
        let translatedTemplate: Record<string, string> = {
          ...existingTranslations,
        };
        const keysToTranslate = Object.keys(sourceToTranslate);
        const valuesToTranslate = Object.values(sourceToTranslate);

        if (keysToTranslate.length > 0) {
          const translations = await translator.translateBatch(
            valuesToTranslate,
            targetLang,
            config.sourceLanguage,
          );

          keysToTranslate.forEach((key, index) => {
            translatedTemplate[key] = translations[index] ?? sourceToTranslate[key]!;
          });
        }

        writeFileSync(targetFilePath, JSON.stringify(translatedTemplate, null, 2));

        if (skipExisting && Object.keys(existingTranslations).length > 0) {
          console.log(
            `✅ Updated ${targetLang} translation file: ${targetFilePath} (using fallback method) (${keysToTranslate.length} new, ${Object.keys(existingTranslations).length} existing)`,
          );
        } else {
          console.log(
            `✅ Generated ${targetLang} translation file: ${targetFilePath} (using fallback method)`,
          );
        }
      } catch (fallbackError) {
        console.error(`❌ Fallback translation also failed for ${targetLang}:`, fallbackError);
      }
    }
  }

  console.log("🎉 Translation generation completed!");
}

async function extractKeys() {
  console.log("🔍 Extracting translation keys...");

  const config = await loadConfig();
  const extractor = new TranslationExtractor();

  let extractedKeys: any[];
  if (Array.isArray(config.sourceDir)) {
    console.log(
      `📁 Scanning ${config.sourceDir.length} directories: ${config.sourceDir.join(", ")}`,
    );
    extractedKeys = extractor.extractFromDirectories(config.sourceDir);
  } else {
    console.log(`📁 Scanning directory: ${config.sourceDir}`);
    extractedKeys = extractor.extractFromDirectory(config.sourceDir);
  }

  if (extractedKeys.length === 0) {
    console.log("❌ No translation keys found.");
    return;
  }

  // 获取提取统计信息
  const stats = extractor.getExtractionStats();
  console.log(`\n📊 Extraction Statistics:`);
  console.log(`  • Total keys: ${stats.totalKeys}`);
  console.log(`  • Files processed: ${stats.fileCount}`);

  // 显示文件分布
  console.log(`\n📂 Keys distribution by file:`);
  Object.entries(stats.fileBreakdown)
    .sort(([, a], [, b]) => b - a) // 按数量排序
    .forEach(([file, count]) => {
      console.log(`  • ${file}: ${count} keys`);
    });

  // 验证提取的键
  const validation = extractor.validateKeys();
  if (validation.invalid.length > 0) {
    console.log(`\n⚠️  Found ${validation.invalid.length} potentially invalid keys:`);
    validation.invalid.forEach((key) => {
      console.log(`  ❌ "${key.key}" (${key.file}:${key.line})`);
    });
  }

  console.log(`\n✅ Found ${validation.valid.length} valid translation keys:`);
  validation.valid.forEach((key) => {
    const truncatedKey = key.key.length > 50 ? key.key.substring(0, 50) + "..." : key.key;
    console.log(`  - "${truncatedKey}" (${key.file}:${key.line})`);
  });
}

async function validateKeys() {
  console.log("🔍 Validating translation keys...");

  const config = await loadConfig();
  const extractor = new TranslationExtractor();

  let extractedKeys: any[];
  if (Array.isArray(config.sourceDir)) {
    console.log(
      `📁 Scanning ${config.sourceDir.length} directories: ${config.sourceDir.join(", ")}`,
    );
    extractedKeys = extractor.extractFromDirectories(config.sourceDir);
  } else {
    console.log(`📁 Scanning directory: ${config.sourceDir}`);
    extractedKeys = extractor.extractFromDirectory(config.sourceDir);
  }

  if (extractedKeys.length === 0) {
    console.log("❌ No translation keys found.");
    return;
  }

  // 验证提取的键
  const validation = extractor.validateKeys();
  const stats = extractor.getExtractionStats();

  console.log(`\n📊 Validation Results:`);
  console.log(`  • Total keys found: ${extractedKeys.length}`);
  console.log(`  • Valid keys: ${validation.valid.length}`);
  console.log(`  • Invalid keys: ${validation.invalid.length}`);
  console.log(`  • Files processed: ${stats.fileCount}`);

  if (validation.invalid.length > 0) {
    console.log(`\n❌ Invalid Keys:`);
    validation.invalid.forEach((key) => {
      const reason =
        key.key.length === 0
          ? "Empty key"
          : key.key.length > 1000
            ? "Too long (>1000 chars)"
            : /^\s*$/.test(key.key)
              ? "Only whitespace"
              : "Unknown issue";
      console.log(`  • "${key.key}" (${key.file}:${key.line}) - ${reason}`);
    });
  }

  // 检查重复的键
  const keyCountMap = new Map<string, number>();
  validation.valid.forEach((key) => {
    keyCountMap.set(key.key, (keyCountMap.get(key.key) || 0) + 1);
  });

  const duplicateKeys = Array.from(keyCountMap.entries()).filter(([, count]) => count > 1);
  if (duplicateKeys.length > 0) {
    console.log(`\n⚠️  Duplicate Keys (will be deduplicated):`);
    duplicateKeys.forEach(([key, count]) => {
      console.log(`  • "${key}" appears ${count} times`);
    });
  }

  // 检查过长的键（可能需要优化）
  const longKeys = validation.valid.filter((key) => key.key.length > 100);
  if (longKeys.length > 0) {
    console.log(`\n💡 Long Keys (consider shortening for better maintainability):`);
    longKeys.forEach((key) => {
      console.log(
        `  • "${key.key.substring(0, 80)}..." (${key.key.length} chars, ${key.file}:${key.line})`,
      );
    });
  }

  // 检查可能的模式问题
  const suspiciousKeys = validation.valid.filter(
    (key) => key.key.includes("${") || key.key.includes("{{") || key.key.includes("\n"),
  );
  if (suspiciousKeys.length > 0) {
    console.log(`\n⚠️  Potentially Problematic Keys:`);
    suspiciousKeys.forEach((key) => {
      const issues = [];
      if (key.key.includes("${")) issues.push("template literal syntax");
      if (key.key.includes("{{")) issues.push("mustache syntax");
      if (key.key.includes("\n")) issues.push("contains newlines");

      console.log(
        `  • "${key.key.replace(/\n/g, "\\n")}" (${key.file}:${key.line}) - ${issues.join(", ")}`,
      );
    });
  }

  if (
    validation.invalid.length === 0 &&
    duplicateKeys.length === 0 &&
    suspiciousKeys.length === 0
  ) {
    console.log(`\n✅ All keys are valid! Ready for translation.`);
  } else {
    console.log(`\n📝 Validation complete. Please review the issues above.`);
  }
}

async function loadConfig(): Promise<Config> {
  const configPath = join(process.cwd(), "l10n.config.json");

  if (!existsSync(configPath)) {
    // 创建默认配置
    const defaultConfig: Config = {
      sourceLanguage: "en",
      targetLanguages: ["zh-CN", "ja", "ko", "es", "fr", "de"],
      sourceDir: "./src",
      outputDir: "./translations",
      apiKey: process.env.GOOGLE_AI_API_KEY || "",
    };

    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`📝 Created default config file: ${configPath}`);
    console.log("⚠️  Please edit the config file and set your GOOGLE_AI_API_KEY");
    return defaultConfig;
  }

  const configContent = readFileSync(configPath, "utf-8");
  return JSON.parse(configContent);
}

/**
 * Handle translate-prompts command
 */
async function handleTranslatePrompts(args: string[]): Promise<void> {
  // Check for help
  if (args.includes("--help") || args.includes("-h")) {
    printTranslatePromptsUsage();
    return;
  }

  // Load config file for API key
  const config = await loadConfig();

  // Parse arguments
  let promptsDir: string | undefined;
  let direction: TranslationDirection = "en-to-zh";
  let workers = 5;
  let apiKey: string | undefined;
  let model: string | undefined;

  for (const arg of args) {
    if (arg.startsWith("--dir=")) {
      promptsDir = arg.slice(6);
    } else if (arg.startsWith("--direction=")) {
      const dir = arg.slice(12);
      if (dir === "zh-to-en" || dir === "en-to-zh") {
        direction = dir;
      } else {
        console.error(`Invalid direction: ${dir}. Use 'zh-to-en' or 'en-to-zh'.`);
        process.exit(1);
      }
    } else if (arg === "zh-to-en" || arg === "en-to-zh") {
      // Support bare direction argument (without --direction= prefix)
      direction = arg;
    } else if (arg.startsWith("--workers=")) {
      const num = parseInt(arg.slice(10), 10);
      if (!isNaN(num) && num > 0) {
        workers = Math.min(num, 20);
      }
    } else if (arg.startsWith("--api-key=")) {
      apiKey = arg.slice(10);
    } else if (arg.startsWith("--model=")) {
      model = arg.slice(8);
    }
  }

  // Resolve API key: command line > config file (apiKey) > env var
  const resolvedApiKey = apiKey || (config as any).apiKey || process.env.OPENROUTER_API_KEY;

  // Validate required arguments
  if (!promptsDir) {
    console.error("Error: --dir is required. Specify the prompts directory path.");
    printTranslatePromptsUsage();
    process.exit(1);
  }

  // Resolve relative path
  const resolvedDir = join(process.cwd(), promptsDir);

  if (!existsSync(resolvedDir)) {
    console.error(`Error: Directory not found: ${resolvedDir}`);
    process.exit(1);
  }

  try {
    const result = await translatePrompts({
      promptsDir: resolvedDir,
      direction,
      workers,
      apiKey: resolvedApiKey,
      model,
    });

    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Translation failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`🌍 L10n Translation Tool

Usage:
  l10n <command> [options]

Commands:
  generate [options]           Generate translation files for all configured languages
  extract                      Extract translation keys from source code and show detailed statistics
  validate                     Validate extracted keys for potential issues and provide recommendations
  translate-prompts [options]  Translate YAML prompt files between languages (zh↔en)
  --help                       Show this help message

Options for generate command:
  --skip-existing, -s   Skip translating keys that already exist in target language files

Options for translate-prompts command:
  --dir=<path>          Prompts directory path (required)
  --direction=<dir>     Translation direction: en-to-zh or zh-to-en (default: en-to-zh)
  --workers=<n>         Number of parallel workers (default: 5, max: 20)
  --api-key=<key>       OpenRouter API key (or set OPENROUTER_API_KEY env var)
  --model=<model>       OpenRouter model name (default: google/gemini-2.0-flash-001)

Examples:
  l10n generate
  l10n generate --skip-existing
  l10n generate -s
  l10n extract
  l10n validate
  l10n translate-prompts --dir=./src/agent/prompts
  l10n translate-prompts --dir=./prompts --direction=zh-to-en --workers=10

Configuration:
  Create a l10n.config.json file in your project root:
  {
    "sourceLanguage": "en",
    "targetLanguages": ["zh-CN", "ja", "ko", "es", "fr", "de"],
    "sourceDir": "./src",
    "outputDir": "./translations",
    "apiKey": "your-google-ai-api-key"
  }

  sourceDir can be a string or an array of strings:
  {
    "sourceDir": ["./src", "./components", "./pages"]
  }

  Or set GOOGLE_AI_API_KEY environment variable.

Features:
  • Supports multi-line l10n.t() calls
  • Detects various call patterns: l10n.t(), t(), template strings
  • Removes comments to avoid false matches
  • Validates keys for common issues
  • Provides detailed extraction statistics
  • Deduplicates keys automatically
  • Smart skip existing translations (--skip-existing)
  • Parallel YAML prompt translation with Gemini (translate-prompts)
`);
}

// ES module way to check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
