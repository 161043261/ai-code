import { describe, it, expect, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ToolProviderService, ToolDefinition } from "./tool-provider.service";
import { ChatModelService } from "../model/chat-model.service";
import { ChatModelListenerService } from "../listener/chat-model-listener.service";
import { McpClientService } from "../mcp/mcp-client.service";
import { InterviewQuestionTool } from "./interview-question.tool";
import { HumanMessage } from "@langchain/core/messages";

const mockChatModel = {
  invoke: vi.fn(),
  bind: vi.fn().mockReturnThis(),
};

const mockChatModelService = {
  getChatModel: vi.fn().mockReturnValue(mockChatModel),
  getStreamingChatModel: vi.fn().mockReturnValue(mockChatModel),
};

const mockListenerService = {
  onRequest: vi.fn().mockReturnValue("req_123"),
  onResponse: vi.fn(),
  onError: vi.fn(),
};

const mockMcpClientService = {
  isInitialized: vi.fn().mockReturnValue(true),
  executeTool: vi.fn().mockResolvedValue("MCP result"),
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

describe("ToolProviderService", () => {
  let service: ToolProviderService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolProviderService,
        { provide: ChatModelService, useValue: mockChatModelService },
        { provide: ChatModelListenerService, useValue: mockListenerService },
        { provide: McpClientService, useValue: mockMcpClientService },
        { provide: InterviewQuestionTool, useValue: mockInterviewQuestionTool },
      ],
    }).compile();

    service = module.get<ToolProviderService>(ToolProviderService);
  });

  describe("getToolDefinitions", () => {
    it("should return registered tool definitions", () => {
      const definitions = service.getToolDefinitions();

      expect(definitions.length).toBeGreaterThan(0);
      expect(
        definitions.some((d) => d.name === "interviewQuestionSearch"),
      ).toBe(true);
      expect(definitions.some((d) => d.name === "web_search")).toBe(true);
    });
  });

  describe("registerTool", () => {
    it("should register a new tool", async () => {
      const customTool: ToolDefinition = {
        name: "customTool",
        description: "A custom tool",
        parameters: {
          type: "object",
          properties: {
            input: { type: "string", description: "Input" },
          },
          required: ["input"],
        },
      };

      service.registerTool(customTool, async (args) => `Result: ${args.input}`);

      const definitions = service.getToolDefinitions();
      expect(definitions.some((d) => d.name === "customTool")).toBe(true);
    });
  });

  describe("executeTool", () => {
    it("should execute interview question tool", async () => {
      const result = await service.executeTool("interviewQuestionSearch", {
        keyword: "java",
      });

      expect(
        mockInterviewQuestionTool.searchInterviewQuestions,
      ).toHaveBeenCalledWith("java");
      expect(result).toBe("Question 1\nQuestion 2");
    });

    it("should execute web search tool", async () => {
      const result = await service.executeTool("web_search", {
        query: "test query",
      });

      expect(mockMcpClientService.executeTool).toHaveBeenCalledWith(
        "web_search",
        { query: "test query" },
      );
      expect(result).toBe("MCP result");
    });

    it("should throw error for unknown tool", async () => {
      await expect(service.executeTool("unknownTool", {})).rejects.toThrow(
        "Tool not found",
      );
    });
  });

  describe("chatWithTools", () => {
    it("should return response without tool calls for simple questions", async () => {
      mockChatModel.invoke.mockResolvedValueOnce({
        content: "Simple response",
        additional_kwargs: {},
      });

      const result = await service.chatWithTools(
        [new HumanMessage("你好")],
        "你是助手",
      );

      expect(result.content).toBe("Simple response");
      expect(result.toolCalls).toBeUndefined();
    });

    it("should use fallback when bind fails", async () => {
      mockChatModel.bind.mockImplementationOnce(() => {
        throw new Error("Bind not supported");
      });
      mockChatModel.invoke.mockResolvedValueOnce({
        content: "Fallback response",
      });

      const result = await service.chatWithTools(
        [new HumanMessage("你好")],
        "你是助手",
      );

      expect(result.content).toBe("Fallback response");
    });

    it("should detect interview keyword and call tool", async () => {
      mockChatModel.bind.mockImplementationOnce(() => {
        throw new Error("Bind not supported");
      });
      mockChatModel.invoke.mockResolvedValueOnce({
        content: "Interview response",
      });

      const result = await service.chatWithTools(
        [new HumanMessage("有哪些 Java 面试题？")],
        "你是助手",
      );

      expect(
        mockInterviewQuestionTool.searchInterviewQuestions,
      ).toHaveBeenCalled();
    });

    it("should detect search keyword and call MCP tool", async () => {
      mockChatModel.bind.mockImplementationOnce(() => {
        throw new Error("Bind not supported");
      });
      mockChatModel.invoke.mockResolvedValueOnce({
        content: "Search response",
      });

      const result = await service.chatWithTools(
        [new HumanMessage("搜索程序员鱼皮")],
        "你是助手",
      );

      expect(mockMcpClientService.executeTool).toHaveBeenCalledWith(
        "web_search",
        expect.any(Object),
      );
    });
  });
});
