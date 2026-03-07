// 客户端专用入口点 - 不包含任何 Node.js 模块
import type { L10nOptions, TranslationVariables } from "./core";
import { createL10n, getL10n, L10nClient, t } from "./core";

// 创建默认的全局实例（客户端安全）
const l10n = getL10n();

// 主要导出
export { l10n };

// 工具函数导出
export { createL10n, getL10n, L10nClient, t };

// 类型导出
export type { L10nOptions, TranslationVariables };

// 默认导出
export default l10n;

/**
 * 初始化客户端 l10n 实例并设置翻译数据
 * 这个函数应该在客户端应用启动时调用，通过服务端传递的数据初始化
 */
export function initializeClientL10n(
  language: string,
  translations: Record<string, any>,
  options: Omit<L10nOptions, "translations"> = {},
): L10nClient {
  const translationsMap = new Map();
  translationsMap.set(language, translations);

  return createL10n({
    ...options,
    language,
    translations: translationsMap,
  });
}

/**
 * 为现有的 l10n 实例添加翻译数据
 */
export function addTranslations(language: string, translations: Record<string, any>): void {
  const instance = getL10n();
  instance.setTranslations(language, translations);
}
