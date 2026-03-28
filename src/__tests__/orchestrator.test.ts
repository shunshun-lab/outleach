/**
 * オーケストレータ（PipelineOrchestrator + InMemoryPipelineStore）のユニットテスト
 */
import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryPipelineStore } from "@/lib/orchestrator/store";
import type { PipelineRun } from "@/lib/orchestrator/types";

describe("InMemoryPipelineStore", () => {
  let store: InMemoryPipelineStore;

  const makeRun = (overrides: Partial<PipelineRun> = {}): PipelineRun => ({
    id: "run-1",
    campaignId: "camp-1",
    currentStep: "decompose",
    status: "pending",
    input: {
      product: {
        name: "テスト商材",
        description: "テスト説明",
        targetAudience: "テスト対象",
      },
      contacts: [],
    },
    state: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    store = new InMemoryPipelineStore();
  });

  it("save/get でラウンドトリップ", async () => {
    const run = makeRun();
    await store.save(run);
    const retrieved = await store.get("run-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe("run-1");
  });

  it("存在しないIDはnullを返す", async () => {
    const result = await store.get("nonexistent");
    expect(result).toBeNull();
  });

  it("listで全件取得", async () => {
    await store.save(makeRun({ id: "r1", campaignId: "c1" }));
    await store.save(makeRun({ id: "r2", campaignId: "c2" }));
    const all = await store.list();
    expect(all).toHaveLength(2);
  });

  it("listでcampaignIdフィルタ", async () => {
    await store.save(makeRun({ id: "r1", campaignId: "c1" }));
    await store.save(makeRun({ id: "r2", campaignId: "c2" }));
    const filtered = await store.list("c1");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].campaignId).toBe("c1");
  });

  it("updateStatusでステータス更新", async () => {
    await store.save(makeRun());
    await store.updateStatus("run-1", "running");
    const run = await store.get("run-1");
    expect(run!.status).toBe("running");
  });

  it("updateStatusでエラー付き更新", async () => {
    await store.save(makeRun());
    await store.updateStatus("run-1", "failed", "テストエラー");
    const run = await store.get("run-1");
    expect(run!.status).toBe("failed");
    expect(run!.error).toBe("テストエラー");
  });

  it("存在しないIDのupdateStatusはエラー", async () => {
    await expect(
      store.updateStatus("nonexistent", "running")
    ).rejects.toThrow();
  });

  it("updateStateで部分更新", async () => {
    await store.save(makeRun());
    await store.updateState("run-1", {
      approvedTargetIds: ["t1"],
      approvedBy: "admin",
    });
    const run = await store.get("run-1");
    expect(run!.state.approvedTargetIds).toEqual(["t1"]);
    expect(run!.state.approvedBy).toBe("admin");
  });

  it("updateStateで既存stateにマージ", async () => {
    await store.save(makeRun());
    await store.updateState("run-1", { approvedBy: "admin" });
    await store.updateState("run-1", { approvedTargetIds: ["t1"] });
    const run = await store.get("run-1");
    expect(run!.state.approvedBy).toBe("admin");
    expect(run!.state.approvedTargetIds).toEqual(["t1"]);
  });
});
