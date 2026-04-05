<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import { resolve } from '$app/paths';
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <meta name="description" content="パズル & ゲーム コレクション" />
</svelte:head>

<header class="bg-primary px-4 py-3">
  <nav class="mx-auto max-w-[800px]">
    <a href={resolve('/', {})} class="text-xl font-bold text-white no-underline">Puzzle & Games</a>
  </nav>
</header>

<main class="mx-auto max-w-[800px] p-4">
  {@render children()}
</main>

<style>
  :global(body) {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--color-base-bg);
    color: var(--color-base-text);
    min-height: 100dvh;
  }
</style>
