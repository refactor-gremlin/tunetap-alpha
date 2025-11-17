<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import PageHeader from '$lib/components/custom/PageHeader.svelte';

	function startGame() {
		goto('/playlist');
	}
</script>

<PageHeader />
<div class="homepage-content">
	<h1>Welcome to TuneTap</h1>
	<p class="subtitle">Test your music knowledge with your favorite Spotify playlists!</p>
	<Button size="lg" onclick={startGame}>Start Game</Button>
</div>

<style>
	.homepage-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 1.5rem;
		flex: 1;
		min-height: 0;
	}
	
	.homepage-content h1 {
		margin-bottom: 0.5rem;
	}
	
	.homepage-content p {
		margin-bottom: 0;
	}
</style>
