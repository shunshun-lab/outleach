/**
 * パイプライン・ステートマシン
 *
 * 各ステップ間の遷移ルールを定義し、
 * 不正な遷移を防止する。
 */
import type { PipelineStep, JobStatus } from "./types";
import { PIPELINE_STEPS } from "./types";

/** 許可される状態遷移マップ */
const TRANSITIONS: Record<PipelineStep, {
  next: PipelineStep | null;
  canPause: boolean;
}> = {
  decompose: { next: "analyze", canPause: false },
  analyze:   { next: "generate", canPause: false },
  generate:  { next: "review", canPause: false },
  review:    { next: "send", canPause: true },   // 人間の承認で一時停止
  send:      { next: null, canPause: false },     // 最終ステップ
};

export function getNextStep(current: PipelineStep): PipelineStep | null {
  return TRANSITIONS[current].next;
}

export function canPauseAt(step: PipelineStep): boolean {
  return TRANSITIONS[step].canPause;
}

export function isTerminalStep(step: PipelineStep): boolean {
  return TRANSITIONS[step].next === null;
}

export function getStepIndex(step: PipelineStep): number {
  return PIPELINE_STEPS.indexOf(step);
}

/** review ステップに到達したら自動的に paused にする */
export function shouldAutoPause(step: PipelineStep): boolean {
  return step === "review";
}

/** 指定ステップが有効な遷移先かどうかを検証 */
export function isValidTransition(
  from: PipelineStep,
  to: PipelineStep
): boolean {
  return TRANSITIONS[from].next === to;
}

/** パイプラインのステータスが再開可能か */
export function canResume(status: JobStatus): boolean {
  return status === "paused";
}

/** パイプラインのステータスがキャンセル可能か */
export function canCancel(status: JobStatus): boolean {
  return status === "pending" || status === "running" || status === "paused";
}
