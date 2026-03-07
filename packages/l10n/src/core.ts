import { SUPPORTED_LANGUAGE } from "./languages";

interface L10nOptions {
  language?: string;
  fallbackLanguage?: string;
  translations?: Map<string, Record<string, any>>;
}

interface TranslationVariables {
  [key: string]: string | number | boolean;
}

class L10nClient {
  private currentLanguage: string;
  private fallbackLanguage: string;
  private translations: Map<string, Record<string, any>> = new Map();

  constructor(options: L10nOptions = {}) {
    this.currentLanguage = options.language || this.detectLanguage();
    this.fallbackLanguage = options.fallbackLanguage || "en";

    if (options.translations) {
      this.translations = options.translations;
    }
  }

  /**
   * 核心翻译方法
   * 支持语法: l10n.t("文案${var}内容", {var: "变量"})
   */
  t(key: string, variables: TranslationVariables = {}): string {
    // 首先尝试从当前语言获取翻译
    let translation = this.getTranslation(key, this.currentLanguage);

    // 如果没有找到，尝试回退语言
    if (!translation) {
      translation = this.getTranslation(key, this.fallbackLanguage);
    }

    // 如果还是没找到，使用原始 key 作为翻译内容
    if (!translation) {
      translation = key;
    }

    // 无论是否找到翻译，都执行变量替换和其他语法特性处理
    return this.replaceVariables(translation, variables);
  }

  /**
   * 设置当前语言
   */
  setLanguage(language: string): void {
    this.currentLanguage = language;
  }

  /**
   * 获取当前语言
   */
  getLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * 检查当前语言是否为RTL（从右到左）
   */
  isRTL(): boolean {
    const langInfo = SUPPORTED_LANGUAGE.find(
      (lang) =>
        lang.code === this.currentLanguage || lang.code === this.currentLanguage.split("-")[0],
    );
    return langInfo?.isRTL === true;
  }

  /**
   * 获取当前语言的方向
   */
  getDirection(): "ltr" | "rtl" {
    return this.isRTL() ? "rtl" : "ltr";
  }

  /**
   * 设置翻译数据
   */
  setTranslations(language: string, translations: Record<string, any>): void {
    this.translations.set(language, translations);
  }

  /**
   * 获取翻译数据
   */
  getTranslations(): Map<string, Record<string, any>> {
    return this.translations;
  }

  /**
   * 批量设置翻译数据
   */
  setAllTranslations(allTranslations: Record<string, Record<string, any>>): void {
    Object.entries(allTranslations).forEach(([lang, translations]) => {
      this.translations.set(lang, translations);
    });
  }

  /**
   * 重新加载翻译文件
   */
  reload(): void {
    this.translations.clear();
  }

  /**
   * 获取所有可用语言
   */
  getAvailableLanguages(): string[] {
    return Array.from(this.translations.keys());
  }

  /**
   * 检查翻译是否存在
   */
  has(key: string, language?: string): boolean {
    const lang = language || this.currentLanguage;
    const translation = this.getTranslation(key, lang);
    return !!translation;
  }

  /**
   * 变量替换函数
   * 支持 ${var} 语法
   */
  private replaceVariables(text: string, variables: TranslationVariables): string {
    return text.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = variables[varName.trim()];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * 获取翻译文本
   */
  private getTranslation(key: string, language: string): string | null {
    const translations = this.translations.get(language);
    if (!translations) {
      return null;
    }

    // 支持嵌套键，如 "common.button.save"
    const keys = key.split(".");
    let current: any = translations;

    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        // 如果不是嵌套键，直接查找完整的 key
        return translations[key] || null;
      }
    }

    return typeof current === "string" ? current : null;
  }

  /**
   * 检测浏览器语言
   */
  private detectLanguage(): string {
    if (typeof navigator !== "undefined") {
      return navigator.language || navigator.languages?.[0] || "en";
    }

    if (typeof process !== "undefined") {
      return process.env.LANG?.split(".")[0]?.replace("_", "-") || "en";
    }

    return "en";
  }
}

// 创建全局实例
let globalL10n: L10nClient | null = null;

/**
 * 创建 L10n 实例
 */
export function createL10n(options: L10nOptions = {}): L10nClient {
  globalL10n = new L10nClient(options);
  return globalL10n;
}

/**
 * 获取全局 L10n 实例
 */
export function getL10n(): L10nClient {
  if (!globalL10n) {
    globalL10n = new L10nClient();
  }
  return globalL10n;
}

/**
 * 快捷翻译函数
 */
export function t(key: string, variables: TranslationVariables = {}): string {
  return getL10n().t(key, variables);
}

// 导出类型
export { L10nClient };
export type { L10nOptions, TranslationVariables };
