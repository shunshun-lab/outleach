"use client";

import { useState } from "react";
import type { ChannelType, ChannelResolution } from "@/types/channel";

export type ReviewTarget = {
  contactId: string;
  contactName: string;
  contactPlatform?: string;
  relevanceScore: number;
  matchedAngle: string;
  matchReason: string;
  messageVariants: Array<{
    body: string;
    angle: string;
    qualityScore?: number;
    passedWordCheck: boolean;
  }>;
  channelResolution?: ChannelResolution;
  selectedChannel?: ChannelType;
};

type ReviewPanelProps = {
  runId: string;
  campaignId: string;
  targets: ReviewTarget[];
  status: string;
  onApprove?: () => void;
};

const CHANNEL_LABELS: Record<ChannelType, string> = {
  mail: "Mail",
  line: "LINE",
  messenger: "Messenger",
};

export function ReviewPanel({
  runId,
  campaignId,
  targets,
  status,
  onApprove,
}: ReviewPanelProps) {
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(
    new Set(targets.map((t) => t.contactId))
  );
  const [channelSelections, setChannelSelections] = useState<
    Record<string, ChannelType>
  >(() => {
    const initial: Record<string, ChannelType> = {};
    for (const target of targets) {
      initial[target.contactId] =
        target.selectedChannel ??
        target.channelResolution?.recommendedChannel ??
        "mail";
    }
    return initial;
  });
  const [editedMessages, setEditedMessages] = useState<
    Record<string, Record<number, string>>
  >({});
  const [approvedBy, setApprovedBy] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const isPaused = status === "paused";

  const toggleTarget = (contactId: string) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const selectAll = () =>
    setSelectedTargets(new Set(targets.map((t) => t.contactId)));
  const deselectAll = () => setSelectedTargets(new Set());

  const handleMessageEdit = (
    contactId: string,
    variantIndex: number,
    newBody: string
  ) => {
    setEditedMessages((prev) => ({
      ...prev,
      [contactId]: { ...prev[contactId], [variantIndex]: newBody },
    }));
  };

  const getMessageBody = (contactId: string, variantIndex: number, original: string) => {
    return editedMessages[contactId]?.[variantIndex] ?? original;
  };

  const handleChannelChange = (contactId: string, channel: ChannelType) => {
    setChannelSelections((prev) => ({ ...prev, [contactId]: channel }));
  };

  const handleApprove = async () => {
    if (!approvedBy.trim()) {
      alert("承認者IDを入力してください");
      return;
    }
    if (selectedTargets.size === 0) {
      alert("少なくとも1件のターゲットを選択してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const approvedTargetIds = Array.from(selectedTargets);
      const approvedChannels: Record<string, ChannelType> = {};
      for (const id of approvedTargetIds) {
        approvedChannels[id] = channelSelections[id] ?? "mail";
      }

      // Build edited messages map: { contactId: { variantIndex: editedBody } }
      const editedMessagesPayload: Record<string, Record<number, string>> = {};
      for (const id of approvedTargetIds) {
        if (editedMessages[id]) {
          editedMessagesPayload[id] = editedMessages[id];
        }
      }

      const res = await fetch("/api/orchestrator/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId,
          approvedTargetIds,
          approvedChannels,
          editedMessages: Object.keys(editedMessagesPayload).length > 0
            ? editedMessagesPayload
            : undefined,
          approvedBy: approvedBy.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(`承認完了: ${data.approvedCount}件を送信キューに投入`);
        onApprove?.();
      } else {
        setResult(`エラー: ${data.error}`);
      }
    } catch (err) {
      setResult(`エラー: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          レビュー・承認パネル
        </h2>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isPaused
              ? "bg-yellow-100 text-yellow-800"
              : status === "completed"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="text-sm text-gray-500">
        Campaign: {campaignId} | Run: {runId}
      </div>

      {/* 一括操作 */}
      {isPaused && (
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            全選択
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            全解除
          </button>
          <span className="text-sm text-gray-500 self-center ml-2">
            {selectedTargets.size}/{targets.length} 件選択中
          </span>
        </div>
      )}

      {/* ターゲット一覧 */}
      <div className="space-y-4">
        {targets.map((target) => {
          const resolution = target.channelResolution;
          const selectedChannel = channelSelections[target.contactId] ?? "mail";
          const isSelected = selectedTargets.has(target.contactId);

          return (
            <div
              key={target.contactId}
              className={`border rounded-lg p-4 ${
                isSelected ? "border-blue-300 bg-blue-50/30" : "border-gray-200"
              }`}
            >
              {/* ヘッダー */}
              <div className="flex items-start gap-3">
                {isPaused && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleTarget(target.contactId)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{target.contactName}</span>
                    {target.contactPlatform && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                        {target.contactPlatform}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      スコア: {target.relevanceScore}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    切り口: {target.matchedAngle}
                  </div>
                </div>
              </div>

              {/* メッセージバリアント（編集可能） */}
              <div className="mt-3 space-y-2">
                {target.messageVariants.map((variant, i) => {
                  const currentBody = getMessageBody(target.contactId, i, variant.body);
                  const isEdited = editedMessages[target.contactId]?.[i] !== undefined
                    && editedMessages[target.contactId][i] !== variant.body;

                  return (
                    <div
                      key={i}
                      className={`bg-white border rounded p-3 text-sm ${
                        isEdited ? "border-amber-300" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-400">
                          案{i + 1}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({variant.angle})
                        </span>
                        {variant.qualityScore !== undefined && (
                          <span className="text-xs text-gray-400">
                            品質: {variant.qualityScore}
                          </span>
                        )}
                        {!variant.passedWordCheck && (
                          <span className="text-xs text-red-500 font-medium">
                            禁止ワード検出
                          </span>
                        )}
                        {isEdited && (
                          <span className="text-xs text-amber-600 font-medium">
                            編集済み
                          </span>
                        )}
                      </div>
                      {isPaused ? (
                        <textarea
                          value={currentBody}
                          onChange={(e) =>
                            handleMessageEdit(target.contactId, i, e.target.value)
                          }
                          rows={3}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
                        />
                      ) : (
                        <p>{currentBody}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* チャネル選択 */}
              {resolution && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    送信チャネル:
                  </span>
                  <div className="flex gap-2">
                    {resolution.availableChannels.map((ch) => {
                      const isActive = selectedChannel === ch.channel;
                      const isDisabled = !ch.available;

                      return (
                        <button
                          key={ch.channel}
                          disabled={isDisabled || !isPaused}
                          onClick={() =>
                            handleChannelChange(
                              target.contactId,
                              ch.channel
                            )
                          }
                          className={`px-3 py-1 text-sm rounded-md border transition-colors ${
                            isActive
                              ? "bg-blue-500 text-white border-blue-500"
                              : isDisabled
                                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                          title={ch.reason ?? ""}
                        >
                          {CHANNEL_LABELS[ch.channel]}
                          {isDisabled && ch.reason && (
                            <span className="ml-1 text-xs">(?)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {resolution.recommendedChannel !== "mail" && (
                    <span className="text-xs text-gray-400">
                      推奨: {CHANNEL_LABELS[resolution.recommendedChannel]}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 承認フォーム */}
      {isPaused && (
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">
              承認者ID:
            </label>
            <input
              type="text"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              placeholder="your-name"
              className="border rounded px-3 py-1.5 text-sm w-48"
            />
          </div>
          <button
            onClick={handleApprove}
            disabled={
              isSubmitting || selectedTargets.size === 0 || !approvedBy.trim()
            }
            className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? "送信中..."
              : `${selectedTargets.size}件を承認・送信`}
          </button>
          {result && (
            <p
              className={`text-sm ${
                result.startsWith("エラー")
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {result}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
