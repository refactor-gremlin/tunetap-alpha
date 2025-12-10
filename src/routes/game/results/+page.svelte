<!--
@component

Game Results Page - End game screen showing winner and final scores.

This page displays:
- The winner announcement
- Final scores for all players
- Option to restart with a new playlist
-->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { useGamePageContext } from '$lib/game/GamePage.state.svelte.js';
	import { clearSession } from '$lib/game/GameSession.store';

	import GameEndScreen from '$lib/components/custom/tunetap/common/dialogs/GameEndScreen.svelte';

	const ctx = useGamePageContext();

	const players = $derived(ctx.gameEngine?.players ?? []);
	const winner = $derived(ctx.gameEngine?.winner);
	const gameStatus = $derived(ctx.gameEngine?.gameStatus ?? 'setup');

	function handleRestart() {
		clearSession();
		goto('/playlist');
	}

	// Redirect to play if game hasn't ended
	$effect(() => {
		if (ctx.hasInitialized && gameStatus !== 'gameEnd') {
			if (gameStatus === 'setup') {
				goto('/game/setup');
			} else {
				goto('/game/play');
			}
		}
	});
</script>

<div class="game-end-container">
	<GameEndScreen {players} {winner} onRestart={handleRestart} />
</div>

<style>
	.game-end-container {
		min-height: 100vh;
		padding: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 1;
	}
</style>

