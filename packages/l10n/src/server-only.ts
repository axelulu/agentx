// 服务端专用入口点 - 包含 Node.js 文件系统操作
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { L10nOptions, TranslationVariables } from "./core";
import { createL10n, getL10n, L10nClient, t } from "./core";

export interface TranslationData {
  [key: string]: string;
}

export interface L10nServerData {
  availableLanguages: string[];
}

/**
 * Server-side l10n data loader
 * This function loads translation file for the specified language only
 */
export async function loadL10nData(
  l10nInstance: L10nClient,
  lang?: string,
  translationsDir?: string
): Promise<L10nServerData> {
  const translationPath =
    translationsDir || join(process.cwd(), "translations");

  // Only load the current language translation file
  if (lang) {
    const filePath = join(translationPath, `${lang}.json`);

    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const translations: TranslationData = JSON.parse(content);
        l10nInstance.setTranslations(lang, translations);
      } catch (error) {
        console.warn(`Failed to load translations for ${lang}:`, error);
      }
    }
    l10nInstance.setLanguage(lang);
  }

  return {
    availableLanguages: lang ? [lang] : [],
  };
}

// 导出核心功能
export { createL10n, getL10n, L10nClient, t };
export type { L10nOptions, TranslationVariables };

// 创建默认的全局实例（客户端安全）
const l10n = getL10n();

// 主要导出
export { l10n };
