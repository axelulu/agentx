import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { extname, join } from "path";

// 提取的翻译键
export interface ExtractedKey {
  key: string;
  file: string;
  line: number;
  column?: number;
  context?: string;
  defaultValue?: string;
}

export class TranslationExtractor {
  private extractedKeys: ExtractedKey[] = [];
  private supportedExtensions = [".ts", ".tsx", ".js", ".jsx"];

  extractFromDirectory(dirPath: string): ExtractedKey[] {
    this.extractedKeys = [];
    this.scanDirectory(dirPath);
    return this.extractedKeys;
  }

  extractFromDirectories(dirPaths: string[]): ExtractedKey[] {
    this.extractedKeys = [];
    for (const dirPath of dirPaths) {
      this.scanDirectory(dirPath);
    }
    return this.extractedKeys;
  }

  private scanDirectory(dirPath: string): void {
    if (!existsSync(dirPath)) return;

    const items = readdirSync(dirPath);
    for (const item of items) {
      const fullPath = join(dirPath, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // 跳过node_modules和dist等目录
        if (!["node_modules", "dist", "build", ".git"].includes(item)) {
          this.scanDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = extname(item);
        if (this.supportedExtensions.includes(ext)) {
          this.extractFromFile(fullPath);
        }
      }
    }
  }

  private extractFromFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, "utf-8");
      this.extractFromContent(content, filePath);
    } catch (error) {
      console.warn(`Failed to read file: ${filePath}`, error);
    }
  }

  private extractFromContent(content: string, filePath: string): void {
    // 移除注释以避免误匹配
    const contentWithoutComments = this.removeComments(content);

    // 使用增强的正则表达式提取翻译键（已支持跨行）
    this.extractWithRegexPatterns(contentWithoutComments, filePath);
  }

  private removeComments(content: string): string {
    // 移除单行注释 //
    let result = content.replace(/\/\/.*$/gm, "");

    // 移除多行注释 /* */
    result = result.replace(/\/\*[\s\S]*?\*\//g, "");

    return result;
  }

  private extractWithRegexPatterns(content: string, filePath: string): void {
    // 更强大的模式匹配 - 支持各种跨行、JSX、多参数情况
    // 使用 (?:[^"\\]|\\.)* 来正确匹配包含转义字符的字符串
    // gs 标志: g=全局, s=dotall(点匹配换行符)
    const patterns = [
      // 双引号字符串 - 支持跨行、转义字符、撇号等
      // 匹配: l10n.t("...", ...) 或 l10n.t("...")
      // (?:[^"\\]|\\.)* 意思是: 匹配非引号非反斜杠的字符，或者反斜杠+任意字符
      {
        pattern: /l10n\.t\s*\(\s*"((?:[^"\\]|\\.)*)"/gs,
        keyIndex: 1,
      },
      // 单引号字符串 - 支持跨行、转义字符
      {
        pattern: /l10n\.t\s*\(\s*'((?:[^'\\]|\\.)*)'/gs,
        keyIndex: 1,
      },
      // 模板字符串 - 支持跨行、模板变量
      {
        pattern: /l10n\.t\s*\(\s*`((?:[^`\\]|\\.)*)`/gs,
        keyIndex: 1,
      },
      // 简化的 t() 调用 - 双引号（从其他模块导入的 t 函数）
      {
        pattern: /(?:^|[^.\w])t\s*\(\s*"((?:[^"\\]|\\.)*)"/gs,
        keyIndex: 1,
      },
      // 简化的 t() 调用 - 单引号
      {
        pattern: /(?:^|[^.\w])t\s*\(\s*'((?:[^'\\]|\\.)*)'/gs,
        keyIndex: 1,
      },
      // 简化的 t() 调用 - 模板字符串
      {
        pattern: /(?:^|[^.\w])t\s*\(\s*`((?:[^`\\]|\\.)*)`/gs,
        keyIndex: 1,
      },
      // @workspace/l10n 包的直接调用 (各种调用方式)
      {
        pattern: /(?:createL10n|getL10n|L10nRuntime).*\.t\s*\(\s*"((?:[^"\\]|\\.)*)"/gs,
        keyIndex: 1,
      },
      {
        pattern: /(?:createL10n|getL10n|L10nRuntime).*\.t\s*\(\s*'((?:[^'\\]|\\.)*)'/gs,
        keyIndex: 1,
      },
      {
        pattern: /(?:createL10n|getL10n|L10nRuntime).*\.t\s*\(\s*`((?:[^`\\]|\\.)*)`/gs,
        keyIndex: 1,
      },
    ];

    patterns.forEach(({ pattern, keyIndex }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[keyIndex];
        if (key) {
          // 标准化多行字符串中的空白符（换行、多个空格等）
          const normalizedKey = key
            .replace(/\s+/g, " ") // 所有连续空白符（包括换行）替换为单个空格
            .replace(/\\n/g, " ") // 转义的换行符也替换为空格
            .replace(/\\'/g, "'") // 还原转义的单引号
            .replace(/\\"/g, '"') // 还原转义的双引号
            .trim();

          if (normalizedKey && normalizedKey.length > 0) {
            this.addExtractedKey(normalizedKey, filePath, content, match.index);
          }
        }
      }
    });
  }

  private addExtractedKey(
    key: string,
    filePath: string,
    content: string,
    matchIndex: number,
  ): void {
    if (!key || key.trim() === "") return;

    const cleanKey = key.trim();

    // 避免重复添加相同的键
    const exists = this.extractedKeys.some((k) => k.key === cleanKey && k.file === filePath);

    if (!exists) {
      const lineNumber = this.getLineNumber(content, matchIndex);
      const context = this.getContextLine(content, matchIndex);

      this.extractedKeys.push({
        key: cleanKey,
        file: filePath,
        line: lineNumber,
        context: context.trim(),
      });
    }
  }

  private getLineNumber(content: string, index: number): number {
    const beforeMatch = content.substring(0, index);
    return beforeMatch.split("\n").length;
  }

  private getContextLine(content: string, index: number): string {
    const lines = content.split("\n");
    const lineNumber = this.getLineNumber(content, index);

    // 返回匹配行，如果是多行匹配，返回第一行
    const line = lines[lineNumber - 1] || "";

    // 如果行太长，截取相关部分
    if (line.length > 100) {
      const beforeMatch = content.substring(0, index);
      const lineStart = beforeMatch.lastIndexOf("\n") + 1;
      const relativeIndex = index - lineStart;
      const start = Math.max(0, relativeIndex - 50);
      const end = Math.min(line.length, relativeIndex + 50);
      return "..." + line.substring(start, end) + "...";
    }

    return line;
  }

  // 增强的去重方法
  private deduplicateKeys(): void {
    const seen = new Map<string, ExtractedKey>();

    this.extractedKeys.forEach((key) => {
      const existing = seen.get(key.key);
      if (!existing) {
        seen.set(key.key, key);
      }
      // 如果已存在，保留第一个找到的位置信息
    });

    this.extractedKeys = Array.from(seen.values());
  }

  generateTranslationTemplate(): Record<string, string> {
    // 在生成模板前去重
    this.deduplicateKeys();

    const template: Record<string, string> = {};

    this.extractedKeys.forEach((item) => {
      template[item.key] = item.key; // 默认使用键名作为翻译
    });

    return template;
  }

  // 新增：获取提取统计信息
  getExtractionStats(): {
    totalKeys: number;
    fileCount: number;
    fileBreakdown: Record<string, number>;
  } {
    this.deduplicateKeys();

    const fileBreakdown: Record<string, number> = {};

    this.extractedKeys.forEach((key) => {
      fileBreakdown[key.file] = (fileBreakdown[key.file] || 0) + 1;
    });

    return {
      totalKeys: this.extractedKeys.length,
      fileCount: Object.keys(fileBreakdown).length,
      fileBreakdown,
    };
  }

  // 新增：验证提取的键
  validateKeys(): { valid: ExtractedKey[]; invalid: ExtractedKey[] } {
    const valid: ExtractedKey[] = [];
    const invalid: ExtractedKey[] = [];

    this.extractedKeys.forEach((key) => {
      // 验证键的有效性
      if (key.key.length === 0) {
        invalid.push(key);
      } else if (key.key.length > 1000) {
        // 过长的键可能是误匹配
        invalid.push(key);
      } else if (/^\s*$/.test(key.key)) {
        // 只包含空白符
        invalid.push(key);
      } else {
        valid.push(key);
      }
    });

    return { valid, invalid };
  }
}
