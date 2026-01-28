import { describe, it, expect, vi, beforeEach } from "vitest";
import { InterviewQuestionTool } from "./interview-question.tool";

// Mock fetch
global.fetch = vi.fn();

describe("InterviewQuestionTool", () => {
  let tool: InterviewQuestionTool;

  beforeEach(() => {
    tool = new InterviewQuestionTool();
    vi.clearAllMocks();
  });

  describe("searchInterviewQuestions", () => {
    it("should return questions on successful search", async () => {
      const mockHtml = `
        <html>
          <body>
            <table>
              <tr><td class="ant-table-cell"><a href="#">Java 基础面试题</a></td></tr>
              <tr><td class="ant-table-cell"><a href="#">Spring Boot 面试题</a></td></tr>
            </table>
          </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const result = await tool.searchInterviewQuestions("java");

      expect(result).toContain("Java 基础面试题");
      expect(result).toContain("Spring Boot 面试题");
    });

    it("should handle empty results", async () => {
      const mockHtml = `<html><body><table></table></body></html>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      });

      const result = await tool.searchInterviewQuestions("nonexistent");

      expect(result).toBe("No questions found");
    });

    it("should handle HTTP errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await tool.searchInterviewQuestions("java");

      expect(result).toContain("Search failed");
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const result = await tool.searchInterviewQuestions("java");

      expect(result).toContain("Search failed");
    });

    it("should encode Chinese keywords", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve("<html></html>"),
      });

      await tool.searchInterviewQuestions("多线程");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent("多线程")),
        expect.any(Object),
      );
    });

    it("should timeout after 5 seconds", async () => {
      // Create a promise that never resolves
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Aborted")), 100);
          }),
      );

      const result = await tool.searchInterviewQuestions("java");

      expect(result).toContain("Search failed");
    });
  });

  describe("getToolDefinition", () => {
    it("should return correct tool definition", () => {
      const definition = tool.getToolDefinition();

      expect(definition.name).toBe("interviewQuestionSearch");
      expect(definition.description).toBeDefined();
      expect(definition.parameters.properties.keyword).toBeDefined();
      expect(definition.parameters.required).toContain("keyword");
    });
  });
});
