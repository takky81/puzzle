<script lang="ts">
  import { onMount } from 'svelte';
  import { base, resolve } from '$app/paths';
  import { loadPuzzleList } from '$lib/numberlink/stageLoader';
  import type { PuzzleEntry } from '$lib/numberlink/types';

  const LS_KEY = 'nl_cleared';
  const SIZES = [4, 5, 6];

  let selectedSize = $state(4);
  let puzzles = $state<PuzzleEntry[]>([]);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let clearedIds = $state(new Set<string>());

  let clearedCount = $derived(puzzles.filter((p) => clearedIds.has(p.id)).length);

  function loadCleared() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      clearedIds = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      clearedIds = new Set();
    }
  }

  async function loadList(size: number) {
    loading = true;
    loadError = null;
    try {
      puzzles = await loadPuzzleList(size, base, fetch);
      loading = false;
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      loading = false;
    }
  }

  onMount(() => {
    loadCleared();
    loadList(selectedSize);
  });

  function handleSelectSize(size: number) {
    selectedSize = size;
    loadList(size);
  }
</script>

<svelte:head>
  <title>ナンバーリンク - Puzzle & Games</title>
</svelte:head>

<div class="numberlink mx-auto max-w-[480px]">
  <h1 class="mb-4 text-3xl font-bold text-primary">ナンバーリンク</h1>

  <div class="mb-4 flex items-center gap-2">
    <span class="text-sm text-gray-600">サイズ:</span>
    {#each SIZES as s (s)}
      <button
        class="cursor-pointer rounded border-2 border-[var(--c-accent)] px-3 py-1 text-sm font-bold {selectedSize ===
        s
          ? 'bg-[var(--c-accent)] text-white'
          : 'bg-white text-[var(--c-accent)]'}"
        onclick={() => handleSelectSize(s)}
      >
        {s}×{s}
      </button>
    {/each}
  </div>

  {#if loading}
    <p class="text-center text-sm text-gray-500">読み込み中...</p>
  {:else if loadError}
    <p class="text-center text-sm text-red-600">読み込みに失敗しました: {loadError}</p>
  {:else}
    <p class="mb-3 text-sm text-gray-500">
      {puzzles.length} 問 （クリア済み: {clearedCount} 問）
    </p>
    <div class="flex flex-wrap gap-2">
      {#each puzzles as puzzle, i (puzzle.id)}
        {@const cleared = clearedIds.has(puzzle.id)}
        <a
          href="{resolve('/numberlink/play', {})}?size={selectedSize}&id={puzzle.id}"
          class="flex h-10 w-10 items-center justify-center rounded text-sm font-bold text-white no-underline {cleared
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-gray-400 hover:bg-gray-500'}"
        >
          {i + 1}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .numberlink {
    --c-accent: #3b82f6;
  }
</style>
