import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ChatModelService } from "./model/chat-model.service";
import { RagService } from "./rag/rag.service";
import { McpClientService } from "./mcp/mcp-client.service";
import { InterviewQuestionTool } from "./tools/interview-question.tool";
import { ToolProviderService } from "./tools/tool-provider.service";
import { SafeInputGuardrail } from "./guardrail/safe-input.guardrail";
import { ChatMemoryService } from "./memory/chat-memory.service";
import { ChatModelListenerService } from "./listener/chat-model-listener.service";
import {
  StructuredOutputService,
  Report,
} from "./structured-output/structured-output.service";
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import * as fs from "fs";
import * as path from "path";

/**
 * RAG 结果（带来源追踪）
 */
export interface RagResult {
  content: string;
  sources: string[];
}

@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private systemPrompt: string;

  constructor(
    private readonly chatModelService: ChatModelService,
    private readonly ragService: RagService,
    private readonly mcpClientService: McpClientService,
    private readonly interviewQuestionTool: InterviewQuestionTool,
    private readonly toolProviderService: ToolProviderService,
    private readonly guardrail: SafeInputGuardrail,
    private readonly chatMemoryService: ChatMemoryService,
    private readonly listenerService: ChatModelListenerService,
    private readonly structuredOutputService: StructuredOutputService,
  ) {}

  async onModuleInit() {
    // Load system prompt
    const promptPath = path.join(__dirname, "../resources/system-prompt.txt");
    try {
      this.systemPrompt = fs.readFileSync(promptPath, "utf-8");
    } catch {
      this.systemPrompt = `你是编程领域的小助手，帮助用户解答编程学习和求职面试相关的问题，并给出建议。重点关注 4 个方向：
1. 规划清晰的编程学习路线
2. 提供项目学习建议
3. 给出程序员求职全流程指南（比如简历优化、投递技巧）
4. 分享高频面试题和面试技巧
请用简洁易懂的语言回答，助力用户高效学习与求职。`;
    }

    // Initialize RAG
    await this.ragService.initialize();
    this.logger.log("AI Service initialized");
  }

  /**
   * 同步对话
   */
  async chat(userMessage: string): Promise<string> {
    // Input guardrail check
    const guardrailResult = this.guardrail.validate(userMessage);
    if (!guardrailResult.safe) {
      return `Input validation failed: ${guardrailResult.reason}`;
    }

    const chatModel = this.chatModelService.getChatModel();
    const messages = [
      new SystemMessage(this.systemPrompt),
      new HumanMessage(userMessage),
    ];

    // 使用监听器记录请求
    const requestId = this.listenerService.onRequest({
      messages,
      modelName: "chat-model",
    });

    try {
      const response = await chatModel.invoke(messages);
      const content = response.content as string;

      this.listenerService.onResponse(requestId, {
        content,
        modelName: "chat-model",
      });

      return content;
    } catch (error) {
      this.listenerService.onError(requestId, {
        error,
        messages,
        modelName: "chat-model",
      });
      throw error;
    }
  }

  /**
   * 生成结构化学习报告
   */
  async chatForReport(userMessage: string): Promise<Report> {
    const guardrailResult = this.guardrail.validate(userMessage);
    if (!guardrailResult.safe) {
      return {
        name: "验证失败",
        suggestionList: [guardrailResult.reason || "输入包含不安全内容"],
      };
    }

    return this.structuredOutputService.chatForReport(
      userMessage,
      this.systemPrompt,
    );
  }

  /**
   * 流式对话（带会话记忆）
   */
  async *chatStream(
    memoryId: number,
    userMessage: string,
  ): AsyncGenerator<string> {
    // Input guardrail check
    const guardrailResult = this.guardrail.validate(userMessage);
    if (!guardrailResult.safe) {
      yield `Input validation failed: ${guardrailResult.reason}`;
      return;
    }

    // Get chat history from memory
    const history = this.chatMemoryService.getHistory(memoryId);

    // RAG retrieval
    const relevantDocs = await this.ragService.retrieve(userMessage);
    let contextMessage = "";
    if (relevantDocs.length > 0) {
      contextMessage =
        "\n\n相关参考资料：\n" +
        relevantDocs.map((doc) => doc.pageContent).join("\n---\n");
    }

    // 使用 Tool Provider 处理工具调用
    const { content: toolContext, toolCalls } =
      await this.toolProviderService.chatWithTools(
        [new HumanMessage(userMessage)],
        "",
      );

    if (toolCalls && toolCalls.length > 0) {
      this.logger.log(`Tool calls: ${toolCalls.map((t) => t.name).join(", ")}`);
    }

    // Build messages
    const messages = [
      new SystemMessage(this.systemPrompt + contextMessage),
      ...history,
      new HumanMessage(userMessage),
    ];

    // 记录请求
    const requestId = this.listenerService.onRequest({
      messages,
      modelName: "streaming-chat-model",
    });

    // Streaming response
    const streamingModel = this.chatModelService.getStreamingChatModel();
    const stream = await streamingModel.stream(messages);

    let fullResponse = "";
    try {
      for await (const chunk of stream) {
        const content = chunk.content as string;
        if (content) {
          fullResponse += content;
          yield content;
        }
      }

      this.listenerService.onResponse(requestId, {
        content: fullResponse,
        modelName: "streaming-chat-model",
      });
    } catch (error) {
      this.listenerService.onError(requestId, {
        error,
        messages,
        modelName: "streaming-chat-model",
      });
      throw error;
    }

    // Save to memory
    this.chatMemoryService.addMessage(memoryId, new HumanMessage(userMessage));
    this.chatMemoryService.addMessage(memoryId, new AIMessage(fullResponse));

    this.logger.log(`Chat completed for memory ${memoryId}`);
  }

  /**
   * 带 RAG 的对话（带来源追踪）
   */
  async chatWithRag(userMessage: string): Promise<RagResult> {
    const guardrailResult = this.guardrail.validate(userMessage);
    if (!guardrailResult.safe) {
      return {
        content: `Input validation failed: ${guardrailResult.reason}`,
        sources: [],
      };
    }

    const relevantDocs = await this.ragService.retrieve(userMessage);
    const sources = relevantDocs.map(
      (doc) => doc.metadata?.source || doc.metadata?.file_name || "unknown",
    );

    const contextMessage =
      relevantDocs.length > 0
        ? "\n\n相关参考资料：\n" +
          relevantDocs.map((doc) => doc.pageContent).join("\n---\n")
        : "";

    const chatModel = this.chatModelService.getChatModel();
    const messages = [
      new SystemMessage(this.systemPrompt + contextMessage),
      new HumanMessage(userMessage),
    ];

    const requestId = this.listenerService.onRequest({
      messages,
      modelName: "chat-model",
    });

    try {
      const response = await chatModel.invoke(messages);
      const content = response.content as string;

      this.listenerService.onResponse(requestId, {
        content,
        modelName: "chat-model",
      });

      return { content, sources };
    } catch (error) {
      this.listenerService.onError(requestId, {
        error,
        messages,
        modelName: "chat-model",
      });
      throw error;
    }
  }

  /**
   * 带工具调用的对话
   */
  async chatWithTools(userMessage: string): Promise<{
    content: string;
    toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  }> {
    const guardrailResult = this.guardrail.validate(userMessage);
    if (!guardrailResult.safe) {
      return { content: `Input validation failed: ${guardrailResult.reason}` };
    }

    return this.toolProviderService.chatWithTools(
      [new HumanMessage(userMessage)],
      this.systemPrompt,
    );
  }

  /**
   * 带 MCP 的对话
   */
  async chatWithMcp(userMessage: string): Promise<string> {
    const guardrailResult = this.guardrail.validate(userMessage);
    if (!guardrailResult.safe) {
      return `Input validation failed: ${guardrailResult.reason}`;
    }

    // 使用 MCP 工具进行网络搜索
    let mcpContext = "";
    if (this.mcpClientService.isInitialized()) {
      try {
        const searchResult = await this.mcpClientService.executeTool(
          "web_search",
          { query: userMessage },
        );
        mcpContext = `\n\n网络搜索结果：\n${searchResult}`;
      } catch (error) {
        this.logger.warn(`MCP tool execution failed: ${error.message}`);
      }
    }

    const chatModel = this.chatModelService.getChatModel();
    const messages = [
      new SystemMessage(this.systemPrompt + mcpContext),
      new HumanMessage(userMessage),
    ];

    const response = await chatModel.invoke(messages);
    return response.content as string;
  }

  /**
   * 添加自定义监听器
   */
  addChatModelListener(listener: {
    onRequest?: (context: {
      messages: unknown[];
      modelName?: string;
      timestamp: Date;
    }) => void;
    onResponse?: (context: {
      content: string;
      modelName?: string;
      timestamp: Date;
      latencyMs: number;
    }) => void;
    onError?: (context: {
      error: Error;
      modelName?: string;
      timestamp: Date;
    }) => void;
  }): void {
    this.listenerService.addListener(listener);
  }
}
