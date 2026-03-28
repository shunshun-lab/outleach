/**
 * シーケンス・スケジューラ
 *
 * SequenceScheduler インターフェースのインメモリ実装。
 * BullMQ の遅延ジョブに相当する機能を抽象化。
 *
 * 本番ではBullMQ実装に差し替え可能。
 */
import { randomUUID } from "crypto";
import type { SequenceStep, SequenceScheduler } from "@/types";

type ScheduledJob = {
  jobId: string;
  stepId: string;
  contactId: string;
  sequenceId: string;
  executeAt: Date;
  status: "scheduled" | "executed" | "cancelled";
};

/**
 * インメモリ・スケジューラ（プロトタイプ用）
 *
 * BullMQ統合時は BullMQSequenceScheduler に差し替える。
 * - scheduleStep → Bull.Queue.add({ delay: ms })
 * - cancelStep → Bull.Queue.remove(jobId)
 * - cancelAllForContact → contactIdでフィルタしてbulk remove
 */
export class InMemorySequenceScheduler implements SequenceScheduler {
  private jobs = new Map<string, ScheduledJob>();
  private stepToJob = new Map<string, string>(); // stepId -> jobId

  async scheduleStep(step: SequenceStep, executeAt: Date): Promise<string> {
    const jobId = randomUUID();
    const job: ScheduledJob = {
      jobId,
      stepId: step.id,
      contactId: "", // will be set via context
      sequenceId: step.sequenceId,
      executeAt,
      status: "scheduled",
    };
    this.jobs.set(jobId, job);
    this.stepToJob.set(step.id, jobId);
    return jobId;
  }

  async cancelStep(stepId: string): Promise<void> {
    const jobId = this.stepToJob.get(stepId);
    if (!jobId) return;
    const job = this.jobs.get(jobId);
    if (job && job.status === "scheduled") {
      job.status = "cancelled";
    }
  }

  async cancelAllForContact(contactId: string): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.contactId === contactId && job.status === "scheduled") {
        job.status = "cancelled";
      }
    }
  }

  /** テスト/デバッグ用: スケジュール済みジョブの一覧 */
  getScheduledJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values()).filter(
      (j) => j.status === "scheduled"
    );
  }

  /** テスト用: 特定ジョブの状態を取得 */
  getJob(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }
}
