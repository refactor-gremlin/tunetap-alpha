<script lang="ts">
	import type { Player } from '$lib/types/tunetap.js';
	import { Badge } from '$lib/components/shadncn-ui/badge/index.js';
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';

	let {
		players,
		currentPlayerIndex
	}: {
		players: Player[];
		currentPlayerIndex: number;
	} = $props();

	function getStatus(playerIndex: number): 'current' | 'next' | 'waiting' {
		if (playerIndex === currentPlayerIndex) return 'current';
		const nextIndex = (currentPlayerIndex + 1) % players.length;
		if (playerIndex === nextIndex) return 'next';
		return 'waiting';
	}
</script>

<div class="scoreboard">
	<div class="scoreboard-header">
		<h3>Scores</h3>
	</div>
	<div class="players-list">
		{#each players as player, index}
			{@const status = getStatus(index)}
			<div class="player-score" class:current={status === 'current'} class:next={status === 'next'}>
				<div class="player-header">
					<span class="player-name">{player.name}</span>
					<Badge variant={status === 'current' ? 'default' : status === 'next' ? 'secondary' : 'outline'}>
						{status === 'current' ? 'Current' : status === 'next' ? 'Next' : 'Waiting'}
					</Badge>
				</div>
				<div class="score-info">
					<span class="score-value">{player.score}/10</span>
					<Progress value={(player.score / 10) * 100} class="score-progress" />
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.scoreboard {
		background-color: var(--muted);
		border-radius: calc(var(--radius) - 2px);
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.scoreboard-header {
		margin-bottom: 1rem;
	}

	.scoreboard-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.players-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.player-score {
		padding: 0.75rem;
		background-color: var(--background);
		border-radius: calc(var(--radius) - 4px);
		border: 2px solid transparent;
		transition: all 0.2s ease;
	}

	.player-score.current {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 10%, transparent);
	}

	.player-score.next {
		border-color: var(--muted-foreground);
		opacity: 0.8;
	}

	.player-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.player-name {
		font-weight: 600;
		color: var(--foreground);
	}

	.score-info {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.score-value {
		font-weight: bold;
		font-size: 1.125rem;
		color: var(--primary);
		min-width: 3rem;
	}

	.score-progress {
		flex: 1;
		height: 8px;
	}

	@media (max-width: 768px) {
		.scoreboard {
			padding: 0.75rem;
		}

		.player-score {
			padding: 0.5rem;
		}

		.score-value {
			font-size: 1rem;
			min-width: 2.5rem;
		}
	}
</style>

