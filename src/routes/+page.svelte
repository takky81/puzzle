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

<h1>ゲーム一覧</h1>

<div class="game-grid">
  {#each games as game (game.path)}
    <a href={resolve(game.path, {})} class="game-card">
      <span class="game-emoji">{game.emoji}</span>
      <h2>{game.name}</h2>
      <p>{game.description}</p>
    </a>
  {/each}
</div>

<style>
  h1 {
    margin-bottom: 1rem;
    font-size: 1.5rem;
  }

  .game-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 600px) {
    .game-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .game-card {
    display: block;
    background: #fff;
    border-radius: 12px;
    padding: 1.5rem;
    text-decoration: none;
    color: inherit;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }

  .game-card:active,
  .game-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .game-emoji {
    font-size: 2.5rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .game-card h2 {
    font-size: 1.25rem;
    margin-bottom: 0.25rem;
  }

  .game-card p {
    font-size: 0.875rem;
    color: #666;
  }
</style>
