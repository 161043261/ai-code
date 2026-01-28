import { Injectable, Logger } from "@nestjs/common";
import * as cheerio from "cheerio";

/**
 * 面试题搜索工具
 * 从面试鸭网站获取关键词相关的面试题列表
 */
@Injectable()
export class InterviewQuestionTool {
  private readonly logger = new Logger(InterviewQuestionTool.name);

  /**
   * 搜索面试题
   * @param keyword 搜索关键词（如"redis"、"java多线程"）
   * @returns 面试题列表，若失败则返回错误信息
   */
  async searchInterviewQuestions(keyword: string): Promise<string> {
    const questions: string[] = [];

    // 构建搜索URL（编码关键词以支持中文）
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `https://www.mianshiya.com/search/all?searchText=${encodedKeyword}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 提取面试题
      $(".ant-table-cell > a").each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          questions.push(text);
        }
      });

      this.logger.log(
        `Found ${questions.length} interview questions for: ${keyword}`,
      );
      return questions.join("\n") || "No questions found";
    } catch (error) {
      this.logger.error(`Interview question search failed: ${error.message}`);
      return `Search failed: ${error.message}`;
    }
  }

  /**
   * 工具描述（用于 LLM function calling）
   */
  getToolDefinition() {
    return {
      name: "interviewQuestionSearch",
      description: `Retrieves relevant interview questions from mianshiya.com based on a keyword.
Use this tool when the user asks for interview questions about specific technologies,
programming concepts, or job-related topics. The input should be a clear search term.`,
      parameters: {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            description: "The keyword to search for interview questions",
          },
        },
        required: ["keyword"],
      },
    };
  }
}
