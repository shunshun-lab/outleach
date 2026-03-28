# シーケンス機能実装サマリー

## 実装日: 2026-03-28

## 概要

「単発メッセージ」から「複数ステップのアプローチシナリオ（ケイデンス/シーケンス）」への拡張を実装。
既存の破壊的変更なし（additive のみ）。

## 導入した3つのコア機能

### 1. ケイデンス/シーケンス機能（「点」→「線」のアプローチ）

AIが複数回のアプローチシナリオを自動設計:
- 初回挨拶（即時） → フォロー（3日後） → クロージング（7日後）
- 各ステップにA/Bテスト用バリアント付き
- 人間はシーケンス全体を一括承認

**実装ファイル:**
- `src/lib/ai/generate-sequence.ts` — AI シーケンス生成
- `src/lib/orchestrator/sequence-manager.ts` — シーケンスのライフサイクル管理
- `src/lib/orchestrator/sequence-steps.ts` — パイプライン統合用ステップハンドラ

### 2. マルチチャネル・クロス配信

各ステップに独立したチャネルを設定可能:
- `step[0].channel = "mail"` → `step[1].channel = "line"` → `step[2].channel = "mail"`
- AIがContact情報から最適なチャネル配置を提案
- 承認時にチャネル変更可能

### 3. Auto-Pause（自動停止）と動的タグ付け

返信/コンバージョン検知で未送信ステップを自動キャンセル:
- `cancelActiveSequences(contactId)` で進行中シーケンスを即座に停止
- URLクリック等でContactにinterestタグを自動追加
- ActionLogに全アクションを記録

**実装ファイル:**
- `src/lib/orchestrator/auto-pause.ts` — Auto-Pause ロジック + SequenceStore
- `src/lib/orchestrator/sequence-scheduler.ts` — スケジューラ抽象化

## 変更ファイル一覧

### 新規作成

| ファイル | 内容 |
|---------|------|
| `docs/outreach-sequence-architecture.md` | 設計ドキュメント |
| `src/types/sequence.ts` | シーケンス型定義 |
| `src/lib/ai/generate-sequence.ts` | AIシーケンス生成 |
| `src/lib/orchestrator/sequence-manager.ts` | シーケンス管理 |
| `src/lib/orchestrator/sequence-scheduler.ts` | スケジューラ（InMemory） |
| `src/lib/orchestrator/sequence-steps.ts` | パイプライン統合 |
| `src/lib/orchestrator/auto-pause.ts` | Auto-Pause + SequenceStore |
| `src/app/api/sequence/create/route.ts` | シーケンス生成API |
| `src/app/api/sequence/approve/route.ts` | シーケンス承認API |
| `src/app/api/sequence/action/route.ts` | アクション検知API |

### 変更（既存ファイルへの追加のみ）

| ファイル | 変更内容 |
|---------|----------|
| `prisma/schema.prisma` | Sequence, SequenceStep, TrackingLink, ActionLog テーブル追加。Contact に tagsJson 追加。Campaign, Contact にリレーション追加 |
| `src/types/index.ts` | sequence.ts の re-export 追加 |
| `src/lib/ai/index.ts` | generateSequence の export 追加 |
| `src/lib/orchestrator/types.ts` | PipelineState に generatedSequences, useSequence 追加。PipelineInput に useSequence, sequenceStepCount オプション追加 |
| `src/lib/orchestrator/index.ts` | シーケンス関連モジュールの export 追加 |
| `src/lib/channels/idempotency.ts` | generateSequenceIdempotencyKey 追加 |
| `src/lib/channels/index.ts` | generateSequenceIdempotencyKey の export 追加 |

## データモデル追加

```
Sequence (1:N → SequenceStep, N:1 → Campaign, N:1 → Contact)
  - id, campaignId, contactId, status, approvedBy, approvedAt

SequenceStep (N:1 → Sequence, 1:N → TrackingLink)
  - id, sequenceId, stepOrder, delayHours, channel, body, angle, status, scheduledAt, sentAt, jobId

TrackingLink (N:1 → SequenceStep)
  - id, sequenceStepId, originalUrl, trackingToken, clickedAt, clickCount

ActionLog (N:1 → Contact, N:1 → Sequence?)
  - id, contactId, sequenceId?, type, payloadJson

Contact (追加フィールド)
  - tagsJson: 動的タグ（string[]）
```

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/sequence/create` | シーケンス生成（AI） |
| POST | `/api/sequence/approve` | シーケンス承認 + スケジューリング |
| POST | `/api/sequence/action` | アクション検知（Auto-Pause） |

## 設計方針

- **既存コード無破壊**: 既存の単発メッセージフローは完全に維持
- **インターフェース抽象化**: SequenceScheduler / SequenceStore はインターフェースで定義、InMemory実装を提供
- **BullMQ統合準備**: InMemorySequenceScheduler を BullMQ 実装に差し替えるだけで本番化可能
- **安全設計**: 承認なし送信禁止、Auto-Pause、冪等性キーを全ステップに適用

## 次のステップ

- [ ] Prisma マイグレーション実行（`prisma migrate dev`）
- [ ] BullMQ ベースの SequenceScheduler 実装
- [ ] Prisma ベースの SequenceStore 実装
- [ ] シーケンス Review UI（全ステップの一覧表示・編集・承認）
- [ ] TrackingLink のURL書き換えとクリック検知エンドポイント
- [ ] Webhook 統合（返信検知の実装）
- [ ] シーケンスのユニットテスト/E2Eテスト
