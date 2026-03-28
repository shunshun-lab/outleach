/**
 * パイプライン・オーケストレータ
 *
 * 各ステップを順番に実行し、状態をストアに永続化する。
 * review ステップで自動的に一時停止し、人間の承認後に再開する。
 *
 * 使い方:
 *   const orch = new PipelineOrchestrator(store);
 *   const runId = await orch.start(campaignId, input);
 *   // ... review ステップで paused になる ...
 *   await orch.approve(runId, ["contact-1", "contact-2"]);
 *   // ... send ステップが実行される ...
 */
import { randomUUID } from "crypto";
import type {
  PipelineRun,
  PipelineInput,
  PipelineStep,
  PipelineEvent,
  PipelineEventHandler,
} from "./types";
import { PIPELINE_STEPS } from "./types";
import {
  getNextStep,
  shouldAutoPause,
  canResume,
  canCancel,
  getStepIndex,
} from "./state-machine";
import { stepHandlers } from "./steps";
import type { PipelineStore } from "./store";

export class PipelineOrchestrator {
  private store: PipelineStore;
  private listeners: PipelineEventHandler[] = [];

  constructor(store: PipelineStore) {
    this.store = store;
  }

  /** イベントリスナー登録 */
  on(handler: PipelineEventHandler): () => void {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  private emit(event: PipelineEvent): void {
    for (const handler of this.listeners) {
      handler(event);
    }
  }

  /** パイプラインを新規開始する */
  async start(campaignId: string, input: PipelineInput): Promise<string> {
    const run: PipelineRun = {
      id: randomUUID(),
      campaignId,
      currentStep: "decompose",
      status: "pending",
      input,
      state: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.store.save(run);
    await this.executeFrom(run.id, "decompose");
    return run.id;
  }

  /** 一時停止中のパイプラインを承認して再開する */
  async approve(runId: string, approvedTargetIds: string[]): Promise<void> {
    const run = await this.getRunOrThrow(runId);

    if (!canResume(run.status)) {
      throw new Error(
        `パイプライン ${runId} は現在 ${run.status} のため再開できません`
      );
    }

    if (run.currentStep !== "review") {
      throw new Error(
        `承認は review ステップでのみ可能です（現在: ${run.currentStep}）`
      );
    }

    await this.store.updateState(runId, { approvedTargetIds });
    this.emit({ type: "pipeline:resumed", runId, step: "review" });

    const nextStep = getNextStep("review");
    if (nextStep) {
      await this.executeFrom(runId, nextStep);
    }
  }

  /** パイプラインをキャンセルする */
  async cancel(runId: string): Promise<void> {
    const run = await this.getRunOrThrow(runId);

    if (!canCancel(run.status)) {
      throw new Error(
        `パイプライン ${runId} は現在 ${run.status} のためキャンセルできません`
      );
    }

    await this.store.updateStatus(runId, "cancelled");
    this.emit({ type: "pipeline:cancelled", runId });
  }

  /** パイプラインの現在状態を取得する */
  async getStatus(runId: string): Promise<PipelineRun> {
    return this.getRunOrThrow(runId);
  }

  /** 指定ステップから順番に実行する（内部メソッド） */
  private async executeFrom(
    runId: string,
    fromStep: PipelineStep
  ): Promise<void> {
    const startIndex = getStepIndex(fromStep);

    for (let i = startIndex; i < PIPELINE_STEPS.length; i++) {
      const step = PIPELINE_STEPS[i];
      const run = await this.getRunOrThrow(runId);

      // ステップ更新
      run.currentStep = step;
      run.status = "running";
      await this.store.save(run);
      this.emit({ type: "step:start", runId, step });

      // ステップ実行
      const handler = stepHandlers[step];
      try {
        const result = await handler(run);

        // 状態を永続化
        await this.store.updateState(runId, result.stateUpdate);

        if (result.status === "paused") {
          await this.store.updateStatus(runId, "paused");
          this.emit({
            type: "pipeline:paused",
            runId,
            step,
            reason: "人間の承認待ち",
          });
          return; // ループを抜ける。approve() で再開される。
        }

        if (result.status === "failed") {
          await this.store.updateStatus(runId, "failed", result.error);
          this.emit({
            type: "step:failed",
            runId,
            step,
            error: result.error ?? "unknown error",
          });
          return;
        }

        // completed
        this.emit({ type: "step:complete", runId, step });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        await this.store.updateStatus(runId, "failed", errorMsg);
        this.emit({ type: "step:failed", runId, step, error: errorMsg });
        return;
      }
    }

    // 全ステップ完了
    await this.store.updateStatus(runId, "completed");
    this.emit({ type: "pipeline:completed", runId });
  }

  private async getRunOrThrow(runId: string): Promise<PipelineRun> {
    const run = await this.store.get(runId);
    if (!run) {
      throw new Error(`PipelineRun ${runId} が見つかりません`);
    }
    return run;
  }
}
