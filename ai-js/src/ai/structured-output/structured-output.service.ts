import { Injectable, Logger } from "@nestjs/common";
import { ChatModelService } from "../model/chat-model.service";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";

/**
 * 学习报告结构
 */
export interface Report {
  name: string;
  suggestionList: string[];
}

/**
 * 结构化输出 Schema 定义
 */
export const ReportSchema = z.object({
  name: z.string().describe("报告名称/用户名"),
  suggestionList: z.array(z.string()).describe("学习建议列表"),
});

/**
 * 结构化输出服务
 * 将 AI 响应解析为结构化对象
 */
@Injectable()
export class StructuredOutputService {
  private readonly logger = new Logger(StructuredOutputService.name);

  constructor(private readonly chatModelService: ChatModelService) {}

  /**
   * 生成学习报告（结构化输出）
   */
  async chatForReport(
    userMessage: string,
    systemPrompt: string,
  ): Promise<Report> {
    const chatModel = this.chatModelService.getChatModel();

    const structuredPrompt = `${systemPrompt}

请根据用户信息生成一份学习报告。
你必须以 JSON 格式返回，包含以下字段：
- name: 用户名称或报告标题
- suggestionList: 学习建议数组，每个元素是一条具体建议

只返回 JSON，不要返回其他内容。
示例格式：
{
  "name": "用户学习报告",
  "suggestionList": ["建议1", "建议2", "建议3"]
}`;

    const messages = [
      new SystemMessage(structuredPrompt),
      new HumanMessage(userMessage),
    ];

    try {
      const response = await chatModel.invoke(messages);
      const content = response.content as string;

      // 提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // 验证结构
      const validated = ReportSchema.parse(parsed);

      this.logger.log(`Generated report: ${validated.name}`);
      return validated;
    } catch (error) {
      this.logger.error(`Failed to generate report: ${error.message}`);
      // 返回默认结构
      return {
        name: "学习报告",
        suggestionList: ["解析失败，请重试"],
      };
    }
  }

  /**
   * 通用结构化输出方法
   */
  async parseStructuredOutput<T>(
    userMessage: string,
    systemPrompt: string,
    schema: z.ZodSchema<T>,
    formatInstructions: string,
  ): Promise<T> {
    const chatModel = this.chatModelService.getChatModel();

    const structuredPrompt = `${systemPrompt}

${formatInstructions}

只返回 JSON，不要返回其他内容。`;

    const messages = [
      new SystemMessage(structuredPrompt),
      new HumanMessage(userMessage),
    ];

    const response = await chatModel.invoke(messages);
    const content = response.content as string;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return schema.parse(parsed);
  }
}
