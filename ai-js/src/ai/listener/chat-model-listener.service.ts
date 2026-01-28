import { Injectable, Logger } from "@nestjs/common";
import { BaseMessage } from "@langchain/core/messages";

/**
 * 请求上下文
 */
export interface ChatModelRequestContext {
  messages: BaseMessage[];
  modelName?: string;
  timestamp: Date;
}

/**
 * 响应上下文
 */
export interface ChatModelResponseContext {
  content: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  modelName?: string;
  timestamp: Date;
  latencyMs: number;
}

/**
 * 错误上下文
 */
export interface ChatModelErrorContext {
  error: Error;
  messages?: BaseMessage[];
  modelName?: string;
  timestamp: Date;
}

/**
 * ChatModel 监听器接口
 */
export interface ChatModelListener {
  onRequest?(context: ChatModelRequestContext): void;
  onResponse?(context: ChatModelResponseContext): void;
  onError?(context: ChatModelErrorContext): void;
}

/**
 * ChatModel 监听器服务
 * 提供请求/响应/错误的监听和日志记录功能
 */
@Injectable()
export class ChatModelListenerService {
  private readonly logger = new Logger(ChatModelListenerService.name);
  private listeners: ChatModelListener[] = [];
  private requestStartTime: Map<string, number> = new Map();

  constructor() {
    // 注册默认的日志监听器
    this.addListener(this.createDefaultListener());
  }

  /**
   * 添加监听器
   */
  addListener(listener: ChatModelListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   */
  removeListener(listener: ChatModelListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 触发请求事件
   */
  onRequest(context: Omit<ChatModelRequestContext, "timestamp">): string {
    const requestId = this.generateRequestId();
    this.requestStartTime.set(requestId, Date.now());

    const fullContext: ChatModelRequestContext = {
      ...context,
      timestamp: new Date(),
    };

    for (const listener of this.listeners) {
      try {
        listener.onRequest?.(fullContext);
      } catch (error) {
        this.logger.error(`Listener onRequest error: ${error.message}`);
      }
    }

    return requestId;
  }

  /**
   * 触发响应事件
   */
  onResponse(
    requestId: string,
    context: Omit<ChatModelResponseContext, "timestamp" | "latencyMs">,
  ): void {
    const startTime = this.requestStartTime.get(requestId);
    const latencyMs = startTime ? Date.now() - startTime : 0;
    this.requestStartTime.delete(requestId);

    const fullContext: ChatModelResponseContext = {
      ...context,
      timestamp: new Date(),
      latencyMs,
    };

    for (const listener of this.listeners) {
      try {
        listener.onResponse?.(fullContext);
      } catch (error) {
        this.logger.error(`Listener onResponse error: ${error.message}`);
      }
    }
  }

  /**
   * 触发错误事件
   */
  onError(
    requestId: string,
    context: Omit<ChatModelErrorContext, "timestamp">,
  ): void {
    this.requestStartTime.delete(requestId);

    const fullContext: ChatModelErrorContext = {
      ...context,
      timestamp: new Date(),
    };

    for (const listener of this.listeners) {
      try {
        listener.onError?.(fullContext);
      } catch (error) {
        this.logger.error(`Listener onError error: ${error.message}`);
      }
    }
  }

  /**
   * 创建默认日志监听器
   */
  private createDefaultListener(): ChatModelListener {
    return {
      onRequest: (context) => {
        const messagePreview = context.messages
          .slice(-2)
          .map((m) => `${m._getType()}: ${String(m.content).slice(0, 100)}...`)
          .join(" | ");
        this.logger.log(
          `[Request] ${context.modelName || "unknown"} - ${messagePreview}`,
        );
      },
      onResponse: (context) => {
        this.logger.log(
          `[Response] ${context.modelName || "unknown"} - ${context.latencyMs}ms - tokens: ${context.tokenUsage?.totalTokens || "N/A"} - ${context.content.slice(0, 100)}...`,
        );
      },
      onError: (context) => {
        this.logger.error(
          `[Error] ${context.modelName || "unknown"} - ${context.error.message}`,
        );
      },
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
