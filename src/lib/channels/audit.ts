/**
 * 監査ログ
 *
 * 承認・チャネル選択・送信結果などの操作を記録する。
 * 現時点ではインメモリ保持。Prisma 移行時に AuditLog テーブルに書く。
 *
 * 個人情報（email, lineUserId 等）はログに含めない。
 */
import { randomUUID } from "crypto";
import type { AuditAction, AuditLogEntry, ChannelType } from "@/types/channel";

const auditLogs: AuditLogEntry[] = [];

export function writeAuditLog(params: {
  action: AuditAction;
  campaignId: string;
  targetId?: string;
  contactId?: string;
  channel?: ChannelType;
  performedBy: string;
  details?: Record<string, unknown>;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: randomUUID(),
    ...params,
    createdAt: new Date(),
  };
  auditLogs.push(entry);
  return entry;
}

export function getAuditLogs(campaignId: string): AuditLogEntry[] {
  return auditLogs.filter((log) => log.campaignId === campaignId);
}

export function getAuditLogsByAction(
  campaignId: string,
  action: AuditAction
): AuditLogEntry[] {
  return auditLogs.filter(
    (log) => log.campaignId === campaignId && log.action === action
  );
}
