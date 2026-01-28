import { Injectable, Logger } from "@nestjs/common";
import { BaseMessage } from "@langchain/core/messages";

@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);
  private readonly memoryStore: Map<number, BaseMessage[]> = new Map();
  private readonly maxMessages = 10;

  /**
   * 获取会话历史
   */
  getHistory(memoryId: number): BaseMessage[] {
    return this.memoryStore.get(memoryId) || [];
  }

  /**
   * 添加消息到会话
   */
  addMessage(memoryId: number, message: BaseMessage): void {
    if (!this.memoryStore.has(memoryId)) {
      this.memoryStore.set(memoryId, []);
    }

    const history = this.memoryStore.get(memoryId)!;
    history.push(message);

    // Keep only the last maxMessages
    if (history.length > this.maxMessages) {
      history.splice(0, history.length - this.maxMessages);
    }

    this.logger.debug(`Memory ${memoryId}: ${history.length} messages`);
  }

  /**
   * 清除会话历史
   */
  clearHistory(memoryId: number): void {
    this.memoryStore.delete(memoryId);
    this.logger.log(`Memory ${memoryId} cleared`);
  }

  /**
   * 获取所有会话ID
   */
  getAllMemoryIds(): number[] {
    return Array.from(this.memoryStore.keys());
  }
}
