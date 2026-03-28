/**
 * ステートマシンのユニットテスト
 */
import { describe, it, expect } from "vitest";
import {
  getNextStep,
  canPauseAt,
  isTerminalStep,
  shouldAutoPause,
  isValidTransition,
  canResume,
  canCancel,
} from "@/lib/orchestrator/state-machine";

describe("StateMachine", () => {
  describe("getNextStep", () => {
    it("decompose → analyze", () => {
      expect(getNextStep("decompose")).toBe("analyze");
    });
    it("analyze → generate", () => {
      expect(getNextStep("analyze")).toBe("generate");
    });
    it("generate → review", () => {
      expect(getNextStep("generate")).toBe("review");
    });
    it("review → send", () => {
      expect(getNextStep("review")).toBe("send");
    });
    it("send → null (最終ステップ)", () => {
      expect(getNextStep("send")).toBeNull();
    });
  });

  describe("canPauseAt", () => {
    it("reviewステップでのみpause可能", () => {
      expect(canPauseAt("review")).toBe(true);
      expect(canPauseAt("decompose")).toBe(false);
      expect(canPauseAt("send")).toBe(false);
    });
  });

  describe("isTerminalStep", () => {
    it("sendのみterminal", () => {
      expect(isTerminalStep("send")).toBe(true);
      expect(isTerminalStep("review")).toBe(false);
    });
  });

  describe("shouldAutoPause", () => {
    it("reviewでauto-pauseする", () => {
      expect(shouldAutoPause("review")).toBe(true);
      expect(shouldAutoPause("generate")).toBe(false);
    });
  });

  describe("isValidTransition", () => {
    it("有効な遷移を許可", () => {
      expect(isValidTransition("decompose", "analyze")).toBe(true);
      expect(isValidTransition("review", "send")).toBe(true);
    });
    it("無効な遷移を拒否", () => {
      expect(isValidTransition("decompose", "send")).toBe(false);
      expect(isValidTransition("send", "decompose")).toBe(false);
    });
  });

  describe("canResume", () => {
    it("pausedのみ再開可能", () => {
      expect(canResume("paused")).toBe(true);
      expect(canResume("running")).toBe(false);
      expect(canResume("completed")).toBe(false);
    });
  });

  describe("canCancel", () => {
    it("pending/running/pausedのみキャンセル可能", () => {
      expect(canCancel("pending")).toBe(true);
      expect(canCancel("running")).toBe(true);
      expect(canCancel("paused")).toBe(true);
      expect(canCancel("completed")).toBe(false);
      expect(canCancel("failed")).toBe(false);
    });
  });
});
