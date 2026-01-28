import { describe, it, expect, beforeEach } from "vitest";
import { ChatMemoryService } from "./chat-memory.service";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

describe("ChatMemoryService", () => {
  let service: ChatMemoryService;

  beforeEach(() => {
    service = new ChatMemoryService();
  });

  describe("getHistory", () => {
    it("should return empty array for new memory id", () => {
      const history = service.getHistory(999);
      expect(history).toEqual([]);
    });

    it("should return messages for existing memory id", () => {
      service.addMessage(1, new HumanMessage("Hello"));
      const history = service.getHistory(1);
      expect(history.length).toBe(1);
    });
  });

  describe("addMessage", () => {
    it("should add message to memory", () => {
      service.addMessage(1, new HumanMessage("Hello"));
      service.addMessage(1, new AIMessage("Hi there!"));

      const history = service.getHistory(1);
      expect(history.length).toBe(2);
    });

    it("should maintain separate histories for different memory ids", () => {
      service.addMessage(1, new HumanMessage("Hello 1"));
      service.addMessage(2, new HumanMessage("Hello 2"));

      const history1 = service.getHistory(1);
      const history2 = service.getHistory(2);

      expect(history1.length).toBe(1);
      expect(history2.length).toBe(1);
    });

    it("should limit messages to maxMessages", () => {
      // Add more than 10 messages
      for (let i = 0; i < 15; i++) {
        service.addMessage(1, new HumanMessage(`Message ${i}`));
      }

      const history = service.getHistory(1);
      expect(history.length).toBe(10);
    });
  });

  describe("clearHistory", () => {
    it("should clear history for memory id", () => {
      service.addMessage(1, new HumanMessage("Hello"));
      service.clearHistory(1);

      const history = service.getHistory(1);
      expect(history).toEqual([]);
    });

    it("should not affect other memory ids", () => {
      service.addMessage(1, new HumanMessage("Hello 1"));
      service.addMessage(2, new HumanMessage("Hello 2"));
      service.clearHistory(1);

      expect(service.getHistory(1)).toEqual([]);
      expect(service.getHistory(2).length).toBe(1);
    });
  });

  describe("getAllMemoryIds", () => {
    it("should return all memory ids", () => {
      service.addMessage(1, new HumanMessage("Hello"));
      service.addMessage(5, new HumanMessage("Hello"));
      service.addMessage(10, new HumanMessage("Hello"));

      const ids = service.getAllMemoryIds();
      expect(ids).toContain(1);
      expect(ids).toContain(5);
      expect(ids).toContain(10);
    });

    it("should return empty array when no memories", () => {
      const ids = service.getAllMemoryIds();
      expect(ids).toEqual([]);
    });
  });
});
