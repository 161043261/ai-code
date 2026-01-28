import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { McpClientService } from "./mcp-client.service";

// Mock fetch
global.fetch = vi.fn();

describe("McpClientService", () => {
  let service: McpClientService;
  let mockConfigService: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          BIGMODEL_API_KEY: "test-api-key",
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpClientService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<McpClientService>(McpClientService);
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  describe("initialization", () => {
    it("should initialize with API key", async () => {
      await service.onModuleInit();
      expect(service.isInitialized()).toBe(true);
    });

    it("should skip initialization without API key", async () => {
      // Create a new service without API key
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: string) => {
          if (key === "BIGMODEL_API_KEY") return "";
          return defaultValue;
        },
      );

      const module = await Test.createTestingModule({
        providers: [
          McpClientService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const noKeyService = module.get<McpClientService>(McpClientService);
      await noKeyService.onModuleInit();

      expect(noKeyService.isInitialized()).toBe(false);
    });
  });

  describe("getTools", () => {
    it("should return available tools after initialization", async () => {
      await service.onModuleInit();
      const tools = service.getTools();

      expect(tools.length).toBeGreaterThan(0);
      expect(tools.some((t) => t.name === "web_search")).toBe(true);
    });
  });

  describe("executeTool", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("should execute web_search tool", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              { message: { content: "Search results for test query" } },
            ],
          }),
      });

      const result = await service.executeTool("web_search", {
        query: "test query",
      });

      expect(result).toBe("Search results for test query");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        }),
      );
    });

    it("should throw error for unknown tool", async () => {
      await expect(service.executeTool("unknownTool", {})).rejects.toThrow(
        "Tool not found",
      );
    });

    it("should handle API errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await service.executeTool("web_search", { query: "test" });

      expect(result).toContain("Search failed");
    });

    it("should handle empty query", async () => {
      const result = await service.executeTool("web_search", { query: "" });

      expect(result).toBe("Search query is required");
    });

    it("should handle missing results", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ choices: [] }),
      });

      const result = await service.executeTool("web_search", { query: "test" });

      expect(result).toBe("No results found");
    });
  });
});
