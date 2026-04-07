# アーキテクチャ設計

## 基本方針

- ゲームのコアロジックはUIから完全に分離する
- コアロジックは純粋なTypeScriptで実装し、Vitestで単体テストする
- UIはSvelteコンポーネントで実装し、コアロジックを呼び出す
- E2Eテスト（Playwright）はUIの操作と表示を検証する

## フォルダ構成

```text
src/
  lib/
    othello/
      logic.ts          ← ゲームロジック（純粋関数・状態管理）
      logic.test.ts     ← ロジックの単体テスト
      ai.ts             ← AI（評価関数・ミニマックス）
      ai.test.ts        ← AIの単体テスト
      types.ts          ← 型定義
    game2048/
      logic.ts
      logic.test.ts
      types.ts
    gomoku/
      logic.ts          ← ゲームロジック（勝利判定・禁じ手）
      logic.test.ts
      ai.ts             ← AI（評価関数・ミニマックス）
      ai.test.ts
      types.ts
    one-stroke/
      logic.ts
      logic.test.ts
      generator.ts      ← ステージ生成アルゴリズム
      generator.test.ts
      types.ts
    common/
      （共通ユーティリティがあれば）
  routes/
    +layout.svelte      ← 共通レイアウト
    +layout.ts          ← prerender設定
    +page.svelte        ← トップページ（ゲーム一覧）
    othello/
      +page.svelte      ← オセロのUI
      SPEC.md
    gomoku/
      +page.svelte      ← 五目並べのUI
      SPEC.md
    game2048/
      +page.svelte      ← 2048のUI
      SPEC.md
    one-stroke/
      +page.svelte      ← 一筆書きのUI
      SPEC.md
e2e/
  navigation.test.ts    ← 共通E2Eテスト
  othello.test.ts       ← オセロE2Eテスト
  game2048.test.ts      ← 2048 E2Eテスト
  one-stroke.test.ts    ← 一筆書きE2Eテスト
docs/
  TDD.md                ← 開発手法
  ARCHITECTURE.md       ← このファイル
```

## ロジックとUIの分離

### ロジック層（src/lib/ゲーム名/）

- 純粋なTypeScriptで実装する（Svelteに依存しない）
- 状態を受け取り、新しい状態を返す純粋関数を基本とする
- 副作用（localStorage、タイマーなど）はロジック層に含めない
- Vitestで直接テストできること

例:

```typescript
// src/lib/othello/logic.ts
export function createBoard(): Board { ... }
export function placeStone(board: Board, row: number, col: number, color: Color): PlaceResult { ... }
export function getValidMoves(board: Board, color: Color): Position[] { ... }
```

### UI層（src/routes/ゲーム名/）

- Svelteコンポーネントで実装する
- ロジック層の関数を呼び出して状態を更新する
- 表示、アニメーション、ユーザー入力の処理を担当する
- ゲーム状態はSvelteの$stateで管理する

例:

```svelte
<script lang="ts">
  import { createBoard, placeStone, getValidMoves } from '$lib/othello/logic';

  let board = $state(createBoard());
  let validMoves = $derived(getValidMoves(board, currentColor));
</script>
```

## 共通UIパターン

### レイアウト

- モバイルファースト設計（Tailwind CSSを使用）
- ゲーム領域は画面幅に合わせてレスポンシブに調整
- 各ゲームページに「戻る」リンクを配置

### 色の方針

- 共通UI（ヘッダー、ボタンなど）は統一したカラースキームを使用
- ゲーム固有の定番色はそのゲーム内で個別に定義してよい
  - オセロ: 緑のボード
  - 2048: 数値に応じたタイル色
  - 一筆書き: 通過済みの強調色

## テスト戦略

### Vitest（単体テスト）

- src/lib/ 配下のロジックをテストする
- テストファイルはロジックファイルの隣に配置する（例: logic.ts の隣に logic.test.ts）
- t_wada式TDDに従い、テストを先に書いてからロジックを実装する

### Playwright（E2Eテスト）

- e2e/ 配下に配置する
- 画面遷移、ユーザー操作、表示の確認をテストする
- Desktop Chrome と Mobile Chrome の両方でテストする

## 状態管理

- 各ゲームの状態はSvelte 5の$state/$derivedで管理する
- ゲーム間で状態を共有しない
- 2048のベストスコアのみlocalStorageに永続化する
