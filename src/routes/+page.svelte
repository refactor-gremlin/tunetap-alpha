<script lang="ts">
	import { goto } from '$app/navigation';

	function startGame() {
		goto('/playlist');
	}
</script>

<div class="homepage">
	<h1>Welcome to TuneTap</h1>
	<p>Test your music knowledge with your favorite Spotify playlists!</p>
	<button onclick={startGame}>Start Game</button>
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
	}

	h1 {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	p {
		font-size: 1.25rem;
		margin-bottom: 2rem;
		color: #666;
	}

	button {
		padding: 1rem 2rem;
		font-size: 1.25rem;
		background-color: #1db954;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	button:hover {
		background-color: #1ed760;
	}
</style>
