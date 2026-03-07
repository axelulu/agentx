/**
 * 支持的语言配置
 * Language configuration for internationalization
 */

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  flag?: string;
  isRTL?: boolean;
}

export const SUPPORTED_LANGUAGE: LanguageInfo[] = [
  // 英语系列
  { code: "en", name: "English", nativeName: "English", flag: "🇺🇸" },
  {
    code: "en-US",
    name: "English (US)",
    nativeName: "English (US)",
    flag: "🇺🇸",
  },
  {
    code: "en-GB",
    name: "English (UK)",
    nativeName: "English (UK)",
    flag: "🇬🇧",
  },

  // 中文系列
  {
    code: "zh-CN",
    name: "Chinese (Simplified)",
    nativeName: "简体中文",
    flag: "🇨🇳",
  },
  {
    code: "zh-TW",
    name: "Chinese (Traditional)",
    nativeName: "繁體中文",
    flag: "🇨🇳",
  },

  // 日语系列
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "ja-JP", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },

  // 韩语系列
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "ko-KR", name: "Korean", nativeName: "한국어", flag: "🇰🇷" },

  // 西班牙语系列
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "es-ES", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },

  // 法语系列
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "fr-FR", name: "French", nativeName: "Français", flag: "🇫🇷" },

  // 德语系列
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "de-DE", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },

  // 意大利语系列
  { code: "it", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "it-IT", name: "Italian", nativeName: "Italiano", flag: "🇮🇹" },

  // 葡萄牙语系列
  { code: "pt", name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  {
    code: "pt-BR",
    name: "Portuguese (Brazil)",
    nativeName: "Português (Brasil)",
    flag: "🇧🇷",
  },
  {
    code: "pt-PT",
    name: "Portuguese (Portugal)",
    nativeName: "Português (Portugal)",
    flag: "🇵🇹",
  },

  // 俄语系列
  { code: "ru", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "ru-RU", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },

  // 阿拉伯语系列
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    isRTL: true,
  },
  {
    code: "ar-SA",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    isRTL: true,
  },

  // 印地语系列
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },

  // 泰语系列
  { code: "th", name: "Thai", nativeName: "ไทย", flag: "🇹🇭" },
  { code: "th-TH", name: "Thai", nativeName: "ไทย", flag: "🇹🇭" },

  // 越南语系列
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "vi-VN", name: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },

  // 印度尼西亚语系列
  {
    code: "id",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    flag: "🇮🇩",
  },
  {
    code: "id-ID",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    flag: "🇮🇩",
  },

  // 马来语系列
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "ms-MY", name: "Malay", nativeName: "Bahasa Melayu", flag: "🇲🇾" },

  // 土耳其语系列
  { code: "tr", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "tr-TR", name: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },

  // 波兰语系列
  { code: "pl", name: "Polish", nativeName: "Polski", flag: "🇵🇱" },
  { code: "pl-PL", name: "Polish", nativeName: "Polski", flag: "🇵🇱" },

  // 荷兰语系列
  { code: "nl", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱" },
  { code: "nl-NL", name: "Dutch", nativeName: "Nederlands", flag: "🇳🇱" },
  {
    code: "nl-BE",
    name: "Dutch (Belgium)",
    nativeName: "Nederlands (België)",
    flag: "🇧🇪",
  },

  // 北欧语言
  { code: "sv", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "sv-SE", name: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "da", name: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  { code: "da-DK", name: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴" },
  { code: "no-NO", name: "Norwegian", nativeName: "Norsk", flag: "🇳🇴" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮" },
  { code: "fi-FI", name: "Finnish", nativeName: "Suomi", flag: "🇫🇮" },
  { code: "is", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸" },
  { code: "is-IS", name: "Icelandic", nativeName: "Íslenska", flag: "🇮🇸" },

  // 中欧语言
  { code: "cs", name: "Czech", nativeName: "Čeština", flag: "🇨🇿" },
  { code: "cs-CZ", name: "Czech", nativeName: "Čeština", flag: "🇨🇿" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺" },
  { code: "hu-HU", name: "Hungarian", nativeName: "Magyar", flag: "🇭🇺" },
  { code: "sk", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰" },
  { code: "sk-SK", name: "Slovak", nativeName: "Slovenčina", flag: "🇸🇰" },
  { code: "sl", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮" },
  { code: "sl-SI", name: "Slovenian", nativeName: "Slovenščina", flag: "🇸🇮" },

  // 东欧语言
  { code: "ro", name: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  { code: "ro-RO", name: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  { code: "bg", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬" },
  { code: "bg-BG", name: "Bulgarian", nativeName: "Български", flag: "🇧🇬" },
  { code: "hr", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷" },
  { code: "hr-HR", name: "Croatian", nativeName: "Hrvatski", flag: "🇭🇷" },
  { code: "sr", name: "Serbian", nativeName: "Српски", flag: "🇷🇸" },
  { code: "sr-RS", name: "Serbian", nativeName: "Српски", flag: "🇷🇸" },
  { code: "bs", name: "Bosnian", nativeName: "Bosanski", flag: "🇧🇦" },
  { code: "me", name: "Montenegrin", nativeName: "Crnogorski", flag: "🇲🇪" },
  { code: "mk", name: "Macedonian", nativeName: "Македонски", flag: "🇲🇰" },
  { code: "sq", name: "Albanian", nativeName: "Shqip", flag: "🇦🇱" },

  // 波罗的海语言
  { code: "et", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪" },
  { code: "et-EE", name: "Estonian", nativeName: "Eesti", flag: "🇪🇪" },
  { code: "lv", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻" },
  { code: "lv-LV", name: "Latvian", nativeName: "Latviešu", flag: "🇱🇻" },
  { code: "lt", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹" },
  { code: "lt-LT", name: "Lithuanian", nativeName: "Lietuvių", flag: "🇱🇹" },

  // 其他欧洲语言
  { code: "el", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷" },
  { code: "el-GR", name: "Greek", nativeName: "Ελληνικά", flag: "🇬🇷" },
  { code: "mt", name: "Maltese", nativeName: "Malti", flag: "🇲🇹" },
  { code: "mt-MT", name: "Maltese", nativeName: "Malti", flag: "🇲🇹" },

  // 凯尔特语言
  { code: "cy", name: "Welsh", nativeName: "Cymraeg", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "cy-GB", name: "Welsh", nativeName: "Cymraeg", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  { code: "ga", name: "Irish", nativeName: "Gaeilge", flag: "🇮🇪" },
  { code: "ga-IE", name: "Irish", nativeName: "Gaeilge", flag: "🇮🇪" },

  // 西班牙地区语言
  { code: "ca", name: "Catalan", nativeName: "Català", flag: "🇪🇸" },
  { code: "ca-ES", name: "Catalan", nativeName: "Català", flag: "🇪🇸" },
  { code: "eu", name: "Basque", nativeName: "Euskera", flag: "🇪🇸" },
  { code: "eu-ES", name: "Basque", nativeName: "Euskera", flag: "🇪🇸" },
  { code: "gl", name: "Galician", nativeName: "Galego", flag: "🇪🇸" },
  { code: "gl-ES", name: "Galician", nativeName: "Galego", flag: "🇪🇸" },

  // 中东语言
  { code: "he", name: "Hebrew", nativeName: "עברית", flag: "🇮🇱", isRTL: true },
  {
    code: "he-IL",
    name: "Hebrew",
    nativeName: "עברית",
    flag: "🇮🇱",
    isRTL: true,
  },
  { code: "fa", name: "Persian", nativeName: "فارسی", flag: "🇮🇷", isRTL: true },
  {
    code: "fa-IR",
    name: "Persian",
    nativeName: "فارسی",
    flag: "🇮🇷",
    isRTL: true,
  },
  { code: "ur", name: "Urdu", nativeName: "اردو", flag: "🇵🇰", isRTL: true },
  { code: "ur-PK", name: "Urdu", nativeName: "اردو", flag: "🇵🇰", isRTL: true },
  { code: "ku", name: "Kurdish", nativeName: "Kurdî", flag: "🇮🇶" },

  // 印度次大陆语言
  { code: "bn", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
  { code: "bn-BD", name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली", flag: "🇳🇵" },
  { code: "ne-NP", name: "Nepali", nativeName: "नेपाली", flag: "🇳🇵" },
  { code: "si", name: "Sinhala", nativeName: "සිංහල", flag: "🇱🇰" },
  { code: "si-LK", name: "Sinhala", nativeName: "සිංහල", flag: "🇱🇰" },
  { code: "ps", name: "Pashto", nativeName: "پښتو", flag: "🇦🇫" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي", flag: "🇵🇰" },

  // 东南亚语言
  { code: "my", name: "Burmese", nativeName: "မြန်မာ", flag: "🇲🇲" },
  { code: "my-MM", name: "Burmese", nativeName: "မြန်မာ", flag: "🇲🇲" },
  { code: "km", name: "Khmer", nativeName: "ខ្មែរ", flag: "🇰🇭" },
  { code: "km-KH", name: "Khmer", nativeName: "ខ្មែរ", flag: "🇰🇭" },
  { code: "lo", name: "Lao", nativeName: "ລາວ", flag: "🇱🇦" },
  { code: "lo-LA", name: "Lao", nativeName: "ລາວ", flag: "🇱🇦" },
  { code: "jw", name: "Javanese", nativeName: "Basa Jawa", flag: "🇮🇩" },
  { code: "su", name: "Sundanese", nativeName: "Basa Sunda", flag: "🇮🇩" },
  { code: "ceb", name: "Cebuano", nativeName: "Binisaya", flag: "🇵🇭" },
  { code: "fil", name: "Filipino", nativeName: "Filipino", flag: "🇵🇭" },

  // 高加索语言
  { code: "ka", name: "Georgian", nativeName: "ქართული", flag: "🇬🇪" },
  { code: "ka-GE", name: "Georgian", nativeName: "ქართული", flag: "🇬🇪" },
  { code: "hy", name: "Armenian", nativeName: "Հայերեն", flag: "🇦🇲" },
  { code: "hy-AM", name: "Armenian", nativeName: "Հայերեն", flag: "🇦🇲" },
  {
    code: "az",
    name: "Azerbaijani",
    nativeName: "Azərbaycan dili",
    flag: "🇦🇿",
  },
  {
    code: "az-AZ",
    name: "Azerbaijani",
    nativeName: "Azərbaycan dili",
    flag: "🇦🇿",
  },

  // 中亚语言
  { code: "kk", name: "Kazakh", nativeName: "Қазақ тілі", flag: "🇰🇿" },
  { code: "kk-KZ", name: "Kazakh", nativeName: "Қазақ тілі", flag: "🇰🇿" },
  { code: "ky", name: "Kyrgyz", nativeName: "Кыргызча", flag: "🇰🇬" },
  { code: "ky-KG", name: "Kyrgyz", nativeName: "Кыргызча", flag: "🇰🇬" },
  { code: "uz", name: "Uzbek", nativeName: "O'zbekcha", flag: "🇺🇿" },
  { code: "uz-UZ", name: "Uzbek", nativeName: "O'zbekcha", flag: "🇺🇿" },
  { code: "tg", name: "Tajik", nativeName: "Тоҷикӣ", flag: "🇹🇯" },
  { code: "tg-TJ", name: "Tajik", nativeName: "Тоҷикӣ", flag: "🇹🇯" },
  { code: "tk", name: "Turkmen", nativeName: "Türkmençe", flag: "🇹🇲" },
  { code: "mn", name: "Mongolian", nativeName: "Монгол хэл", flag: "🇲🇳" },
  { code: "mn-MN", name: "Mongolian", nativeName: "Монгол хэл", flag: "🇲🇳" },

  // 其他亚洲语言
  { code: "be", name: "Belarusian", nativeName: "Беларуская мова", flag: "🇧🇾" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська мова", flag: "🇺🇦" },
  { code: "bo", name: "Tibetan", nativeName: "བོད་ཡིག", flag: "🏔️" },
  { code: "bo-CN", name: "Tibetan", nativeName: "བོད་ཡིག", flag: "🏔️" },
  { code: "dz", name: "Dzongkha", nativeName: "རྫོང་ཁ", flag: "🇧🇹" },

  // 非洲语言
  { code: "am", name: "Amharic", nativeName: "አማርኛ", flag: "🇪🇹" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", flag: "🇹🇿" },
  { code: "zu", name: "Zulu", nativeName: "isiZulu", flag: "🇿🇦" },
  { code: "af", name: "Afrikaans", nativeName: "Afrikaans", flag: "🇿🇦" },
  { code: "xh", name: "Xhosa", nativeName: "isiXhosa", flag: "🇿🇦" },
  { code: "st", name: "Sesotho", nativeName: "Sesotho", flag: "🇱🇸" },
  { code: "tn", name: "Tswana", nativeName: "Setswana", flag: "🇧🇼" },
  { code: "ts", name: "Tsonga", nativeName: "Xitsonga", flag: "🇿🇦" },
  { code: "ve", name: "Venda", nativeName: "Tshivenda", flag: "🇿🇦" },
  { code: "ss", name: "Swati", nativeName: "siSwati", flag: "🇸🇿" },
  {
    code: "nd",
    name: "Northern Ndebele",
    nativeName: "isiNdebele",
    flag: "🇿🇼",
  },
  {
    code: "nr",
    name: "Southern Ndebele",
    nativeName: "isiNdebele",
    flag: "🇿🇦",
  },
  { code: "sn", name: "Shona", nativeName: "chiShona", flag: "🇿🇼" },
  { code: "yo", name: "Yoruba", nativeName: "Èdè Yorùbá", flag: "🇳🇬" },
  { code: "ig", name: "Igbo", nativeName: "Asụsụ Igbo", flag: "🇳🇬" },
  { code: "ha", name: "Hausa", nativeName: "Harshen Hausa", flag: "🇳🇬" },
  { code: "so", name: "Somali", nativeName: "Af-Soomaali", flag: "🇸🇴" },
  { code: "om", name: "Oromo", nativeName: "Afaan Oromoo", flag: "🇪🇹" },
  { code: "ti", name: "Tigrinya", nativeName: "ትግርኛ", flag: "🇪🇷" },
  { code: "rw", name: "Kinyarwanda", nativeName: "Ikinyarwanda", flag: "🇷🇼" },
  { code: "rn", name: "Kirundi", nativeName: "Ikirundi", flag: "🇧🇮" },
  { code: "lg", name: "Ganda", nativeName: "Luganda", flag: "🇺🇬" },
  { code: "ak", name: "Akan", nativeName: "Akan", flag: "🇬🇭" },
  { code: "tw", name: "Twi", nativeName: "Twi", flag: "🇬🇭" },
  { code: "ee", name: "Ewe", nativeName: "Eʋegbe", flag: "🇬🇭" },
  { code: "wo", name: "Wolof", nativeName: "Wolof", flag: "🇸🇳" },
  { code: "ff", name: "Fulah", nativeName: "Pulaar", flag: "🇸🇳" },
  { code: "bm", name: "Bambara", nativeName: "Bamanankan", flag: "🇲🇱" },
  { code: "dy", name: "Dyula", nativeName: "Julakan", flag: "🇨🇮" },
  { code: "fon", name: "Fon", nativeName: "Fɔngbè", flag: "🇧🇯" },
  { code: "dyo", name: "Jola-Fonyi", nativeName: "Joola", flag: "🇸🇳" },
  { code: "sg", name: "Sango", nativeName: "Sängö", flag: "🇨🇫" },
  { code: "ln", name: "Lingala", nativeName: "Lingála", flag: "🇨🇩" },
  { code: "mg", name: "Malagasy", nativeName: "Fiteny Malagasy", flag: "🇲🇬" },

  // 太平洋语言
  { code: "haw", name: "Hawaiian", nativeName: "ʻŌlelo Hawaiʻi", flag: "🇺🇸" },
  { code: "mi", name: "Maori", nativeName: "Te Reo Māori", flag: "🇳🇿" },
  { code: "sm", name: "Samoan", nativeName: "Gagana Samoa", flag: "🇼🇸" },
  { code: "to", name: "Tongan", nativeName: "Lea Faka-Tonga", flag: "🇹🇴" },
  { code: "fj", name: "Fijian", nativeName: "Vosa Vakaviti", flag: "🇫🇯" },
  { code: "ty", name: "Tahitian", nativeName: "Reo Tahiti", flag: "🇵🇫" },
];
