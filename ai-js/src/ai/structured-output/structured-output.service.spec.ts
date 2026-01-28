import { describe, it, expect, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  StructuredOutputService,
  Report,
  ReportSchema,
} from "./structured-output.service";
import { ChatModelService } from "../model/chat-model.service";

const mockChatModel = {
  invoke: vi.fn(),
};

const mockChatModelService = {
  getChatModel: vi.fn().mockReturnValue(mockChatModel),
};

describe("StructuredOutputService", () => {
  let service: StructuredOutputService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuredOutputService,
        { provide: ChatModelService, useValue: mockChatModelService },
      ],
    }).compile();

    service = module.get<StructuredOutputService>(StructuredOutputService);
  });

  describe("chatForReport", () => {
    it("should parse valid JSON response", async () => {
      const mockResponse = {
        content: JSON.stringify({
          name: "程序员鱼皮的学习报告",
          suggestionList: ["学习 Java 基础", "练习算法", "做项目"],
        }),
      };
      mockChatModel.invoke.mockResolvedValueOnce(mockResponse);

      const result = await service.chatForReport(
        "请帮我制定学习计划",
        "你是学习助手",
      );

      expect(result.name).toBe("程序员鱼皮的学习报告");
      expect(result.suggestionList).toHaveLength(3);
      expect(result.suggestionList).toContain("学习 Java 基础");
    });

    it("should extract JSON from markdown code block", async () => {
      const mockResponse = {
        content: `好的，这是你的学习报告：
\`\`\`json
{
  "name": "学习报告",
  "suggestionList": ["建议1", "建议2"]
}
\`\`\``,
      };
      mockChatModel.invoke.mockResolvedValueOnce(mockResponse);

      const result = await service.chatForReport(
        "请帮我制定学习计划",
        "你是学习助手",
      );

      expect(result.name).toBe("学习报告");
      expect(result.suggestionList).toHaveLength(2);
    });

    it("should return default report on parse error", async () => {
      mockChatModel.invoke.mockResolvedValueOnce({
        content: "Invalid response",
      });

      const result = await service.chatForReport(
        "请帮我制定学习计划",
        "你是学习助手",
      );

      expect(result.name).toBe("学习报告");
      expect(result.suggestionList).toContain("解析失败，请重试");
    });

    it("should handle empty suggestionList", async () => {
      const mockResponse = {
        content: JSON.stringify({
          name: "报告",
          suggestionList: [],
        }),
      };
      mockChatModel.invoke.mockResolvedValueOnce(mockResponse);

      const result = await service.chatForReport(
        "请帮我制定学习计划",
        "你是学习助手",
      );

      expect(result.suggestionList).toEqual([]);
    });
  });

  describe("ReportSchema", () => {
    it("should validate correct report", () => {
      const report = {
        name: "Test Report",
        suggestionList: ["suggestion 1", "suggestion 2"],
      };

      const result = ReportSchema.parse(report);
      expect(result).toEqual(report);
    });

    it("should reject missing name", () => {
      const report = {
        suggestionList: ["suggestion 1"],
      };

      expect(() => ReportSchema.parse(report)).toThrow();
    });

    it("should reject missing suggestionList", () => {
      const report = {
        name: "Test",
      };

      expect(() => ReportSchema.parse(report)).toThrow();
    });

    it("should reject non-string items in suggestionList", () => {
      const report = {
        name: "Test",
        suggestionList: [1, 2, 3],
      };

      expect(() => ReportSchema.parse(report)).toThrow();
    });
  });
});
