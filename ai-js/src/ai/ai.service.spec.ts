import { describe, it, expect, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AiService, RagResult } from "./ai.service";
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

// Mock chat model
const mockChatModel = {
  invoke: vi.fn().mockResolvedValue({ content: "Mock AI response" }),
  stream: vi.fn().mockImplementation(async function* () {
    yield { content: "Hello" };
    yield { content: " World" };
  }),
  bind: vi.fn().mockReturnThis(),
};

// Mock services
const mockChatModelService = {
  getChatModel: vi.fn().mockReturnValue(mockChatModel),
  getStreamingChatModel: vi.fn().mockReturnValue(mockChatModel),
};

const mockRagService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  retrieve: vi.fn().mockResolvedValue([]),
};

const mockMcpClientService = {
  isInitialized: vi.fn().mockReturnValue(true),
  executeTool: vi.fn().mockResolvedValue("Mock MCP result"),
  getTools: vi.fn().mockReturnValue([]),
};

const mockInterviewQuestionTool = {
  searchInterviewQuestions: vi.fn().mockResolvedValue("Question 1\nQuestion 2"),
  getToolDefinition: vi.fn().mockReturnValue({
    name: "interviewQuestionSearch",
    description: "Search interview questions",
    parameters: { type: "object", properties: {}, required: [] },
  }),
};

const mockToolProviderService = {
  chatWithTools: vi
    .fn()
    .mockResolvedValue({ content: "Tool response", toolCalls: [] }),
  getToolDefinitions: vi.fn().mockReturnValue([]),
  executeTool: vi.fn().mockResolvedValue("Tool result"),
  registerTool: vi.fn(),
};

const mockListenerService = {
  onRequest: vi.fn().mockReturnValue("req_123"),
  onResponse: vi.fn(),
  onError: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
};

const mockStructuredOutputService = {
  chatForReport: vi.fn().mockResolvedValue({
    name: "学习报告",
    suggestionList: ["建议1", "建议2"],
  }),
  parseStructuredOutput: vi.fn(),
};

describe("AiService", () => {
  let service: AiService;
  let guardrail: SafeInputGuardrail;
  let memoryService: ChatMemoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        SafeInputGuardrail,
        ChatMemoryService,
        { provide: ChatModelService, useValue: mockChatModelService },
        { provide: RagService, useValue: mockRagService },
        { provide: McpClientService, useValue: mockMcpClientService },
        { provide: InterviewQuestionTool, useValue: mockInterviewQuestionTool },
        { provide: ToolProviderService, useValue: mockToolProviderService },
        { provide: ChatModelListenerService, useValue: mockListenerService },
        {
          provide: StructuredOutputService,
          useValue: mockStructuredOutputService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    guardrail = module.get<SafeInputGuardrail>(SafeInputGuardrail);
    memoryService = module.get<ChatMemoryService>(ChatMemoryService);

    // Initialize service
    await service.onModuleInit();
  });

  describe("chat", () => {
    it("should return AI response for valid input", async () => {
      const result = await service.chat("你好，我是程序员鱼皮");
      expect(result).toBe("Mock AI response");
      expect(mockChatModel.invoke).toHaveBeenCalled();
    });

    it("should reject sensitive input", async () => {
      const result = await service.chat("kill the game");
      expect(result).toContain("Input validation failed");
    });
  });

  describe("chatWithMemory", () => {
    it("should remember context across messages", async () => {
      // First message
      const stream1 = service.chatStream(1, "你好，我是程序员鱼皮");
      let response1 = "";
      for await (const chunk of stream1) {
        response1 += chunk;
      }

      // Second message
      const stream2 = service.chatStream(1, "我是谁来着？");
      let response2 = "";
      for await (const chunk of stream2) {
        response2 += chunk;
      }

      // Check memory was used
      const history = memoryService.getHistory(1);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("chatForReport", () => {
    it("should return structured report", async () => {
      const result = await service.chatForReport(
        "你好，我是程序员鱼皮，学编程两年半，请帮我制定学习报告",
      );
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("suggestionList");
      expect(Array.isArray(result.suggestionList)).toBe(true);
    });

    it("should handle guardrail failure", async () => {
      const result = await service.chatForReport("kill something");
      expect(result.suggestionList[0]).toContain("Sensitive word detected");
    });
  });

  describe("chatWithRag", () => {
    it("should return content with sources", async () => {
      mockRagService.retrieve.mockResolvedValueOnce([
        { pageContent: "RAG content", metadata: { source: "doc1.md" } },
      ]);

      const result = await service.chatWithRag(
        "怎么学习 Java？有哪些常见面试题？",
      );
      expect(result).toHaveProperty("content");
      expect(result).toHaveProperty("sources");
    });
  });

  describe("chatWithTools", () => {
    it("should execute tools when needed", async () => {
      const result =
        await service.chatWithTools("有哪些常见的计算机网络面试题？");
      expect(result).toHaveProperty("content");
    });
  });

  describe("chatWithMcp", () => {
    it("should use MCP for web search", async () => {
      const result = await service.chatWithMcp("什么是程序员鱼皮的编程导航？");
      expect(typeof result).toBe("string");
    });
  });

  describe("guardrail", () => {
    it("should block sensitive words", async () => {
      const result = await service.chat("kill the game");
      expect(result).toContain("Input validation failed");
      expect(result).toContain("Sensitive word detected");
    });

    it("should allow safe input", async () => {
      const result = await service.chat("如何学习编程？");
      expect(result).not.toContain("Input validation failed");
    });
  });
});
