import { Injectable, Logger } from '@nestjs/common';
import cheerio from 'cheerio';

@Injectable()
export class CodeQuestionTool {
  private readonly logger = new Logger(CodeQuestionTool.name);

  async searchCodeQuestions(keyword: string): Promise<string> {
    const questions: string[] = [];
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://leetcode.cn/search/?q=${encodedKeyword}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      const $ = cheerio.load(html);
      $('a').each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          questions.push(text);
        }
      });
      this.logger.log(
        `Found relevant ${questions.length} code questions from leetcode.cn for keyword: ${keyword}`,
      );
      return questions.join('\n') ?? 'No questions found';
    } catch (err) {
      this.logger.error('Code question search failed:', err);
      return `Code question search failed: ${err.message}`;
    }
  }

  getToolDefinition() {
    return {
      name: 'CodeQuestionTool',
      description: `
        Find relevant code questions based on a keyword.
        Use this tool when the user asks for code questions.
        The input should be a clear search keyword.
      `,
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: 'The keyword to search',
          },
        },
        required: ['keyword'],
      },
    };
  }
}
