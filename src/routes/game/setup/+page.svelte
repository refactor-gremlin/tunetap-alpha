<!--
@component

Game Setup Page - Player configuration before starting the game.

This page allows players to:
- Enter player names
- Configure game settings
- Start the game when enough playable tracks are available
-->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { useGamePageContext } from '$lib/game/GamePage.state.svelte.js';

	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import PlayerSetup from '$lib/components/custom/tunetap/common/controls/PlayerSetup.svelte';

	const ctx = useGamePageContext();

	const playableTracksCount = $derived(ctx.playableTracks.length);
	const hasTracks = $derived(ctx.tracks.length > 0);

	function handleStartGame() {
		ctx.initializeGame();
		ctx.saveToSession(true); // Save immediately before navigation
		goto('/game/play');
	}

	// Redirect to playlist if no tracks loaded
	$effect(() => {
		if (ctx.hasInitialized && !hasTracks) {
			goto('/playlist');
		}
	});
</script>

{#if !hasTracks}
	<div class="no-tracks-container">
		<Card.Root class="no-tracks">
			<Card.Header>
				<Card.Title>No Tracks Loaded</Card.Title>
			</Card.Header>
			<Card.Content>
				<p>Could not find any playable tracks. Please go back and load a different playlist.</p>
				<Button variant="link" href="/playlist">Back to Playlist Input</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div class="setup-container">
		<PlayerSetup
			playerNames={ctx.playerNames}
			{playableTracksCount}
			totalTracksCount={ctx.tracks.length}
			defaultAllowPartialStart={ctx.allowPartialStartPreference}
			onStartGame={handleStartGame}
		/>
	</div>
{/if}

<style>
	:global(.no-tracks) {
		max-width: 600px;
		margin: 2rem auto;
		text-align: center;
	}

	.no-tracks-container,
	.setup-container {
		min-height: 100vh;
		padding: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 1;
	}
</style>

