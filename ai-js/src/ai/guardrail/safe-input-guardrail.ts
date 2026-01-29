import { Injectable, Logger } from '@nestjs/common';

export interface IGuardrailResult {
  result: 'success' | 'failure' | 'fatal';
  failures: string[];
}

@Injectable()
export class SafeInputGuardrail {
  private readonly logger = new Logger(SafeInputGuardrail.name);
  private readonly sensitiveWords = new Set(['fuck', 'fucker', 'motherfucker']);

  validate(input: string): IGuardrailResult {
    const inputText = input.toLowerCase();
    const words = inputText.split(/\w+/);
    for (const word of words) {
      if (this.sensitiveWords.has(word)) {
        this.logger.warn(`Sensitive word detected: ${word}`);
        return {
          result: 'fatal',
          failures: [`Sensitive word detected: ${word}`],
        };
      }
    }
    return { result: 'success', failures: [] };
  }
}
