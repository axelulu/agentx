/**
 * Locale and timezone types for global context
 */

/**
 * BCP 47 language tags
 * Supported languages in the application
 * Based on TARGET_LANGUAGES from LanguageSwitcher
 */
export type LanguageCode =
  | "en"
  | "de"
  | "es"
  | "fr"
  | "it"
  | "pt-BR"
  | "pt"
  | "vi"
  | "tr"
  | "zh-CN"
  | "zh-TW"
  | "ja"
  | "ko"
  | "ar"
  | "th"
  | "hi";

/**
 * Locale context containing language and timezone information
 */
export interface LocaleContext {
  /**
   * Language code (BCP 47 language tag)
   * @example "en", "zh-CN", "zh-TW", "pt-BR"
   */
  language: LanguageCode | string;

  /**
   * IANA timezone identifier
   * @example "America/New_York", "Asia/Shanghai", "Europe/London"
   */
  timezone: string;
}

/**
 * Request headers for locale information
 */
export interface LocaleHeaders {
  /**
   * Language header (X-Locale)
   */
  "X-Locale"?: string;

  /**
   * Timezone header (X-Timezone)
   */
  "X-Timezone"?: string;
}

/**
 * Default locale settings
 */
export const DEFAULT_LOCALE: LocaleContext = {
  language: "en",
  timezone: "UTC",
} as const;

/**
 * All supported languages (standard list)
 * This should match TARGET_LANGUAGES from LanguageSwitcher
 */
export const SUPPORTED_LANGUAGES: LanguageCode[] = [
  "en",
  "de",
  "es",
  "fr",
  "it",
  "pt-BR",
  "pt",
  "vi",
  "tr",
  "zh-CN",
  "zh-TW",
  "ja",
  "ko",
  "ar",
  "th",
  "hi",
];
