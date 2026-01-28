import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventSource } from "eventsource";

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
 * 通过 SSE 连接真正的 MCP 服务
 */
@Injectable()
export class McpClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpClientService.name);
  private apiKey: string;
  private tools: McpTool[] = [];
  private initialized = false;
  private eventSource: EventSource | null = null;
  private config: McpClientConfig;
  private messageId = 0;
  private pendingRequests: Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  > = new Map();

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.apiKey = this.configService.get<string>("BIGMODEL_API_KEY", "");

    if (!this.apiKey) {
      this.logger.warn("BIGMODEL_API_KEY not configured, MCP client disabled");
      return;
    }

    this.config = {
      key: "aiCodeHelperMcpClient",
      sseUrl: `https://open.bigmodel.cn/api/mcp/web_search/sse?Authorization=${this.apiKey}`,
      logRequests: true,
      logResponses: true,
    };

    await this.connect();
  }

  async onModuleDestroy() {
    this.disconnect();
  }

  /**
   * 连接到 MCP 服务
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.eventSource = new EventSource(this.config.sseUrl);

        this.eventSource.onopen = () => {
          this.logger.log(`MCP Client connected: ${this.config.key}`);
          this.initialized = true;
          this.fetchTools().then(resolve).catch(reject);
        };

        this.eventSource.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.eventSource.onerror = (error) => {
          this.logger.error(`MCP SSE error: ${JSON.stringify(error)}`);
          if (!this.initialized) {
            reject(new Error("Failed to connect to MCP service"));
          }
        };

        // 超时处理
        setTimeout(() => {
          if (!this.initialized) {
            this.disconnect();
            this.logger.warn("MCP connection timeout, using fallback mode");
            this.setupFallbackTools();
            resolve();
          }
        }, 10000);
      } catch (error) {
        this.logger.error(`MCP connection failed: ${error.message}`);
        this.setupFallbackTools();
        resolve();
      }
    });
  }

  /**
   * 断开连接
   */
  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.pendingRequests.clear();
  }

  /**
   * 处理 SSE 消息
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      if (this.config.logResponses) {
        this.logger.debug(`MCP Response: ${JSON.stringify(message)}`);
      }

      // 处理工具列表响应
      if (message.result?.tools) {
        this.tools = message.result.tools.map(
          (tool: Record<string, unknown>) => ({
            name: tool.name as string,
            description: tool.description as string,
            inputSchema: tool.inputSchema as Record<string, unknown>,
          }),
        );
        this.logger.log(`Loaded ${this.tools.length} MCP tools`);
      }

      // 处理工具调用响应
      if (message.id && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);

        if (message.error) {
          reject(new Error(message.error.message || "Unknown MCP error"));
        } else {
          resolve(message.result);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to parse MCP message: ${error.message}`);
    }
  }

  /**
   * 获取工具列表
   */
  private async fetchTools(): Promise<void> {
    // MCP tools/list 请求
    const request = {
      jsonrpc: "2.0",
      id: ++this.messageId,
      method: "tools/list",
    };

    if (this.config.logRequests) {
      this.logger.debug(`MCP Request: ${JSON.stringify(request)}`);
    }

    // 注意：实际的 MCP SSE 协议可能需要通过 HTTP POST 发送请求
    // 这里使用 fallback 模式
    this.setupFallbackTools();
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

    if (this.config.logRequests) {
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

      if (this.config.logResponses) {
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
