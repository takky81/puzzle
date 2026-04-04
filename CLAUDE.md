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

## コミット時の自動チェック

pre-commitフック（husky + lint-staged）により、コミット時に以下が自動実行される：

- lint-staged: ESLint + Prettier（変更ファイルのみ）
- npm run check: TypeScript型チェック
- npm test: 単体テスト

## CI（GitHub Actions）

pushおよびPR時に以下が自動実行される：

- lint, format:check, check, test, build
- Playwright E2Eテスト（Chromium）
