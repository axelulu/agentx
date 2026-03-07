import { getL10n } from "./client-only";

// Export supported languages configuration
export { SUPPORTED_LANGUAGE } from "./languages";
export type { LanguageInfo } from "./languages";

// 创建默认的全局实例（客户端安全）
const l10n = getL10n();

// 主要导出
export { l10n };
