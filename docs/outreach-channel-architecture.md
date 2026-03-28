# 送信チャネル・アーキテクチャ

## 概要

Outreach App は adapter pattern で送信チャネルを抽象化し、
contact ごとに最適なチャネルを選択して配信する。

## チャネル種別

| チャネル | デフォルト | 利用条件 | 備考 |
|---------|----------|---------|------|
| Mail | Yes (fallback) | email が登録済み | 常にフォールバック候補 |
| LINE | No | lineUserId + lineLinkedAt が存在 | 到達率が高い傾向 |
| Messenger | No (条件付き) | messengerPsid + 24時間以内の受信 | Meta Standard Messaging ポリシー準拠 |

## アーキテクチャ

```
ChannelAdapter (interface)
├── MailChannelAdapter
├── LineChannelAdapter
└── MessengerChannelAdapter

ChannelResolver
├── resolveChannels(contact, campaign) → ChannelResolution
├── resolveChannelsBatch(contacts, campaign) → ChannelResolution[]
└── canSendVia(channel, contact, campaign) → boolean

Registry
├── getAdapter(channelType) → ChannelAdapter
└── getAllAdapters() → ChannelAdapter[]
```

## ChannelAdapter インターフェース

```typescript
interface ChannelAdapter {
  readonly channelType: ChannelType;
  canSend(contact, campaign, context?): CanSendResult;
  send(draft, contact, context): Promise<ChannelSendResult>;
  normalizeResult(providerResponse): ChannelSendResult;
}
```

## チャネル解決ルール

1. 全アダプタの `canSend()` を呼び、利用可能チャネルを列挙
2. 推奨チャネルの決定:
   - `contact.preferredChannel` が利用可能 → それを使用
   - LINE が利用可能 → LINE を推奨
   - それ以外 → Mail
3. Messenger は自動推奨しない（ユーザーが review UI で明示的に選択する場合のみ）
4. フォールバックは常に Mail

## 承認フロー（Approval Gate）

```
decompose → analyze → generate → review [PAUSED] → approve → send
```

- review ステップで自動的に一時停止
- 人間が review UI でターゲット・チャネルを確認
- approve API を呼ぶまで送信は絶対に実行されない
- approve 時に contactId ごとのチャネル選択を指定可能
- 承認なし送信の経路は存在しない

## 冪等性

`campaignId + contactId + channel` のハッシュから idempotencyKey を生成。
同一キャンペーン内で同一コンタクトに同一チャネルでの二重送信を防止する。

## 監査ログ

以下の操作を AuditLog に記録:
- approve: 誰がどの targetId を承認したか
- channel_select: どのチャネルが選ばれたか
- message_edit: レビュー中にメッセージが編集されたか
- queue_submit: キュー投入時刻
- send_success / send_failure: 送信結果

## オプトアウト

contact ごとにチャネル別のオプトアウト設定を持つ:
- `optOutEmail`, `optOutLine`, `optOutMessenger` (Prisma)
- `optOutChannels: ChannelType[]` (TypeScript)

オプトアウト済みのチャネルは canSend が false を返し、
review UI では disabled 表示される。

## ファイル構成

```
src/lib/channels/
├── index.ts          # re-exports
├── registry.ts       # アダプタレジストリ
├── resolver.ts       # チャネル解決ロジック
├── idempotency.ts    # 冪等性キー生成
├── audit.ts          # 監査ログ
├── mail-adapter.ts   # Mail アダプタ
├── line-adapter.ts   # LINE アダプタ
└── messenger-adapter.ts  # Messenger アダプタ
```
