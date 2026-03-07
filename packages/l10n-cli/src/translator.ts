import { LanguageInfo, SUPPORTED_LANGUAGE } from "@workspace/l10n/languages";
import OpenAI from "openai";

export class Translator {
  private client: OpenAI;
  private supportedLanguages: LanguageInfo[] = SUPPORTED_LANGUAGE;
  private primaryModel: string = "anthropic/claude-3.7-sonnet";
  private fallbackModels: string[] = [
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3.1-8b-instruct:free",
    "gpt-3.5-turbo",
  ];
  private currentModelIndex: number = -1; // -1 means using primary model

  constructor(apiKey?: string | undefined) {
    const openrouterApiKey = apiKey || process.env.OPENROUTER_API_KEY || "";

    if (!openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is required");
    }

    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openrouterApiKey,
    });
  }

  /**
   * Get current model to use (primary or fallback)
   */
  private getCurrentModel(): string {
    if (this.currentModelIndex === -1) {
      return this.primaryModel;
    }
    return this.fallbackModels[this.currentModelIndex] || this.primaryModel;
  }

  /**
   * Switch to next fallback model
   */
  private switchToNextModel(): boolean {
    if (this.currentModelIndex < this.fallbackModels.length - 1) {
      this.currentModelIndex++;
      console.log(`🔄 Switching to fallback model: ${this.getCurrentModel()}`);
      return true;
    }
    return false;
  }

  /**
   * Reset to primary model
   */
  private resetToPrimaryModel(): void {
    this.currentModelIndex = -1;
  }

  /**
   * Sleep function for exponential backoff
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getSupportedLanguages(): LanguageInfo[] {
    return [...this.supportedLanguages];
  }

  /**
   * Find language info by language code, with fallback support
   * Supports both exact matches and base language fallback
   * e.g. 'pt-BR' -> 'pt-BR' or fallback to 'pt'
   */
  private findLanguage(languageCode: string): LanguageInfo | null {
    // First try exact match
    const exactMatch = this.supportedLanguages.find((lang) => lang.code === languageCode);
    if (exactMatch) {
      return exactMatch;
    }

    // If not found and has country code, try base language
    if (languageCode.includes("-")) {
      const baseLanguage = languageCode.split("-")[0];
      const baseMatch = this.supportedLanguages.find((lang) => lang.code === baseLanguage);
      if (baseMatch) {
        return baseMatch;
      }
    }

    return null;
  }

  async translate(
    text: string,
    targetLanguage: string,
    sourceLanguage: string = "en",
    isFromConcurrentWorker: boolean = false,
  ): Promise<string> {
    const targetLang = this.findLanguage(targetLanguage);
    if (!targetLang) {
      throw new Error(`Unsupported target language: ${targetLanguage}`);
    }

    const sourceLang = this.findLanguage(sourceLanguage);
    if (!sourceLang) {
      throw new Error(`Unsupported source language: ${sourceLanguage}`);
    }

    const prompt = `You are an expert localization specialist with deep cultural knowledge of ${targetLang.name} (${targetLang.nativeName}) speaking regions.

Your task: Translate the following ${sourceLang.name} text to ${targetLang.name}, applying professional localization principles:

1. CULTURAL ADAPTATION: Adapt idioms, metaphors, and cultural references to be natural for ${targetLang.name} speakers. Don't translate literally if it sounds unnatural.
2. TONE & REGISTER: Match the formality level and tone appropriate for ${targetLang.name} culture and context.
3. USER EXPERIENCE: Prioritize clarity and natural flow over word-for-word accuracy. The translation should feel like it was written by a native speaker.
4. TECHNICAL TERMS: Keep standard technical terms, UI elements, and product names as commonly used in ${targetLang.name} localization (transliterate or keep English if that's the convention).
5. NATURAL PHRASING: Use expressions and sentence structures that ${targetLang.name} native speakers would naturally use, not machine-translation patterns.

Source text: "${text}"

Return ONLY the translated text, with no explanations or annotations.`;

    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const currentModel = this.getCurrentModel();
        if (!isFromConcurrentWorker && attempt > 0) {
          console.log(`🔄 Attempt ${attempt + 1}/${maxRetries + 1} using model: ${currentModel}`);
        }

        const response = await this.client.chat.completions.create({
          model: currentModel,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 4000,
          temperature: 0.0,
          top_p: 0.1,
        });

        const translatedText = response.choices[0]?.message?.content?.trim() || text;

        // Reset to primary model on success
        if (attempt > 0 || this.currentModelIndex !== -1) {
          this.resetToPrimaryModel();
          if (!isFromConcurrentWorker) {
            console.log("✅ Translation successful, reset to primary model");
          }
        }

        return translatedText;
      } catch (error: any) {
        if (!isFromConcurrentWorker) {
          console.error(`❌ Translation attempt ${attempt + 1} failed:`, {
            model: this.getCurrentModel(),
            error: error.message,
            status: error.status || "Unknown",
          });
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          if (!isFromConcurrentWorker) {
            console.error("🚫 All retry attempts exhausted");
          }
          throw error;
        }

        // Handle different types of errors
        const shouldSwitchModel = this.shouldSwitchModel(error);
        const shouldRetry = this.shouldRetry(error);

        if (!shouldRetry) {
          if (!isFromConcurrentWorker) {
            console.error("🚫 Error type indicates no retry should be attempted");
          }
          throw error;
        }

        if (shouldSwitchModel && this.switchToNextModel()) {
          if (!isFromConcurrentWorker) {
            console.log("🔄 Switched to fallback model, retrying immediately...");
          }
          continue; // Retry immediately with new model
        }

        // Exponential backoff for network/rate limit errors
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        if (!isFromConcurrentWorker) {
          console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
        }
        await this.sleep(delay);
      }
    }

    // This should never be reached, but for type safety
    throw new Error("Translation failed after all retries");
  }

  /**
   * Determine if we should retry based on error type
   */
  private shouldRetry(error: any): boolean {
    // Network errors (connection issues, timeouts)
    if (error.code === "UND_ERR_SOCKET" || error.message?.includes("terminated")) {
      return true;
    }

    // Rate limiting
    if (error.status === 429) {
      return true;
    }

    // Server errors (5xx)
    if (error.status >= 500) {
      return true;
    }

    // Provider errors that might be temporary
    if (error.status === 400 && error.error?.metadata?.provider_name) {
      return true;
    }

    // Other retryable OpenAI errors
    if (error.type === "server_error" || error.type === "timeout") {
      return true;
    }

    return false;
  }

  /**
   * Determine if we should switch model based on error type
   */
  private shouldSwitchModel(error: any): boolean {
    // Location restrictions or provider-specific errors
    if (error.status === 400 && error.error?.metadata?.provider_name) {
      console.log(
        `🚫 Provider error (${error.error.metadata.provider_name}): ${error.error.message}`,
      );
      return true;
    }

    // Model-specific authentication or permission errors
    if (error.status === 401 || error.status === 403) {
      return true;
    }

    // Model not found or unavailable
    if (error.status === 404) {
      return true;
    }

    return false;
  }

  /**
   * 并发翻译整个JSON对象到目标语言 - 使用20个异步任务池
   */
  async translateJSON(
    jsonObject: Record<string, string>,
    targetLanguage: string,
    sourceLanguage: string = "en",
  ): Promise<Record<string, string>> {
    const targetLang = this.findLanguage(targetLanguage);
    if (!targetLang) {
      throw new Error(`Unsupported target language: ${targetLanguage}`);
    }

    const sourceLang = this.findLanguage(sourceLanguage);
    if (!sourceLang) {
      throw new Error(`Unsupported source language: ${sourceLanguage}`);
    }

    console.log(`🚀 Starting concurrent translation with 20 workers...`);

    return this.translateWithConcurrentPool(jsonObject, targetLanguage, sourceLanguage);
  }

  /**
   * 并发任务池翻译方法
   */
  private async translateWithConcurrentPool(
    jsonObject: Record<string, string>,
    targetLanguage: string,
    sourceLanguage: string,
  ): Promise<Record<string, string>> {
    const entries = Object.entries(jsonObject);
    const result: Record<string, string> = {};
    const errors: Array<{ key: string; value: string; error: string }> = [];

    const concurrency = 40; // 并发任务数

    console.log(`📊 Total items to translate: ${entries.length}`);
    console.log(`⚡ Using ${concurrency} concurrent workers`);

    // 重置工作计数器 - 每次翻译都从0开始
    const workCounter = { value: 0 };

    // 创建40个工作者Promise
    const workers = Array.from({ length: concurrency }, (_, workerId) =>
      this.createWorker(
        workerId,
        entries,
        result,
        errors,
        targetLanguage,
        sourceLanguage,
        workCounter, // 传递计数器对象
      ),
    );

    // 等待所有工作者完成
    await Promise.all(workers);

    console.log(`\n✅ Translation completed!`);
    console.log(`📊 Results: ${Object.keys(result).length}/${entries.length} processed`);

    if (errors.length > 0) {
      console.log(`⚠️  ${errors.length} items failed to translate (kept original)`);

      // 显示前几个错误作为示例
      const sampleErrors = errors.slice(0, 3);
      sampleErrors.forEach((err) => {
        console.log(`  • "${err.key}": ${err.error}`);
      });

      if (errors.length > 3) {
        console.log(`  ... and ${errors.length - 3} more errors`);
      }
    }

    return result;
  }

  /**
   * 创建单个工作者
   */
  private async createWorker(
    workerId: number,
    entries: [string, string][],
    result: Record<string, string>,
    errors: Array<{ key: string; value: string; error: string }>,
    targetLanguage: string,
    sourceLanguage: string,
    workCounter: { value: number },
  ): Promise<void> {
    while (true) {
      // 原子性地获取下一个工作项
      const currentIndex = this.getNextWorkIndex(entries.length, workCounter);
      if (currentIndex === -1) break; // 没有更多工作

      //@ts-ignore
      const [key, value] = entries[currentIndex];

      try {
        // 显示进度（只让worker 0显示，避免重复日志）
        if (workerId === 0) {
          const progress = Math.round(((Object.keys(result).length + 1) / entries.length) * 100);
          if (Object.keys(result).length % 20 === 0 || Object.keys(result).length === 0) {
            console.log(
              `📈 Progress: ${Object.keys(result).length}/${entries.length} (${progress}%) - Worker ${workerId} translating: "${key.length > 30 ? key.substring(0, 30) + "..." : key}"`,
            );
          }
        }

        // 执行翻译
        const translated = await this.translateSingleItem(
          key,
          value,
          targetLanguage,
          sourceLanguage,
          2, // 最多重试2次
        );

        // 线程安全地存储结果
        result[key] = translated;
      } catch (error) {
        console.error(
          `❌ Worker ${workerId} failed to translate "${key}":`,
          error instanceof Error ? error.message : error,
        );
        errors.push({
          key,
          value,
          error: error instanceof Error ? error.message : String(error),
        });

        // 翻译失败时保留原文
        result[key] = value;
      }

      // 添加小延迟避免API限制 - 每个worker稍微不同的延迟
      await new Promise((resolve) => setTimeout(resolve, 100 + workerId * 10));
    }
  }

  /**
   * 原子性获取下一个工作索引（使用传入的计数器对象）
   */
  private getNextWorkIndex(totalWork: number, workCounter: { value: number }): number {
    if (workCounter.value >= totalWork) {
      return -1;
    }
    return workCounter.value++;
  }

  /**
   * 翻译单个键值对 - 现在使用改进的 translate 方法（内置重试机制）
   */
  private async translateSingleItem(
    key: string,
    value: string,
    targetLanguage: string,
    sourceLanguage: string,
    maxRetries: number = 2, // 保持兼容性，但实际重试在 translate 方法中处理
  ): Promise<string> {
    try {
      return await this.translate(value, targetLanguage, sourceLanguage, true); // 标记为并发工作者调用
    } catch (error) {
      console.error(`Failed to translate "${key}": ${value}`, error);
      return value; // 返回原文作为后备
    }
  }

  /**
   * 后备方案：如果批量翻译失败，则一条条翻译（保留原有逻辑）
   */
  private async translateJSONFallback(
    jsonObject: Record<string, string>,
    targetLanguage: string,
    sourceLanguage: string = "en",
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const entries = Object.entries(jsonObject);

    for (const [key, value] of entries) {
      try {
        const translated = await this.translate(
          value,
          targetLanguage,
          sourceLanguage,
          false, // 不是并发模式，显示详细日志
        );
        result[key] = translated;
        // 添加延迟避免API限制
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to translate key "${key}": ${value}`, error);
        result[key] = value; // 保留原文
      }
    }

    return result;
  }

  async translateBatch(
    texts: string[],
    targetLanguage: string,
    sourceLanguage: string = "en",
  ): Promise<string[]> {
    // 如果文本数量较少，可以尝试构建JSON对象进行批量翻译
    if (texts.length <= 100) {
      // 限制数量以避免JSON过大
      try {
        // 构建临时JSON对象
        const jsonObject: Record<string, string> = {};
        texts.forEach((text, index) => {
          jsonObject[`item_${index}`] = text;
        });

        const translatedJson = await this.translateJSON(jsonObject, targetLanguage, sourceLanguage);

        // 按原顺序返回结果
        return texts.map((_, index) => translatedJson[`item_${index}`] || texts[index]) as string[];
      } catch (error) {
        console.warn("Batch translation failed, falling back to individual translation");
      }
    }

    // 后备方案：一条条翻译
    const results: string[] = [];
    for (const text of texts) {
      try {
        const translated = await this.translate(
          text,
          targetLanguage,
          sourceLanguage,
          false, // 不是并发模式，显示详细日志
        );
        results.push(translated);
        // 添加延迟避免API限制
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to translate: ${text}`, error);
        results.push(text);
      }
    }

    return results;
  }
}
