import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ChatModelListenerService,
  ChatModelListener,
  ChatModelRequestContext,
  ChatModelResponseContext,
  ChatModelErrorContext,
} from "./chat-model-listener.service";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

describe("ChatModelListenerService", () => {
  let service: ChatModelListenerService;

  beforeEach(() => {
    service = new ChatModelListenerService();
  });

  describe("addListener", () => {
    it("should add a listener", () => {
      const listener: ChatModelListener = {
        onRequest: vi.fn(),
        onResponse: vi.fn(),
        onError: vi.fn(),
      };

      service.addListener(listener);

      // Trigger an event
      service.onRequest({ messages: [], modelName: "test" });

      expect(listener.onRequest).toHaveBeenCalled();
    });
  });

  describe("removeListener", () => {
    it("should remove a listener", () => {
      const listener: ChatModelListener = {
        onRequest: vi.fn(),
      };

      service.addListener(listener);
      service.removeListener(listener);

      service.onRequest({ messages: [], modelName: "test" });

      // Should only be called once by default listener, not by removed listener
      expect(listener.onRequest).not.toHaveBeenCalled();
    });
  });

  describe("onRequest", () => {
    it("should return a request id", () => {
      const requestId = service.onRequest({
        messages: [new SystemMessage("test")],
        modelName: "qwen-max",
      });

      expect(requestId).toMatch(/^req_/);
    });

    it("should call all listeners", () => {
      const listener1: ChatModelListener = { onRequest: vi.fn() };
      const listener2: ChatModelListener = { onRequest: vi.fn() };

      service.addListener(listener1);
      service.addListener(listener2);

      service.onRequest({ messages: [], modelName: "test" });

      expect(listener1.onRequest).toHaveBeenCalled();
      expect(listener2.onRequest).toHaveBeenCalled();
    });

    it("should include timestamp in context", () => {
      let capturedContext: ChatModelRequestContext | null = null;
      const listener: ChatModelListener = {
        onRequest: (ctx) => {
          capturedContext = ctx;
        },
      };

      service.addListener(listener);
      service.onRequest({ messages: [], modelName: "test" });

      expect(capturedContext?.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("onResponse", () => {
    it("should calculate latency", async () => {
      let capturedContext: ChatModelResponseContext | null = null;
      const listener: ChatModelListener = {
        onResponse: (ctx) => {
          capturedContext = ctx;
        },
      };

      service.addListener(listener);

      const requestId = service.onRequest({ messages: [], modelName: "test" });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      service.onResponse(requestId, { content: "response", modelName: "test" });

      expect(capturedContext?.latencyMs).toBeGreaterThan(0);
    });

    it("should pass content to listeners", () => {
      let capturedContext: ChatModelResponseContext | null = null;
      const listener: ChatModelListener = {
        onResponse: (ctx) => {
          capturedContext = ctx;
        },
      };

      service.addListener(listener);

      const requestId = service.onRequest({ messages: [], modelName: "test" });
      service.onResponse(requestId, {
        content: "AI response",
        modelName: "test",
      });

      expect(capturedContext?.content).toBe("AI response");
    });
  });

  describe("onError", () => {
    it("should pass error to listeners", () => {
      let capturedContext: ChatModelErrorContext | null = null;
      const listener: ChatModelListener = {
        onError: (ctx) => {
          capturedContext = ctx;
        },
      };

      service.addListener(listener);

      const requestId = service.onRequest({ messages: [], modelName: "test" });
      const error = new Error("Test error");
      service.onError(requestId, { error, modelName: "test" });

      expect(capturedContext?.error).toBe(error);
    });
  });

  describe("error handling", () => {
    it("should continue with other listeners if one throws", () => {
      const throwingListener: ChatModelListener = {
        onRequest: () => {
          throw new Error("Listener error");
        },
      };
      const normalListener: ChatModelListener = {
        onRequest: vi.fn(),
      };

      service.addListener(throwingListener);
      service.addListener(normalListener);

      // Should not throw
      expect(() =>
        service.onRequest({ messages: [], modelName: "test" }),
      ).not.toThrow();

      // Other listener should still be called
      expect(normalListener.onRequest).toHaveBeenCalled();
    });
  });
});
