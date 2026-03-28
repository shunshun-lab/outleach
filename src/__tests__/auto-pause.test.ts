/**
 * Auto-Pause（自動停止）ロジックのユニットテスト
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  handleAction,
  cancelActiveSequences,
  InMemorySequenceStore,
} from "@/lib/orchestrator/auto-pause";
import { InMemorySequenceScheduler } from "@/lib/orchestrator/sequence-scheduler";
import type { Sequence } from "@/types/sequence";

function makeSequence(
  overrides: Partial<Sequence> = {}
): Sequence {
  return {
    id: "seq-1",
    campaignId: "camp-1",
    contactId: "contact-1",
    status: "active",
    steps: [
      {
        id: "step-1",
        sequenceId: "seq-1",
        stepOrder: 1,
        delayHours: 0,
        channel: "mail",
        body: "ステップ1",
        angle: "初回",
        status: "sent",
      },
      {
        id: "step-2",
        sequenceId: "seq-1",
        stepOrder: 2,
        delayHours: 24,
        channel: "line",
        body: "ステップ2",
        angle: "フォロー",
        status: "pending",
      },
      {
        id: "step-3",
        sequenceId: "seq-1",
        stepOrder: 3,
        delayHours: 72,
        channel: "mail",
        body: "ステップ3",
        angle: "最終",
        status: "scheduled",
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("Auto-Pause", () => {
  let store: InMemorySequenceStore;
  let scheduler: InMemorySequenceScheduler;

  beforeEach(() => {
    store = new InMemorySequenceStore();
    scheduler = new InMemorySequenceScheduler();
  });

  describe("handleAction — reply", () => {
    it("返信でactiveシーケンスをキャンセルしrespondedに変更", async () => {
      store.addSequence(makeSequence());

      const result = await handleAction(
        { contactId: "contact-1", type: "reply" },
        store,
        scheduler
      );

      expect(result.cancelledSequences).toContain("seq-1");
      const seq = store.getSequence("seq-1");
      expect(seq?.status).toBe("responded");
    });

    it("未送信ステップがcancelledに変わる", async () => {
      store.addSequence(makeSequence());
      await handleAction(
        { contactId: "contact-1", type: "reply" },
        store,
        scheduler
      );

      const seq = store.getSequence("seq-1");
      expect(seq?.steps[0].status).toBe("sent"); // 送信済みは変わらない
      expect(seq?.steps[1].status).toBe("cancelled");
      expect(seq?.steps[2].status).toBe("cancelled");
    });
  });

  describe("handleAction — conversion", () => {
    it("コンバージョンでもAuto-Pauseが発動", async () => {
      store.addSequence(makeSequence());

      const result = await handleAction(
        {
          contactId: "contact-1",
          type: "conversion",
          payload: { conversionType: "registration" },
        },
        store,
        scheduler
      );

      expect(result.cancelledSequences).toContain("seq-1");
      expect(result.addedTags).toContain("converted:registration");
    });
  });

  describe("handleAction — link_click", () => {
    it("リンククリックではAuto-Pauseしない", async () => {
      store.addSequence(makeSequence());

      const result = await handleAction(
        {
          contactId: "contact-1",
          type: "link_click",
          payload: { url: "https://example.com/event", tags: ["event-interest"] },
        },
        store,
        scheduler
      );

      expect(result.cancelledSequences).toHaveLength(0);
      expect(result.addedTags).toContain("event-interest");
      const tags = store.getContactTags("contact-1");
      expect(tags).toContain("event-interest");
    });
  });

  describe("handleAction — ActionLog記録", () => {
    it("アクションがActionLogに記録される", async () => {
      await handleAction(
        { contactId: "contact-1", type: "reply" },
        store,
        scheduler
      );

      const logs = store.getActionLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].type).toBe("reply");
      expect(logs[0].contactId).toBe("contact-1");
    });
  });

  describe("cancelActiveSequences", () => {
    it("activeでないシーケンスはスキップ", async () => {
      store.addSequence(makeSequence({ status: "completed" }));
      const cancelled = await cancelActiveSequences(
        "contact-1",
        store,
        scheduler
      );
      expect(cancelled).toHaveLength(0);
    });
  });
});
