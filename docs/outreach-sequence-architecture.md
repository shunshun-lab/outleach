# Sequence Architecture — シーケンス配信とAuto-Pause設計

## 概要

従来の「単発メッセージ → 承認 → 送信」パイプラインを拡張し、
**複数ステップのアプローチシナリオ（ケイデンス/シーケンス）** を導入する。

「点」のアプローチから「線」のアプローチへ。

## コア概念

### 1. Sequence（シーケンス）

1つのContact × 1つのCampaignに対する「一連のアプローチシナリオ」。

```
Sequence
├── SequenceStep[0]: 初回挨拶（Mail, delay=0h）
├── SequenceStep[1]: フォロー（LINE, delay=72h）
└── SequenceStep[2]: クロージング（Mail, delay=168h）
```

- AIが商材×受け手の文脈から複数ステップを自動設計
- 人間はシーケンス全体を一括承認（Approve）
- 承認後、Step[0]は即送信、Step[1]以降はdelayHoursに基づきスケジューリング

### 2. マルチチャネル・クロス配信

各SequenceStepは独自のチャネルを持てる:
- `step[0].channel = "mail"` → 初回はメール
- `step[1].channel = "line"` → 反応なければLINEでフォロー

AIがContact情報（利用可能チャネル、優先チャネル）を考慮してチャネルを提案。
人間が承認時にチャネルを変更可能。

### 3. Auto-Pause（自動停止）

返信・コンバージョンを検知した瞬間、未送信のステップを自動キャンセル:

```
[Step 0: 送信済] → [Step 1: スケジュール済] → [Step 2: スケジュール済]
                         ↑ 返信検知!
                    → Step 1, 2 を cancelled に変更
                    → Sequence 全体を responded に変更
```

トリガー:
- Webhook経由の返信通知
- TrackingLink経由のURLクリック検知
- 外部コンバージョンイベント

### 4. 動的タグ付け

URLクリック等のアクションを検知し、Contactにinterestタグを自動追加:

```
ActionLog { type: "link_click", url: "/event/ise-matsuri" }
  → Contact.attributes.interests に "祭り" を追加
  → 次回のパーソナライズに反映
```

## データモデル

### 新規テーブル

```
Sequence
  id, campaignId, contactId, status, approvedBy, approvedAt, ...
  → 1 Campaign : N Sequences
  → 1 Contact  : N Sequences

SequenceStep
  id, sequenceId, stepOrder, delayHours, channel, body, angle, status, scheduledAt, sentAt, ...
  → 1 Sequence : N SequenceSteps

TrackingLink
  id, sequenceStepId, originalUrl, trackingToken, clickedAt, ...
  → 1 SequenceStep : N TrackingLinks

ActionLog
  id, contactId, sequenceId?, type, payload, ...
  → アクション検知の記録
```

### 既存テーブルへの影響

- **Campaign**: 変更なし
- **Contact**: `tagsJson` フィールドを追加（動的タグ用）
- **Message**: 変更なし（既存の単発メッセージは維持）

## シーケンス生成フロー

```
1. [decompose] 商材要素分解（既存）
2. [analyze]   カスタマー調査（既存）
3. [generate]  シーケンス生成（★改修）
   - AI に「3ステップのシナリオ」を生成させる
   - 各ステップに channel, delayHours, body, angle を含む
   - A/Bテスト: 各ステップで2案ずつ生成
4. [review]    人間の承認待ち（既存 + シーケンス対応）
   - シーケンス全体を一覧表示
   - 各ステップのチャネル・内容を確認/編集
   - 一括承認
5. [schedule]  スケジューリング（★新規）
   - Step[0]: 即時キュー投入
   - Step[1+]: delayHours後のキュー投入（BullMQ delayed job想定）
```

## Auto-Pause フロー

```
[Webhook/TrackingLink] → handleAction(contactId, actionType)
  ├── ActionLog に記録
  ├── cancelActiveSequences(contactId)
  │   └── 進行中 Sequence の未送信 Step を cancelled に
  └── applyDynamicTags(contactId, action)
      └── Contact.tags に興味タグを追加
```

## BullMQ統合の設計方針

現時点ではBullMQ未統合のため、スケジューリングロジックは抽象化:

```typescript
interface SequenceScheduler {
  scheduleStep(step: SequenceStep): Promise<string>; // jobId
  cancelStep(stepId: string): Promise<void>;
  cancelAllForContact(contactId: string): Promise<void>;
}
```

InMemory実装を提供し、BullMQ実装への差し替えを容易にする。

## 安全設計

1. **承認なしの送信禁止**: シーケンス全体の承認がない限り、いかなるステップも送信しない
2. **Auto-Pause**: 返信/コンバージョン検知で即座に未送信ステップをキャンセル
3. **冪等性**: 各SequenceStepに冪等性キー（campaignId+contactId+stepOrder+channel）
4. **条件なし送信禁止**: ターゲット条件なしのブロードキャスト禁止（既存ルール維持）
