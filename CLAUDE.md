# 開発ルール

コード実装を行う前に、以下のファイルを必ず読むこと：

- docs/TDD.md — 開発手法（t_wada式TDD）。全実装で厳守する
- docs/ARCHITECTURE.md — アーキテクチャ設計。ロジックとUIの分離方針
- 対象ゲームの SPEC.md — 各ゲームの詳細仕様

## 品質チェック（必須）

TDDの各ステップ（Red/Green/Refactor）でテスト実行に加え、以下も毎回実行すること：

- `npm run lint` — ESLintコード品質チェック
- `npm run format:check` — Prettierフォーマットチェック
- `npm run check` — TypeScript + Svelte型チェック
- `npm test` — Vitest単体テスト
- `npm run build` — ビルド確認

エラーもwarningも全て修正してから次に進む。

フォーマットが崩れたら `npm run format` で自動修正できる。

## E2Eテスト（Playwright）

- E2Eテストはロジック層のTDDサイクル完了後、UI層の実装が完了した直後に書く
- TDDのRedステップではE2Eテストは書かない（UIが存在しない段階では意図した理由で失敗しないため）
- E2Eテストの対象: 画面遷移、ユーザー操作（ドラッグ、タップ）、表示の確認

## コミット時の自動チェック

pre-commitフック（husky + lint-staged）により、コミット時に以下が自動実行される：

- lint-staged: ESLint + Prettier（変更ファイルのみ）
- npm run check: TypeScript型チェック
- npm test: 単体テスト

## push時の自動チェック

pre-pushフック（husky）により、push時に以下が自動実行される：

- `npx playwright test`: Playwright E2Eテスト（Desktop Chrome + Mobile Chrome）

## CI（GitHub Actions）

pushおよびPR時に以下が自動実行される：

- lint, format:check, check, test, build
- Playwright E2Eテスト（Chromium）
