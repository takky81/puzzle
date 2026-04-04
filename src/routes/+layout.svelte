<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { base } from '$app/paths';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="description" content="パズル & ゲーム コレクション" />
</svelte:head>

<header>
	<nav>
		<a href="{base}/" class="logo">Puzzle & Games</a>
	</nav>
</header>

<main>
	{@render children()}
</main>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #f5f5f5;
		color: #333;
		min-height: 100dvh;
	}

	header {
		background: #2c3e50;
		padding: 0.75rem 1rem;
	}

	nav {
		max-width: 800px;
		margin: 0 auto;
	}

	.logo {
		color: #fff;
		text-decoration: none;
		font-size: 1.25rem;
		font-weight: bold;
	}

	main {
		max-width: 800px;
		margin: 0 auto;
		padding: 1rem;
	}
</style>
