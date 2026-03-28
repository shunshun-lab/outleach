# progress.md — Outreach App

## 現在の状態

- フェーズ: レビュー画面Prisma接続完了・BullMQ統合待ち
- 実装済み: Next.js 15 初期化、型定義、Prisma スキーマ、AI パイプライン、APIルート、**オーケストレータ（ステートマシン・状態永続化・承認ゲート）**、**送信チャネル抽象化（Mail/LINE/Messenger adapter, ChannelResolver, 監査ログ, Review UI, 冪等性）**、**シーケンス配信（ケイデンス/マルチチャネルクロス配信/Auto-Pause/動的タグ付け）**、**Prisma Postgres接続（レビュー画面のリアルデータ化・承認処理のDB書き込み・JXCシードデータ投入）**
- 作業中: 条件ビルダーUI、Contactスクレイパー、BullMQベースのシーケンススケジューラ、シーケンスReview UI

## 意思決定ログ

- 2026-03-28: プロジェクト開始。did-event.vercel.app のAPIを分析し、外部営業自動化ツールとして独立させる方針を決定
- 2026-03-28: Gitホスティングは自己ホスト Gitea を使用する（GitHub凍結リスクを避けるため）
- 2026-03-28: 「送信前に人間の承認」を設計原則に組み込む
- 2026-03-28: ターゲット条件を AND/OR で組み合わせる「条件ビルダー」がUIの核心
- 2026-03-28: AI パイプラインを4段階で設計（商材分解→顧客調査→文章生成→改善ループ）
- 2026-03-28: 改善ループは PromptIteration テーブルで版管理し、送信結果のフィードバックで自動進化する設計
- 2026-03-28: relevanceScore 閾値（デフォルト30）でアプローチ対象を自動フィルタリング
- 2026-03-28: **オーケストレーション前提の設計に方針変更**（shunさん指示）
  - 各ステップ（商材分解・カスタマー分析・アプローチ生成・改善ループ）を独立ジョブとして定義
  - ステートマシンで状態遷移を管理し、各ステップ間で状態をDB/ストアに永続化
  - review ステップで自動的に paused になり、人間が approve() するまで送信に進まないアーキテクチャ
  - 旧 `src/lib/ai/pipeline.ts` は参考用に残し、新設計は `src/lib/orchestrator/` に集約
  - ストアは PipelineStore インターフェースで抽象化し、InMemory → Prisma への移行を容易にする
- 2026-03-28: **シーケンス配信（ケイデンス）機能を導入**
  - 「点」ではなく「線」のアプローチ: AIが複数ステップのシナリオを自動設計
  - マルチチャネルクロス配信: 各ステップに独立チャネル設定可能
  - Auto-Pause: 返信/コンバージョン検知で未送信ステップを自動キャンセル
  - 動的タグ付け: URLクリック等でContactにinterestタグを自動追加
  - SequenceScheduler/SequenceStore をインターフェースで抽象化（InMemory → BullMQ/Prisma移行容易）
  - シーケンス全体の一括承認フロー
  - 詳細: docs/sequence-implementation-summary.md
- 2026-03-28: **LINE Messaging API 実送信アダプタ実装完了**（JXCプロジェクト用「クロスくん」）
  - `@line/bot-sdk` を導入、`LineChannelAdapter.send()` で Push Message API を呼び出す実装に置き換え
  - 環境変数 `LINE_CHANNEL_ACCESS_TOKEN` でトークン管理
  - エラーハンドリング・normalizeResult の実レスポンス対応
  - テストスクリプト（scripts/test-line.ts）でトークン検証＋canSendロジック確認済み
- 2026-03-28: **レビュー画面をPrisma Postgresに接続（リアルデータ化���**
  - `src/lib/db.ts` — PrismaClient singleton（`@prisma/adapter-pg` 経由でPrisma Postgres接続）
  - `GET /api/campaigns/[id]/review` — DBからキャンペーン・Message・Contact情報を取得するAPIルート新設
  - `POST /api/orchestrator/approve` — DB書き込みに移行（Messageステータス更新・AuditLog記録・トランザクション）
  - レビューページ（page.tsx）のデフォルトデータソースをDB APIに変更（モック切替も維持）
  - `scripts/seed-jxc.ts` — JXCキャンペーン・3名のContact・Gemini生成メッセージをシード
  - Campaign ID: `cmnabz15d0000s6374revijg6`
- 2026-03-28: **承認（Approve）UI レビュー画面を実装**
  - `src/app/campaigns/[id]/review/page.tsx` — キャンペーンレビューページ（ダッシュボード風）
  - `ReviewPanel.tsx` を拡張: メッセージの手動編集（textarea）、編集済みフラグ、品質スコア表示
  - モックデータAPI (`/api/orchestrator/mock-review`) でDB未接続でも動作確認可能
  - ステータスサマリー（ステータス/ターゲット数/平均スコア）のカード表示
  - 承認フロー: ターゲット選択 → チャネル選択 → メッセージ編集 → 承認者ID入力 → Approve & Send
- 2026-03-28: **送信チャネル抽象化を導入**
  - adapter pattern で Mail/LINE/Messenger を統一インターフェースで扱う
  - ChannelResolver で contact ごとの利用可能チャネル・推奨チャネルを解決
  - Mail はデフォルト fallback、LINE は連携済みなら候補、Messenger は24時間ルール付き条件付き
  - 冪等性キー（campaignId+contactId+channel）で二重送信防止
  - 監査ログで承認・チャネル選択・送信結果を記録
  - Review UI でチャネル候補表示・選択が可能
  - 実際の送信プロバイダ（Gmail API, LINE Messaging API, Graph API）は stub

## 実装予定（優先順）

- [x] プロジェクト初期化（Next.js 15 + TypeScript + Tailwind）
- [x] 型定義の拡充（Campaign / Contact / Message / ProductAnalysis / PromptIteration）
- [x] Prisma セットアップ + DBスキーマ設計
- [x] 商材要素分解モジュール（src/lib/ai/decompose-product.ts）
- [x] カスタマー調査モジュール（src/lib/ai/analyze-customer.ts）
- [x] AI文章生成パイプライン（src/lib/ai/generate-message.ts）
- [x] 自己改善ループ（src/lib/ai/improve-prompt.ts）
- [x] パイプラインオーケストレーション（src/lib/ai/pipeline.ts）
- [x] APIルート（/api/campaign/analyze, /pipeline, /improve）
- [x] オーケストレータ設計（src/lib/orchestrator/）
  - [x] 型定義・ステートマシン（types.ts, state-machine.ts）
  - [x] ステップハンドラ（steps.ts — 既存AIモジュールのアダプタ層）
  - [x] 状態ストア（store.ts — InMemory実装 + PipelineStore interface）
  - [x] オーケストレータ本体（orchestrator.ts — start/approve/cancel/getStatus）
  - [x] APIルート（/api/orchestrator/start, /approve, /status）
  - [x] 送信チャネル抽象化（src/lib/channels/）
    - [x] ChannelAdapter interface + Mail/LINE/Messenger adapter
    - [x] ChannelResolver（contact 単位のチャネル解決）
    - [x] 冪等性キー生成
    - [x] 監査ログ（インメモリ）
    - [x] Review UI コンポーネント（チャネル選択付き・メッセージ編集対応）
    - [x] キャンペーンレビューページ（src/app/campaigns/[id]/review/）
    - [x] モックデータAPI（/api/orchestrator/mock-review）
    - [x] ユニットテスト（20テスト通過）
  - [x] シーケンス配信（ケイデンス/Auto-Pause）
    - [x] Prisma schema 拡張（Sequence/SequenceStep/TrackingLink/ActionLog）
    - [x] 型定義（src/types/sequence.ts）
    - [x] AIシーケンス生成（src/lib/ai/generate-sequence.ts）
    - [x] シーケンスマネージャ（src/lib/orchestrator/sequence-manager.ts）
    - [x] スケジューラ抽象化（src/lib/orchestrator/sequence-scheduler.ts）
    - [x] Auto-Pause + SequenceStore（src/lib/orchestrator/auto-pause.ts）
    - [x] シーケンスAPI（/api/sequence/create, /approve, /action）
    - [ ] BullMQベースのSequenceScheduler実装
    - [ ] PrismaベースのSequenceStore実装
    - [ ] シーケンスReview UI
  - [x] Prisma Postgres接続（レビュー画面・承認処理）
  - [ ] PrismaベースのPipelineStore実装
  - [ ] BullMQジョブキューとの統合
  - [~] 実送信プロバイダ統合（Gmail API, LINE Messaging API, Graph API）
    - [x] LINE Messaging API（@line/bot-sdk 経由、Push Message API 実装完了）
- [ ] 条件ビルダーUI
- [ ] Contactスクレイパー（Twitter/Connpass）
- [ ] 送信キュー（BullMQ）
- [ ] トラッキング（開封・返信・コンバージョン）
- [ ] Gitea リポジトリ作成

## キャンペーン結果ログ

（送信実行後にここに記録する）

## 次のセッションで対応すること

- PostgreSQL接続設定 + prisma migrate dev（シーケンス関連テーブル含む）
- PrismaベースのPipelineStore実装（InMemory → PostgreSQL移行）
- PrismaベースのSequenceStore実装（InMemory → PostgreSQL移行）
- BullMQベースのSequenceScheduler実装（遅延ジョブによるシーケンスステップ送信）
- 監査ログの Prisma 永続化（InMemory → AuditLog テーブル）
- BullMQとオーケストレータの統合（送信ステップのキュー化）
- 実送信プロバイダ統合（Gmail API, LINE Messaging API, Graph API）
- シーケンス Review UI（全ステップ一覧・チャネル選択・一括承認）
- TrackingLink のURL書き換え + クリック検知エンドポイント
- Webhook統合（返信検知からAuto-Pause発動）
- 条件ビルダーUI プロトタイプ
- Contactスクレイパー（Twitter/Connpass）の初期実装
- Gitea リポジトリ作成 + 初回push
- シーケンス生成のユニットテスト
- パイプラインの結合テスト（実際のClaude API呼び出し）
- E2E テスト（パイプライン全体のインテグレーションテスト）
