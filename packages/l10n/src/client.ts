import { SUPPORTED_LANGUAGE } from "./languages";
import type {
  L10nInstance,
  TranslationContext,
  TranslationData,
} from "./types";

// 客户端专用的L10n类
export class ClientL10n implements L10nInstance {
  private currentLanguage: string;
  private translations: Map<string, TranslationData> = new Map();
  private defaultLanguage: string;
  private supportedLanguages: string[];
  private fallbackLanguage?: string;

  constructor(
    defaultLanguage: string,
    supportedLanguages: string[],
    fallbackLanguage?: string
  ) {
    this.defaultLanguage = defaultLanguage;
    this.supportedLanguages = supportedLanguages;
    this.fallbackLanguage = fallbackLanguage;
    this.currentLanguage = defaultLanguage;
  }

  // 预加载翻译数据
  setTranslations(language: string, data: TranslationData): void {
    this.translations.set(language, data);
  }

  // 批量设置翻译数据
  setAllTranslations(translations: Record<string, TranslationData>): void {
    Object.entries(translations).forEach(([lang, data]) => {
      this.translations.set(lang, data);
    });
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
      data = this.translations.get(
        this.fallbackLanguage || this.defaultLanguage
      );
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
    if (this.supportedLanguages.includes(language)) {
      this.currentLanguage = language;
    } else {
      console.warn(`Language not supported: ${language}`);
    }
  }

  getLanguage(): string {
    return this.currentLanguage;
  }

  getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  isRTL(): boolean {
    const langInfo = SUPPORTED_LANGUAGE.find(
      (lang) =>
        lang.code === this.currentLanguage ||
        lang.code === this.currentLanguage.split("-")[0]
    );
    return langInfo?.isRTL === true;
  }

  getDirection(): "ltr" | "rtl" {
    return this.isRTL() ? "rtl" : "ltr";
  }
}

// 全局客户端实例
let globalClientL10n: ClientL10n | null = null;

export function createClientL10n(
  defaultLanguage: string,
  supportedLanguages: string[],
  fallbackLanguage?: string
): ClientL10n {
  globalClientL10n = new ClientL10n(
    defaultLanguage,
    supportedLanguages,
    fallbackLanguage
  );
  return globalClientL10n;
}

export function getClientL10n(): ClientL10n {
  if (!globalClientL10n) {
    throw new Error(
      "ClientL10n not initialized. Call createClientL10n() first."
    );
  }
  return globalClientL10n;
}

// 简化的t函数
export function clientT(key: string, context?: TranslationContext): string {
  return getClientL10n().t(key, context);
}
