import { Injectable, Logger } from "@nestjs/common";

export interface GuardrailResult {
  safe: boolean;
  reason?: string;
}

/** 默认敏感词列表 */
const DEFAULT_SENSITIVE_WORDS = ["kill", "evil"];

/**
 * 安全检测输入护轨
 * 检测用户输入是否包含敏感词
 */
@Injectable()
export class SafeInputGuardrail {
  private readonly logger = new Logger(SafeInputGuardrail.name);

  private readonly sensitiveWords: Set<string>;

  constructor() {
    this.sensitiveWords = new Set(DEFAULT_SENSITIVE_WORDS);
  }

  /**
   * 检测用户输入是否安全
   */
  validate(input: string): GuardrailResult {
    // 获取用户输入并转换为小写以确保大小写不敏感
    const inputText = input.toLowerCase();

    // 使用正则表达式分割输入文本为单词
    const words = inputText.split(/\W+/);

    // 遍历所有单词，检查是否存在敏感词
    for (const word of words) {
      if (this.sensitiveWords.has(word)) {
        this.logger.warn(`Sensitive word detected: ${word}`);
        return {
          safe: false,
          reason: `Sensitive word detected: ${word}`,
        };
      }
    }

    return { safe: true };
  }

  /**
   * 添加敏感词
   */
  addSensitiveWord(word: string): void {
    this.sensitiveWords.add(word.toLowerCase());
    this.logger.log(`Added sensitive word: ${word}`);
  }

  /**
   * 移除敏感词
   */
  removeSensitiveWord(word: string): void {
    this.sensitiveWords.delete(word.toLowerCase());
    this.logger.log(`Removed sensitive word: ${word}`);
  }

  /**
   * 获取所有敏感词
   */
  getSensitiveWords(): string[] {
    return Array.from(this.sensitiveWords);
  }
}
