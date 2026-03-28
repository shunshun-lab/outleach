# SKILL: add-segment — セグメント条件の追加手順

新しいターゲット条件（フィルタ）を追加するときは、必ずこの手順に従う。

## 手順

1. **型を追加する**
   - `src/types/segment.ts` の `SegmentFilter` ユニオン型に新しい条件を追加する
   - `targeting.md` の型定義の規約に従う

2. **フィルタ関数を実装する**
   - `src/lib/filters/<条件名>.ts` に新ファイルを作成する
   - `Contact[]` を受け取り `Contact[]` を返す純粋関数にする
   - 外部APIを叩く場合はエラーハンドリングを必ず入れる

3. **条件ビルダーUIに追加する**
   - `src/components/SegmentBuilder.tsx` に選択肢を追加する
   - ラベルは日本語で、わかりやすく

4. **テストを書く**
   - `src/lib/filters/__tests__/<条件名>.test.ts` を作成する
   - 正常系・異常系・空配列の3ケースを含める
   - `npm run test` で全テストが通ることを確認する

5. **progress.md を更新する**
   - 追加した条件名と理由を意思決定ログに記録する

## 完了確認

- [ ] 型定義に追加した
- [ ] フィルタ関数を実装した
- [ ] UIに追加した
- [ ] テストが通る
- [ ] progress.md を更新した
