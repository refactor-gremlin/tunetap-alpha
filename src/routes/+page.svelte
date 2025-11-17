<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import DarkModeToggle from '$lib/components/custom/DarkModeToggle.svelte';

	function startGame() {
		goto('/playlist');
	}
</script>

<div class="homepage">
	<div class="header-left">
		<DarkModeToggle />
	</div>
	<h1>Welcome to TuneTap</h1>
	<p>Test your music knowledge with your favorite Spotify playlists!</p>
	<Button size="lg" onclick={startGame}>Start Game</Button>
</div>

<style>
	.homepage {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 2rem;
		text-align: center;
		position: relative;
	}

	.header-left {
		position: absolute;
		top: 2rem;
		left: 2rem;
	}

	h1 {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	p {
		font-size: 1.25rem;
		margin-bottom: 2rem;
		color: var(--muted-foreground);
	}
</style>
