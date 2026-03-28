# targeting.md — ターゲット条件の設計規約

## 条件の型

すべてのセグメント条件は `src/types/segment.ts` の `SegmentFilter` 型に従う。

```ts
type FilterOperator = "AND" | "OR"

type SegmentFilter =
  | { type: "platform"; value: "twitter" | "connpass" | "line" | "did-event" }
  | { type: "keyword"; value: string }
  | { type: "location"; value: string }
  | { type: "behavior"; value: "event-attended" | "post-about" | "follows" }
  | { type: "vc"; credentialType: string }
  | { type: "token"; minAmount: number }

type Segment = {
  operator: FilterOperator
  filters: SegmentFilter[]
}
```

## 実装規約

- フィルタ関数は `src/lib/filters/` に1条件1ファイルで配置する
- 各フィルタ関数は `Contact[]` を受け取り `Contact[]` を返す純粋関数にする
- フィルタ追加時は必ず対応するテストを書く
- スコアリングロジックは `src/lib/filters/score.ts` に集約する

## 禁止

- 条件なし（全員対象）での送信
- 個人を特定できる情報をフィルタ条件に直接埋め込む
