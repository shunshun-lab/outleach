# 送信チャネル抽象化 — 実装サマリー

## 実装日: 2026-03-28

## 概要

Outreach App に送信チャネル抽象化を導入し、
Mail をデフォルト fallback、LINE を到達条件付き候補、
Messenger を条件付き（24時間ルール）候補として追加した。

## 変更ファイル一覧

### 新規作成

| ファイル | 役割 |
|---------|------|
| `src/types/channel.ts` | チャネル関連の型定義（ChannelAdapter, DeliveryPolicy, AuditLog等） |
| `src/lib/channels/mail-adapter.ts` | Mail 送信アダプタ |
| `src/lib/channels/line-adapter.ts` | LINE 送信アダプタ |
| `src/lib/channels/messenger-adapter.ts` | Messenger 送信アダプタ（24時間ルール付き） |
| `src/lib/channels/registry.ts` | アダプタレジストリ |
| `src/lib/channels/resolver.ts` | チャネル解決ロジック（DeliveryPolicy） |
| `src/lib/channels/idempotency.ts` | 冪等性キー生成 |
| `src/lib/channels/audit.ts` | 監査ログ（インメモリ） |
| `src/lib/channels/index.ts` | re-exports |
| `src/app/api/orchestrator/start/route.ts` | パイプライン開始 API |
| `src/app/api/orchestrator/approve/route.ts` | 承認 API（チャネル選択付き） |
| `src/app/api/orchestrator/status/route.ts` | ステータス・レビュー情報 API |
| `src/components/ReviewPanel.tsx` | レビュー・承認 UI（チャネル選択付き） |
| `src/__tests__/channels.test.ts` | チャネル関連のユニットテスト（20テスト） |
| `vitest.config.ts` | テストランナー設定 |
| `docs/outreach-channel-architecture.md` | アーキテクチャドキュメント |
| `docs/outreach-ops-manual.md` | 運用マニュアル |

### 既存ファイルの変更

| ファイル | 変更内容 |
|---------|---------|
| `src/types/contact.ts` | email, lineUserId, messengerPsid, preferredChannel, optOutChannels 追加 |
| `src/types/message.ts` | channel, providerMessageId, deliveryStatus, idempotencyKey, approvedBy/At 追加 |
| `src/types/index.ts` | channel.ts の re-export 追加 |
| `prisma/schema.prisma` | Contact にチャネルフィールド追加、Message にチャネル・冪等性フィールド追加、Delivery テーブル新設、AuditLog テーブル新設 |
| `src/lib/orchestrator/types.ts` | GeneratedTarget に channelResolution/selectedChannel 追加、PipelineState に approvedChannels/approvedBy/approvedAt 追加 |
| `src/lib/orchestrator/orchestrator.ts` | approve() にチャネル選択・承認者情報を渡せるように拡張 |
| `src/lib/orchestrator/steps.ts` | generate ステップにチャネル解決追加、send ステップをアダプタ経由に全面書き換え |

## 設計判断

1. **adapter pattern** で送信チャネルを抽象化。ChannelAdapter interface を定義し、各チャネルが `canSend` / `send` / `normalizeResult` を実装する。

2. **ChannelResolver** が contact ごとに利用可能チャネルと推奨チャネルを解決。Messenger は自動推奨しない（ユーザー明示選択のみ）。

3. **既存の approval gate を維持**。review ステップで自動 pause、approve() のみで send に遷移する設計は変更していない。approve に bypass 経路は存在しない。

4. **冪等性キー** は `campaignId + contactId + channel` の SHA-256 ハッシュ。DB の UNIQUE 制約で二重送信を防止。

5. **Prisma schema は additive のみ**。既存テーブルの削除・カラム変更なし。新フィールドはすべて optional。

6. **送信実装は stub**。実際のメール送信（Gmail API/SMTP）、LINE Messaging API、Facebook Graph API の呼び出しは TODO。アダプタのインターフェースと canSend ロジックは完成。

## テスト結果

```
Test Files  1 passed (1)
     Tests  20 passed (20)
```

カバー範囲:
- MailChannelAdapter: canSend（email有/無/opt-out）、send
- LineChannelAdapter: canSend（ID有/無/連携未完了/opt-out）
- MessengerChannelAdapter: canSend（PSID有/無/24時間超過/受信履歴なし）
- ChannelResolver: Mail のみ、LINE推奨、preferredChannel、チャネルなし、全opt-out
- Idempotency: 同一入力同一キー、異チャネル異キー、プレフィックス

## ビルド結果

```
✓ Next.js build 成功
✓ TypeScript 型チェック通過（tsc --noEmit）
✓ 全 API ルート（start/approve/status）生成確認
```

## 承認フローの安全性確認

| チェック項目 | 結果 |
|------------|------|
| review ステップで自動 pause | state-machine.ts: `shouldAutoPause("review") === true` |
| approve なしで send に遷移不可 | orchestrator.ts: approve() のみが `executeFrom(runId, "send")` を呼ぶ |
| approvedTargetIds が空なら send 失敗 | steps.ts: `approved.length === 0` → failed |
| 承認者ID必須 | approve/route.ts: `!body.approvedBy` → 400 |
| 監査ログに承認操作を記録 | approve/route.ts: writeAuditLog() 呼び出し |

## 残課題

1. **実際の送信プロバイダ統合**: Gmail API, LINE Messaging API, Facebook Graph API の呼び出し実装
2. **BullMQ キュー統合**: 現在は同期的に send を実行。本番では BullMQ に投入して worker で処理する設計に移行
3. **Prisma Store への移行**: InMemoryPipelineStore → PrismaPipelineStore
4. **リトライ戦略**: 一時失敗時のリトライ回数・間隔の設定
5. **Review UI のページ統合**: ReviewPanel コンポーネントを実際のページに組み込む
6. **E2E テスト**: パイプライン全体のインテグレーションテスト
7. **監査ログの Prisma 永続化**: 現在はインメモリ

## ロールバック手順

1. `src/lib/channels/registry.ts` で該当アダプタをコメントアウト
2. `src/lib/orchestrator/steps.ts` の send ステップを旧実装に戻す
3. Prisma schema の新フィールドは optional なので、DB マイグレーションの巻き戻しは不要
4. 型定義の追加フィールドはすべて optional なので、コンパイルエラーは発生しない
