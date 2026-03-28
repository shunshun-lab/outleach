# progress.md — Outreach App

## 現在の状態

- フェーズ: オーケストレータ設計・プロトタイプ実装完了
- 実装済み: Next.js 15 初期化、型定義、Prisma スキーマ、AI パイプライン、APIルート、**オーケストレータ（ステートマシン・状態永続化・承認ゲート）**
- 作業中: 条件ビルダーUI、Contactスクレイパー、オーケストレータのPrisma永続化移行

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
  - [ ] PrismaベースのPipelineStore実装
  - [ ] BullMQジョブキューとの統合
  - [ ] APIルート（/api/orchestrator/start, /approve, /status）
- [ ] 条件ビルダーUI
- [ ] Contactスクレイパー（Twitter/Connpass）
- [ ] 送信キュー（BullMQ）
- [ ] トラッキング（開封・返信・コンバージョン）
- [ ] Gitea リポジトリ作成

## キャンペーン結果ログ

（送信実行後にここに記録する）

## 次のセッションで対応すること

- PostgreSQL接続設定 + prisma migrate dev
- PrismaベースのPipelineStore実装（InMemory → PostgreSQL移行）
- オーケストレータ用APIルート（/api/orchestrator/*）
- BullMQとオーケストレータの統合（送信ステップのキュー化）
- 条件ビルダーUI プロトタイプ
- Contactスクレイパー（Twitter/Connpass）の初期実装
- Gitea リポジトリ作成 + 初回push
- パイプラインの結合テスト（実際のClaude API呼び出し）
