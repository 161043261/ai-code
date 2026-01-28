import { describe, it, expect, vi, beforeEach } from "vitest";
import { SafeInputGuardrail } from "./safe-input.guardrail";

describe("SafeInputGuardrail", () => {
  let guardrail: SafeInputGuardrail;

  beforeEach(() => {
    guardrail = new SafeInputGuardrail();
  });

  describe("validate", () => {
    it("should return safe for normal input", () => {
      const result = guardrail.validate("如何学习编程？");
      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should detect sensitive word "kill"', () => {
      const result = guardrail.validate("kill the process");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("kill");
    });

    it('should detect sensitive word "evil"', () => {
      const result = guardrail.validate("this is an evil plan");
      expect(result.safe).toBe(false);
      expect(result.reason).toContain("evil");
    });

    it("should be case insensitive", () => {
      const result = guardrail.validate("KILL THE GAME");
      expect(result.safe).toBe(false);
    });

    it("should not detect partial matches", () => {
      const result = guardrail.validate("skilled developer");
      expect(result.safe).toBe(true);
    });

    it("should handle empty input", () => {
      const result = guardrail.validate("");
      expect(result.safe).toBe(true);
    });

    it("should handle Chinese input", () => {
      const result = guardrail.validate("学习 Java 编程");
      expect(result.safe).toBe(true);
    });
  });

  describe("addSensitiveWord", () => {
    it("should add new sensitive word", () => {
      guardrail.addSensitiveWord("danger");
      const result = guardrail.validate("this is danger");
      expect(result.safe).toBe(false);
    });

    it("should add word in lowercase", () => {
      guardrail.addSensitiveWord("DANGER");
      const result = guardrail.validate("this is danger");
      expect(result.safe).toBe(false);
    });
  });

  describe("removeSensitiveWord", () => {
    it("should remove sensitive word", () => {
      guardrail.removeSensitiveWord("kill");
      const result = guardrail.validate("kill the process");
      expect(result.safe).toBe(true);
    });
  });

  describe("getSensitiveWords", () => {
    it("should return all sensitive words", () => {
      const words = guardrail.getSensitiveWords();
      expect(words).toContain("kill");
      expect(words).toContain("evil");
    });
  });
});
