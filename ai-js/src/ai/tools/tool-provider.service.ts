import { Injectable, Logger } from "@nestjs/common";
import { ChatModelService } from "../model/chat-model.service";
import { ChatModelListenerService } from "../listener/chat-model-listener.service";
import { McpClientService } from "../mcp/mcp-client.service";
import { InterviewQuestionTool } from "./interview-question.tool";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";

/**
 * 工具定义接口
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/**
 * 工具调用结果
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Tool Provider 服务
 * 管理和执行工具调用，支持原生 Function Calling
 */
@Injectable()
export class ToolProviderService {
  private readonly logger = new Logger(ToolProviderService.name);
  private tools: Map<
    string,
    {
      definition: ToolDefinition;
      handler: (args: Record<string, unknown>) => Promise<string>;
    }
  > = new Map();

  constructor(
    private readonly chatModelService: ChatModelService,
    private readonly listenerService: ChatModelListenerService,
    private readonly mcpClientService: McpClientService,
    private readonly interviewQuestionTool: InterviewQuestionTool,
  ) {
    this.registerBuiltinTools();
  }

  /**
   * 注册内置工具
   */
  private registerBuiltinTools(): void {
    // 注册面试题搜索工具
    this.registerTool(
      {
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
      },
      async (args) => {
        return this.interviewQuestionTool.searchInterviewQuestions(
          args.keyword as string,
        );
      },
    );

    // 注册 MCP web search 工具
    this.registerTool(
      {
        name: "web_search",
        description:
          "Search the web for real-time information. Use this when user asks about current events, recent news, or information that might not be in your training data.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query",
            },
          },
          required: ["query"],
        },
      },
      async (args) => {
        return this.mcpClientService.executeTool("web_search", args);
      },
    );

    this.logger.log(`Registered ${this.tools.size} tools`);
  }

  /**
   * 注册工具
   */
  registerTool(
    definition: ToolDefinition,
    handler: (args: Record<string, unknown>) => Promise<string>,
  ): void {
    this.tools.set(definition.name, { definition, handler });
    this.logger.debug(`Registered tool: ${definition.name}`);
  }

  /**
   * 获取所有工具定义（用于 LLM function calling）
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * 执行工具
   */
  async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    this.logger.log(`Executing tool: ${name}`);
    try {
      const result = await tool.handler(args);
      this.logger.log(`Tool ${name} completed`);
      return result;
    } catch (error) {
      this.logger.error(`Tool ${name} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 带工具调用的对话
   * 使用原生 function calling 让 LLM 决定是否调用工具
   */
  async chatWithTools(
    messages: (SystemMessage | HumanMessage | AIMessage)[],
    systemPrompt: string,
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const chatModel = this.chatModelService.getChatModel();
    const toolDefinitions = this.getToolDefinitions();

    // 构建带工具的消息
    const fullMessages = [new SystemMessage(systemPrompt), ...messages];

    // 记录请求
    const requestId = this.listenerService.onRequest({
      messages: fullMessages,
      modelName: "chat-model",
    });

    try {
      // 尝试使用 bind 绑定工具
      const modelWithTools = chatModel.bind({
        tools: toolDefinitions.map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
      });

      const response = await modelWithTools.invoke(fullMessages);

      // 检查是否有工具调用
      const toolCalls = response.additional_kwargs?.tool_calls as
        | Array<{ id: string; function: { name: string; arguments: string } }>
        | undefined;

      if (toolCalls && toolCalls.length > 0) {
        // 执行工具调用
        const toolResults: ToolMessage[] = [];
        const parsedToolCalls: ToolCall[] = [];

        for (const toolCall of toolCalls) {
          const args = JSON.parse(toolCall.function.arguments);
          parsedToolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            args,
          });

          try {
            const result = await this.executeTool(toolCall.function.name, args);
            toolResults.push(
              new ToolMessage({
                content: result,
                tool_call_id: toolCall.id,
              }),
            );
          } catch (error) {
            toolResults.push(
              new ToolMessage({
                content: `Error: ${error.message}`,
                tool_call_id: toolCall.id,
              }),
            );
          }
        }

        // 将工具结果发送回模型获取最终响应
        const finalMessages = [...fullMessages, response, ...toolResults];
        const finalResponse = await chatModel.invoke(finalMessages);

        this.listenerService.onResponse(requestId, {
          content: finalResponse.content as string,
          modelName: "chat-model",
        });

        return {
          content: finalResponse.content as string,
          toolCalls: parsedToolCalls,
        };
      }

      this.listenerService.onResponse(requestId, {
        content: response.content as string,
        modelName: "chat-model",
      });

      return { content: response.content as string };
    } catch (error) {
      this.listenerService.onError(requestId, {
        error,
        messages: fullMessages,
        modelName: "chat-model",
      });

      // Fallback: 手动判断是否需要工具
      return this.chatWithToolsFallback(messages, systemPrompt);
    }
  }

  /**
   * Fallback 工具调用（手动判断）
   */
  private async chatWithToolsFallback(
    messages: (SystemMessage | HumanMessage | AIMessage)[],
    systemPrompt: string,
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    const lastMessage = messages[messages.length - 1];
    const userMessage = (lastMessage?.content as string) || "";

    // 检查是否需要面试题工具
    const interviewKeywords = ["面试题", "面试问题", "interview", "面经"];
    const needInterviewTool = interviewKeywords.some((kw) =>
      userMessage.toLowerCase().includes(kw),
    );

    // 检查是否需要网络搜索
    const searchKeywords = [
      "搜索",
      "查询",
      "最新",
      "当前",
      "search",
      "latest",
      "current",
      "程序员鱼皮",
      "编程导航",
    ];
    const needWebSearch = searchKeywords.some((kw) =>
      userMessage.toLowerCase().includes(kw),
    );

    let toolContext = "";
    const toolCalls: ToolCall[] = [];

    if (needInterviewTool) {
      const keyword = this.extractTechKeyword(userMessage);
      const result = await this.executeTool("interviewQuestionSearch", {
        keyword,
      });
      toolContext += `\n\n面试题搜索结果：\n${result}`;
      toolCalls.push({
        id: "fallback_1",
        name: "interviewQuestionSearch",
        args: { keyword },
      });
    }

    if (needWebSearch) {
      const result = await this.executeTool("web_search", {
        query: userMessage,
      });
      toolContext += `\n\n网络搜索结果：\n${result}`;
      toolCalls.push({
        id: "fallback_2",
        name: "web_search",
        args: { query: userMessage },
      });
    }

    const chatModel = this.chatModelService.getChatModel();
    const fullMessages = [
      new SystemMessage(systemPrompt + toolContext),
      ...messages,
    ];

    const response = await chatModel.invoke(fullMessages);

    return {
      content: response.content as string,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  /**
   * 提取技术关键词
   */
  private extractTechKeyword(message: string): string {
    const techKeywords = [
      "java",
      "python",
      "javascript",
      "typescript",
      "react",
      "vue",
      "nodejs",
      "spring",
      "mysql",
      "redis",
      "mongodb",
      "docker",
      "kubernetes",
      "linux",
      "git",
      "算法",
      "数据结构",
      "多线程",
      "并发",
      "网络",
      "http",
      "tcp",
      "设计模式",
    ];

    const lowerMessage = message.toLowerCase();
    for (const keyword of techKeywords) {
      if (lowerMessage.includes(keyword)) {
        return keyword;
      }
    }
    return message.slice(0, 20);
  }
}
