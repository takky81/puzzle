<script lang="ts">
  import { resolve } from '$app/paths';

  const games = [
    {
      name: 'オセロ',
      path: '/othello',
      emoji: '⚫',
      description: '白と黒の石で陣地を取り合う定番ボードゲーム',
    },
    {
      name: '2048',
      path: '/game2048',
      emoji: '🔢',
      description: '数字タイルをスライドして2048を目指すパズル',
    },
    {
      name: '五目並べ',
      path: '/gomoku',
      emoji: '⚫',
      description: '先に5つ並べた方が勝ちのボードゲーム',
    },
    {
      name: '一筆書き',
      path: '/one-stroke',
      emoji: '✏️',
      description: '全ての線を一筆で通るパズル',
    },
  ];
</script>

<svelte:head>
  <title>Puzzle & Games</title>
</svelte:head>

<h1 class="mb-4 text-2xl font-bold">ゲーム一覧</h1>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
  {#each games as game (game.path)}
    <a
      href={resolve(game.path, {})}
      class="block rounded-xl bg-white p-6 text-inherit no-underline shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg active:-translate-y-0.5 active:shadow-lg"
    >
      <span class="mb-2 block text-4xl">{game.emoji}</span>
      <h2 class="mb-1 text-xl font-bold">{game.name}</h2>
      <p class="text-sm text-base-muted">{game.description}</p>
    </a>
  {/each}
</div>
