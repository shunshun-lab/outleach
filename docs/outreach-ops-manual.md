# 送信チャネル 運用マニュアル

## チャネルルール

### Mail (デフォルト)
- **条件**: Contact に email が登録されている
- **フォールバック**: 他のチャネルが利用不可の場合に自動的に使用される
- **オプトアウト**: `optOutEmail: true` で無効化

### LINE (利用可能な場合)
- **条件**: `lineUserId` が存在し、`lineLinkedAt` が設定されている
- **推奨ケース**: LINE 連携済みユーザーには Mail より到達率が高い
- **オプトアウト**: `optOutLine: true` で無効化

### Messenger (条件付き)
- **条件**: 以下をすべて満たす必要がある
  1. `messengerPsid` が存在する
  2. `messengerLastInboundAt` が24時間以内
  3. `optOutMessenger` が false
- **24時間ルール**: Meta の Standard Messaging ポリシーにより、
  ユーザーからの最終メッセージから24時間以内にしか送信できない
- **注意**: 条件を満たさない場合、review UI で disabled 表示される

## 承認フロー（必須）

1. パイプラインを開始: `POST /api/orchestrator/start`
2. ステータスを確認: `GET /api/orchestrator/status?runId=xxx`
3. review UI でターゲット・チャネル・メッセージを確認
4. 承認: `POST /api/orchestrator/approve` （承認者ID必須）
5. 送信実行（自動）

**重要: approve なしに送信が実行されることはありません。**

## 二重送信防止

- `campaignId + contactId + channel` から冪等性キーを自動生成
- 同一キーでの重複送信はブロックされる
- Delivery テーブルで `idempotencyKey` に UNIQUE 制約あり

## オプトアウト管理

Contact のオプトアウト設定を変更する場合:
- Prisma 経由で `optOutEmail`, `optOutLine`, `optOutMessenger` を更新
- オプトアウト済みのチャネルは canSend が false を返す
- review UI ではオプトアウト済みチャネルは選択不可になる

## ロールバック手順

チャネル機能を無効化する場合:

1. `src/lib/channels/registry.ts` で該当アダプタをコメントアウト
2. `src/lib/orchestrator/steps.ts` の send ステップで
   channel fallback を "mail" 固定に変更
3. Prisma schema の変更は additive なので、ロールバック不要
   （新フィールドは optional）

## 監査ログの確認

`GET /api/orchestrator/status?runId=xxx` のレスポンスに
`auditLogs` が含まれる。以下のアクションが記録される:
- `approve`: 承認操作
- `channel_select`: チャネル選択変更
- `send_success` / `send_failure`: 送信結果
