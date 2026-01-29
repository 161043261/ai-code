import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * MCP Tool 定义
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP 客户端配置
 */
export interface McpClientConfig {
  key: string;
  sseUrl: string;
  logRequests?: boolean;
  logResponses?: boolean;
}

/**
 * MCP (Model Context Protocol) 服务
 * 直接使用 BigModel API 实现 web search 功能
 */
@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private apiKey: string;
  private tools: McpTool[] = [];
  private initialized = false;
  private config: McpClientConfig;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.apiKey = this.configService.get<string>("BIGMODEL_API_KEY", "");

    if (!this.apiKey) {
      this.logger.warn("BIGMODEL_API_KEY not configured, MCP client disabled");
      this.setupFallbackTools();
      return;
    }

    this.config = {
      key: "aiCodeHelperMcpClient",
      sseUrl: `https://open.bigmodel.cn/api/mcp/web_search/sse?Authorization=${this.apiKey}`,
      logRequests: true,
      logResponses: true,
    };

    // 直接使用 fallback 模式，避免 SSE 连接问题
    this.setupFallbackTools();
    this.logger.log("MCP Client initialized with fallback mode");
  }

  async onModuleDestroy() {
    // 清理资源
    this.tools = [];
    this.initialized = false;
  }

  /**
   * 设置 fallback 工具
   */
  private setupFallbackTools(): void {
    this.tools = [
      {
        name: "web_search",
        description:
          "Search the web for real-time information using BigModel web search",
        inputSchema: {
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
    ];
    this.initialized = true;
    this.logger.log("MCP fallback tools configured");
  }

  /**
   * 获取可用工具
   */
  getTools(): McpTool[] {
    return this.tools;
  }

  /**
   * 执行工具
   */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<string> {
    const tool = this.tools.find((t) => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (this.config?.logRequests) {
      this.logger.log(
        `Executing MCP tool: ${toolName} with params: ${JSON.stringify(params)}`,
      );
    }

    // 使用 BigModel API 进行 web search
    if (toolName === "web_search") {
      return this.executeWebSearch(params.query as string);
    }

    throw new Error(`Tool execution not implemented: ${toolName}`);
  }

  /**
   * 执行网络搜索
   */
  private async executeWebSearch(query: string): Promise<string> {
    if (!query) {
      return "Search query is required";
    }

    if (!this.apiKey) {
      return "BIGMODEL_API_KEY not configured";
    }

    try {
      const response = await fetch(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
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

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      if (this.config?.logResponses) {
        this.logger.debug(`Web search response: ${JSON.stringify(data)}`);
      }

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
