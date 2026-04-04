<script lang="ts">
  import { resolve } from '$app/paths';
</script>

<svelte:head>
  <title>オセロ - Puzzle & Games</title>
</svelte:head>

<a href={resolve('/', {})} class="back">&larr; 戻る</a>
<h1>オセロ</h1>
<p class="wip">準備中...</p>

<style>
  .back {
    display: inline-block;
    margin-bottom: 1rem;
    color: #2c3e50;
    text-decoration: none;
  }

  h1 {
    margin-bottom: 0.5rem;
  }

  .wip {
    color: #999;
    font-size: 1.125rem;
  }
</style>
