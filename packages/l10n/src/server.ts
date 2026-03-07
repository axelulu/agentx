import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { SUPPORTED_LANGUAGE } from "./languages";
import type { L10nInstance, TranslationContext, TranslationData } from "./types.ts";

// 服务端配置接口
export interface ServerL10nConfig {
  defaultLanguage: string;
  supportedLanguages: string[];
  translationsDir: string;
  fallbackLanguage?: string;
}

// 服务端L10n类
export class ServerL10n implements L10nInstance {
  private config: ServerL10nConfig;
  private currentLanguage: string;
  private translations: Map<string, TranslationData> = new Map();

  constructor(config: ServerL10nConfig) {
    this.config = config;
    this.currentLanguage = config.defaultLanguage;
    this.loadTranslations();
  }

  private loadTranslations(): void {
    const translationsPath = resolve(this.config.translationsDir);

    if (!existsSync(translationsPath)) {
      console.warn(`Translations directory not found: ${translationsPath}`);
      return;
    }

    for (const lang of this.config.supportedLanguages) {
      const langFile = join(translationsPath, `${lang}.json`);
      if (existsSync(langFile)) {
        try {
          const content = readFileSync(langFile, "utf-8");
          const data = JSON.parse(content);
          this.translations.set(lang, data);
        } catch (error) {
          console.warn(`Failed to load translations for ${lang}:`, error);
        }
      }
    }
  }

  t(key: string, context?: TranslationContext): string {
    const translation = this.getTranslation(key);

    if (!translation) {
      return key;
    }

    return this.interpolate(translation, context);
  }

  private getTranslation(key: string): string | undefined {
    const keys = key.split(".");
    let data = this.translations.get(this.currentLanguage);

    if (!data) {
      data = this.translations.get(this.config.fallbackLanguage || this.config.defaultLanguage);
    }

    if (!data) {
      return undefined;
    }

    for (const k of keys) {
      if (data && typeof data === "object" && k in data) {
        data = data[k] as TranslationData;
      } else {
        return undefined;
      }
    }

    return typeof data === "string" ? data : undefined;
  }

  private interpolate(text: string, context?: TranslationContext): string {
    if (!context) return text;

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });
  }

  setLanguage(language: string): void {
    if (this.config.supportedLanguages.includes(language)) {
      this.currentLanguage = language;
    } else {
      console.warn(`Language not supported: ${language}`);
    }
  }

  getLanguage(): string {
    return this.currentLanguage;
  }

  getSupportedLanguages(): string[] {
    return [...this.config.supportedLanguages];
  }

  isRTL(): boolean {
    const langInfo = SUPPORTED_LANGUAGE.find(
      (lang) =>
        lang.code === this.currentLanguage || lang.code === this.currentLanguage.split("-")[0],
    );
    return langInfo?.isRTL === true;
  }

  getDirection(): "ltr" | "rtl" {
    return this.isRTL() ? "rtl" : "ltr";
  }

  // 重新加载翻译文件（热重载支持）
  reloadTranslations(): void {
    this.translations.clear();
    this.loadTranslations();
  }
}
