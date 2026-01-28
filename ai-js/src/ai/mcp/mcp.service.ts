import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface McpTool {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

/**
 * MCP (Model Context Protocol) Service
 * Provides web search capability through BigModel API
 */
@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private apiKey: string;
  private tools: McpTool[] = [];
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.configService.get<string>("BIGMODEL_API_KEY", "");

    if (!this.apiKey) {
      this.logger.warn("BIGMODEL_API_KEY not configured, MCP tools disabled");
      return;
    }

    // Register web search tool
    this.tools.push({
      name: "web_search",
      description: "Search the web for real-time information",
      execute: this.webSearch.bind(this),
    });

    this.initialized = true;
    this.logger.log("MCP Service initialized with web search tool");
  }

  /**
   * Get available tools
   */
  getTools(): McpTool[] {
    return this.tools;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<string | null> {
    const tool = this.tools.find((t) => t.name === toolName);
    if (!tool) {
      this.logger.warn(`Tool not found: ${toolName}`);
      return null;
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      this.logger.error(`Tool execution failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Web search using BigModel MCP
   */
  private async webSearch(params: Record<string, unknown>): Promise<string> {
    const query = params.query as string;
    if (!query) {
      return "Search query is required";
    }

    const sseUrl = `https://open.bigmodel.cn/api/mcp/web_search/sse?Authorization=${this.apiKey}`;

    try {
      // Note: In a real implementation, you would use SSE client to connect to BigModel MCP
      // For now, we'll provide a placeholder implementation
      this.logger.log(`Web search for: ${query}`);

      // This is a simplified implementation
      // In production, use proper SSE/MCP client
      const response = await fetch(
        `https://open.bigmodel.cn/api/paas/v4/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "glm-4",
            messages: [
              {
                role: "user",
                content: `搜索并总结以下内容: ${query}`,
              },
            ],
            tools: [
              {
                type: "web_search",
                web_search: {
                  enable: true,
                },
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No results found";
    } catch (error) {
      this.logger.error(`Web search failed: ${error.message}`);
      return `Search failed: ${error.message}`;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
