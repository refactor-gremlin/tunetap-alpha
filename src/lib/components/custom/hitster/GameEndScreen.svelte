<script lang="ts">
	import type { Player } from '$lib/types/hitster.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';

	let {
		players,
		winner,
		onRestart
	}: {
		players: Player[];
		winner: Player | null | undefined;
		onRestart: () => void;
	} = $props();
</script>

<Card.Root class="game-end-card">
	<Card.Header>
		<Card.Title>Game Over!</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="game-end-content">
			{#if winner}
				<h2 class="winner">🎉 {winner.name} Wins! 🎉</h2>
				<p class="winner-score">Score: {winner.score}/10</p>
			{/if}
			<div class="final-scores">
				<h3>Final Scores:</h3>
				{#each players as player}
					<div class="score-item" class:winner={winner?.name === player.name}>
						<span class="player-name">{player.name}</span>
						<span class="score">{player.score}/10</span>
					</div>
				{/each}
			</div>
			<div class="game-end-actions">
				<Button onclick={onRestart} size="lg">New Game</Button>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<style>
	.game-end-card {
		max-width: 600px;
		margin: 2rem auto;
	}

	.game-end-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		text-align: center;
	}

	.winner {
		font-size: 2rem;
		margin: 0;
		color: var(--primary);
	}

	.winner-score {
		font-size: 1.5rem;
		margin: 0;
		font-weight: 600;
	}

	.final-scores {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.final-scores h3 {
		margin: 0;
		font-size: 1.25rem;
		color: var(--foreground);
	}

	.score-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background-color: var(--muted);
		border-radius: calc(var(--radius) - 2px);
		border: 2px solid transparent;
		transition: all 0.2s ease;
	}

	.score-item.winner {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 15%, transparent);
	}

	.player-name {
		font-weight: 500;
		font-size: 1.125rem;
	}

	.score-item.winner .player-name {
		font-weight: 700;
	}

	.score {
		font-weight: bold;
		font-size: 1.25rem;
		color: var(--primary);
	}

	.game-end-actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 1rem;
	}
</style>

