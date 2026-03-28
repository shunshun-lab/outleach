/**
 * パイプライン状態ストア
 *
 * PipelineRun の永続化を担当する。
 * 現時点ではインメモリ実装。Prisma/PostgreSQL への移行を前提とした
 * インターフェースで設計している。
 */
import type { PipelineRun, JobStatus, PipelineState } from "./types";

export interface PipelineStore {
  save(run: PipelineRun): Promise<void>;
  get(runId: string): Promise<PipelineRun | null>;
  list(campaignId?: string): Promise<PipelineRun[]>;
  updateStatus(runId: string, status: JobStatus, error?: string): Promise<void>;
  updateState(runId: string, patch: Partial<PipelineState>): Promise<void>;
}

/** インメモリ実装（プロトタイプ用） */
export class InMemoryPipelineStore implements PipelineStore {
  private runs = new Map<string, PipelineRun>();

  async save(run: PipelineRun): Promise<void> {
    this.runs.set(run.id, { ...run, updatedAt: new Date() });
  }

  async get(runId: string): Promise<PipelineRun | null> {
    return this.runs.get(runId) ?? null;
  }

  async list(campaignId?: string): Promise<PipelineRun[]> {
    const all = Array.from(this.runs.values());
    if (!campaignId) return all;
    return all.filter((r) => r.campaignId === campaignId);
  }

  async updateStatus(
    runId: string,
    status: JobStatus,
    error?: string
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`PipelineRun ${runId} not found`);
    run.status = status;
    run.updatedAt = new Date();
    if (error !== undefined) run.error = error;
  }

  async updateState(
    runId: string,
    patch: Partial<PipelineState>
  ): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`PipelineRun ${runId} not found`);
    run.state = { ...run.state, ...patch };
    run.updatedAt = new Date();
  }
}
