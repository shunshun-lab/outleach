# contexts/outreach.md — ドメイン知識

## このアプリが解く問題

「伝えたいこと」と「刺さる人」の間にあるギャップを埋める。
同じイベント（例：伊勢の祭り）でも、受け手によって刺さる切り口が違う。

| 受け手 | 刺さる文脈 |
|--------|-----------|
| 文化オタク | 「1300年の歴史」 |
| 旅行好き | 「非日常体験」 |
| 地域DAO民 | 「地域コミュニティへの貢献」 |
| 外国人 | 「Authentic Japanese tradition」 |

## ターゲット発見の考え方

1. **プラットフォーム内**（did-event.vercel.app）
   - 過去参加イベントのVC保有者
   - トークン残高・スキルでフィルタ

2. **外部Web**
   - Twitter/X: ハッシュタグ・キーワードで発見
   - Connpass/Doorkeeper: イベント参加者リスト
   - GitHub: コントリビュータ（技術系イベント向け）

## コンバージョンの定義

- イベント系: 参加登録完了
- コミュニティ系: メンバー登録
- 情報系: 返信・問い合わせ

## did-event API との連携

- 既存ユーザー検索: `GET /api/events/[id]/participants`
- VC保有確認: `GET /api/verify/[credentialId]`
- 通知送信: `POST /api/events/[id]/notify`
- AIブラッシュアップ: `POST /api/ai/event/brushup`

## 連携予定の外部チャネル

- Gmail（gog CLIで実装済み）
- LINE（webhook実装済み）
- WhatsApp（webhook実装済み）
- Twitter DM（未実装）
