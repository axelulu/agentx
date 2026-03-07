export interface TranslationData {
  [key: string]: string | TranslationData;
}

export interface TranslationContext {
  [key: string]: any;
}

export interface L10nInstance {
  t: (key: string, context?: TranslationContext) => string;
  setLanguage: (language: string) => void;
  getLanguage: () => string;
  getSupportedLanguages: () => string[];
  isRTL: () => boolean;
  getDirection: () => "ltr" | "rtl";
}
