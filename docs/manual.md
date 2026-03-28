# Outreach App ユーザーマニュアル

## 目次

1. [概要](#概要)
2. [システム構成](#システム構成)
3. [基本的な使い方](#基本的な使い方)
4. [画面の説明](#画面の説明)
5. [API リファレンス](#apiリファレンス)
6. [チャネル設定](#チャネル設定)
7. [シーケンス配信](#シーケンス配信)
8. [運用ガイド](#運用ガイド)

---

## 概要

Outreach App は「伝えたいこと」と「刺さる人」をつなぐ、パーソナライズ営業自動化ツールです。

AIが以下を自動で行います：
- **商材の要素分解** — イベントやサービスの訴求ポイントを複数の切り口に分解
- **カスタマー分析** — 各ターゲットの属性・行動履歴から最適な切り口を判定
- **メッセージ生成** — 受け手の文脈を主語にした150字以内のパーソナライズ文を複数案生成
- **チャネル自動判定** — LINE / Mail / Messenger から最適なチャネルを選択

**重要:** すべてのメッセージは送信前に人間の承認（Approve）が必須です。自動送信はされません。

---

## システム構成

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  ブラウザUI  │ ──→ │  Next.js API  │ ──→ │  Gemini AI API  │
│  (React)    │ ←── │  Routes      │ ←── │  (文章生成)      │
└─────────────┘     └──────┬───────┘     └─────────────────┘
                           │
                    ┌──────┴───────┐
                    │  PostgreSQL   │
                    │  (Prisma)    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴──────┐
        │  LINE API  │ │ Mail  │ │ Messenger  │
        │  (実装済)  │ │(Stub) │ │  (Stub)    │
        └───────────┘ └───────┘ └────────────┘
```

### 技術スタック
- **フロントエンド:** Next.js 15 (App Router) + React 19 + Tailwind CSS
- **バックエンド:** Next.js API Routes
- **データベース:** PostgreSQL + Prisma ORM
- **AI:** Gemini API (文章生成・分析)
- **送信チャネル:** LINE Messaging API (実装済)、Mail / Messenger (Stub)

---

## 基本的な使い方

### ステップ1: キャンペーン作成とAI分析

API を通じて商材情報とターゲットリストを送信します。

```bash
curl -X POST https://outreach-app-five-blush.vercel.app/api/campaign/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "product": {
      "name": "JXC 体験プログラム 2026春",
      "type": "event",
      "description": "漁師体験を通じた教育プログラム",
      "location": "伊勢",
      "tags": ["教育", "一次産業", "体験"]
    },
    "contacts": [
      {
        "id": "contact-1",
        "name": "山田",
        "platform": "connpass",
        "attributes": {
          "occupation": "教育関係者",
          "interests": ["アウトドア教育", "体験学習"]
        },
        "behaviors": [
          { "type": "event-attended", "detail": "野外教育カンファレンス" }
        ]
      }
    ]
  }'
```

AIが以下を順に実行します：
1. 商材の要素分解（切り口・キーワード・差別化要因を抽出）
2. 各ターゲットとの関連度スコアリング（0〜100点）
3. スコア30点以上のターゲットに対してメッセージ生成（複数案）
4. チャネル判定

### ステップ2: レビュー画面で確認・編集

ブラウザでレビュー画面を開きます：

```
https://outreach-app-five-blush.vercel.app/campaigns/{キャンペーンID}/review
```

レビュー画面でできること：
- 各ターゲットのスコア・切り口の確認
- メッセージの編集（テキストエリアで直接編集可能）
- 送信チャネルの変更（LINE / Mail / Messenger）
- 送信対象の選択・除外（チェックボックス）

### ステップ3: 承認・送信

1. 送信対象をチェックボックスで選択
2. 各ターゲットの送信チャネルを確認・変更
3. 必要に応じてメッセージを編集
4. 承認者IDを入力
5. 「承認・送信」ボタンをクリック

---

## 画面の説明

### トップページ (`/`)

アプリのランディングページです。

- **現在利用可能な機能**の一覧を表示
- **最新のレビュー待ちキャンペーン**へのリンクを自動表示
- **顧客リスト**（Contact一覧）へのリンク

### 顧客リスト (`/contacts`)

登録済みのContact情報をテーブル形式で表示します。

| 列 | 説明 |
|---|---|
| 名前 | 顧客名と優先チャネル |
| プラットフォーム | connpass / twitter 等 |
| メール | メールアドレス |
| チャネル連携 | LINE / Mail 等のバッジ |
| 属性 | 職種・興味タグ |
| メッセージ数 | 送信済みメッセージ数 |
| 登録日 | 登録日時 |

### レビュー画面 (`/campaigns/[id]/review`)

キャンペーンの承認・送信を行うメイン画面です。

#### ヘッダー部
- キャンペーン名とID
- **モックデータ切替**トグル（DB未接続時のテスト用）
- **再読み込み**ボタン

#### サマリーカード（3枚）
| カード | 内容 |
|---|---|
| ステータス | レビュー待ち / 完了 / 実行中 |
| ターゲット数 | 対象の人数 |
| 平均スコア | 関連度スコアの平均 |

#### ターゲット一覧
各ターゲットに以下の情報が表示されます：

- **チェックボックス** — 送信対象に含めるか
- **名前・プラットフォーム・スコア** — ターゲットの基本情報
- **切り口** — AIが選んだアプローチの角度
- **メッセージ案**（複数） — テキストエリアで編集可能
  - 案ごとに品質スコアと禁止ワードチェック結果を表示
  - 編集すると「編集済み」ラベルが付く
- **チャネル選択** — LINE / Mail / Messenger ボタンで切替
  - 利用不可のチャネルはグレーアウト（理由がツールチップで表示）
  - 推奨チャネルが表示される

#### 承認フォーム
- **承認者ID入力**フィールド
- **「N件を承認・送信」ボタン**
- 結果メッセージ（成功/エラー）

---

## APIリファレンス

### キャンペーン系

| メソッド | エンドポイント | 説明 |
|---|---|---|
| POST | `/api/campaign/analyze` | 商材の要素分解のみ実行 |
| POST | `/api/campaign/pipeline` | フルパイプライン実行（分解→分析→生成） |
| POST | `/api/campaign/improve` | 送信結果に基づくプロンプト改善 |
| GET | `/api/campaigns/[id]/review` | レビューデータ取得（DB） |

### オーケストレータ系

| メソッド | エンドポイント | 説明 |
|---|---|---|
| POST | `/api/orchestrator/start` | パイプライン開始（ステートマシン駆動） |
| GET | `/api/orchestrator/status?runId=xxx` | パイプライン状態取得 |
| POST | `/api/orchestrator/approve` | メッセージ承認・送信実行 |
| GET | `/api/orchestrator/mock-review` | モックデータでレビュー画面テスト |

### シーケンス系

| メソッド | エンドポイント | 説明 |
|---|---|---|
| POST | `/api/sequence/create` | マルチステップシーケンス生成 |
| POST | `/api/sequence/approve` | シーケンス承認・スケジュール開始 |
| POST | `/api/sequence/action` | アクション記録（返信/コンバージョン/クリック） |

### Webhook系

| メソッド | エンドポイント | 説明 |
|---|---|---|
| POST | `/api/webhook/line` | LINE Webhook（友達追加で自動Contact作成） |

### 主要パラメータ

#### POST `/api/campaign/pipeline` リクエスト

```json
{
  "product": {
    "name": "イベント名",
    "type": "event | service | community | content",
    "description": "説明文",
    "url": "https://...",
    "date": "2026-04-15",
    "location": "東京",
    "tags": ["タグ1", "タグ2"]
  },
  "contacts": [
    {
      "id": "一意のID",
      "name": "名前",
      "platform": "twitter | connpass | line | did-event",
      "email": "user@example.com",
      "lineUserId": "Uxxxxxx",
      "attributes": {
        "occupation": "職種",
        "location": "地域",
        "interests": ["興味1", "興味2"]
      },
      "behaviors": [
        {
          "type": "event-attended | post-about | follows",
          "detail": "イベント名や内容",
          "date": "2026-01-15"
        }
      ]
    }
  ],
  "relevanceThreshold": 30,
  "customPrompt": "（オプション）カスタム生成プロンプト"
}
```

#### POST `/api/orchestrator/approve` リクエスト

```json
{
  "runId": "キャンペーンID",
  "approvedTargetIds": ["contact-1", "contact-2"],
  "approvedChannels": {
    "contact-1": "line",
    "contact-2": "mail"
  },
  "editedMessages": {
    "contact-1": {
      "0": "編集後のメッセージ本文"
    }
  },
  "approvedBy": "承認者のID"
}
```

---

## チャネル設定

### LINE（実装済み）

LINE Messaging APIのPush Message機能で送信します。

**必要な環境変数:**
```
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
```

**送信条件:**
- Contact に `lineUserId` が設定されている
- Contact が LINE オプトアウトしていない

#### LINE Webhook による自動Contact登録

LINE公式アカウントに友達追加されると、自動でContactリストに登録されます。

**設定手順:**

1. [LINE Developers Console](https://developers.line.biz/) でチャネルを開く
2. Messaging API > Webhook設定 に以下のURLを入力：
   ```
   https://outreach-app-five-blush.vercel.app/api/webhook/line
   ```
3. 「Webhookの利用」をオンにする
4. 環境変数に `LINE_CHANNEL_SECRET` を設定（署名検証用）

**自動処理される内容:**

| LINEイベント | 処理内容 |
|---|---|
| 友達追加（follow） | Contact新規作成（LINE Profile APIで名前取得） |
| ブロック解除（re-follow） | 既存ContactのoptOutを解除 |
| ブロック（unfollow） | ContactのoptOutLineをtrueに設定 |

友達追加だけでContactリストに入るので、手動登録は不要です。

### Mail（Stub）

現在はスタブ実装です。Gmail API またはSMTP統合が必要です。

**送信条件:**
- Contact に `email` が設定されている
- デフォルトのフォールバックチャネル

### Messenger（Stub）

現在はスタブ実装です。Facebook Graph API統合が必要です。

**送信条件:**
- Contact に `messengerPsid` が設定されている
- 最後のインバウンドメッセージから**24時間以内**（Meta Standard Messagingポリシー）

### チャネル優先順位

1. ユーザーがレビュー画面で選択したチャネル
2. Contact の `preferredChannel`
3. LINE が連携済みなら LINE を推奨
4. フォールバック: Mail

---

## シーケンス配信

「点」ではなく「線」のアプローチ。AIが複数ステップのシナリオを自動設計します。

### デフォルトのシーケンス

| ステップ | タイミング | チャネル | 内容 |
|---|---|---|---|
| 1 | 即時 | Mail | 導入・自己紹介 |
| 2 | 72時間後 | LINE | 価値提示・具体例 |
| 3 | 168時間後 | Mail | アクション提案 |

### Auto-Pause 機能

ターゲットが返信またはコンバージョンした場合、残りの未送信ステップは**自動キャンセル**されます。

- **reply（返信）** → 全ステップ停止
- **conversion（コンバージョン）** → 全ステップ停止
- **link_click（リンククリック）** → 動的タグ付け（ステップは継続）

### シーケンスの使い方

```bash
# 1. シーケンス生成
curl -X POST /api/sequence/create \
  -d '{ "campaignId": "...", "product": {...}, "context": {...} }'

# 2. レビュー後に承認
curl -X POST /api/sequence/approve \
  -d '{ "sequenceId": "...", "approvedBy": "your-name" }'

# 3. アクション記録（返信があった場合）
curl -X POST /api/sequence/action \
  -d '{ "contactId": "...", "type": "reply" }'
```

---

## 運用ガイド

### メッセージ生成のルール

AIが生成するメッセージは以下のルールに従います：

| ルール | 説明 |
|---|---|
| 受け手が主語 | ❌「イベントを開催します」 ✅「〇〇に参加された△△さんにとって〜」 |
| 150字以内 | 簡潔さが返信率を上げる |
| 押し売り禁止 | 「ぜひ」「絶対」「今すぐ」等の強制表現は自動除外 |
| 複数案生成 | A/Bテスト用に最低2案を生成 |

### 禁止ワード（自動チェック）

以下のワードが含まれるメッセージは再生成されます：
- 「今すぐ」「必ず」「絶対に」
- 「特別価格」「限定」（根拠がない場合）
- 過度な敬語の重複

### プロンプト改善ループ

送信結果（開封率・返信率・コンバージョン率）を `POST /api/campaign/improve` に送ることで、AIの生成プロンプトが自動進化します。

```
送信 → 結果収集 → 分析 → プロンプト改善 → 次回生成に反映
```

### 個人情報の取り扱い

| 保持OK | 保持NG |
|---|---|
| 名前（名のみ推奨） | 電話番号 |
| メールアドレス（暗号化） | 住所 |
| プラットフォームID | 非公開SNS情報 |
| 公開属性・行動履歴 | 収集元不明な情報 |

**データ保持期間:**
- 未送信Contact: 30日
- 送信済みMessage: 90日
- コンバージョン集計値: 無期限

### 環境変数

```env
# 必須
DATABASE_URL=postgresql://...
GEMINI_API_KEY=your-gemini-api-key

# LINE（Webhook + 送信）
LINE_CHANNEL_ACCESS_TOKEN=your-line-token
LINE_CHANNEL_SECRET=your-line-secret
```

### テストの実行

```bash
npm test          # 全テスト実行（79テスト）
npm run test:watch  # ウォッチモード
```

### シードデータの投入

```bash
npx tsx scripts/seed-jxc.ts
```

JXCキャンペーンのサンプルデータ（3名のContact + AI生成メッセージ）が投入されます。
