<script lang="ts">
	import type { Player } from '$lib/types/tunetap.js';
	import type { Track } from '$lib/types.js';
	import { Badge } from '$lib/components/shadncn-ui/badge/index.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { useInterval } from 'runed';

	type QueueStatus = {
		pendingCount: number;
		estimatedTimeRemaining: number;
		timeRemainingString: string;
	};

	let {
		currentPlayer,
		players,
		currentPlayerIndex,
		turnNumber,
		totalTurns,
		currentTrack = null,
		isPlaying = false,
		onPlay,
		onStop,
		queueStatusFetcher = null,
		onQueueStatusUpdate
	}: {
		currentPlayer: Player;
		players: Player[];
		currentPlayerIndex: number;
		turnNumber?: number;
		totalTurns?: number;
		currentTrack?: Track | null;
		isPlaying?: boolean;
		onPlay?: () => void;
		onStop?: () => void;
		queueStatusFetcher?: (() => Promise<QueueStatus>) | null;
		onQueueStatusUpdate?: (status: QueueStatus) => void;
	} = $props();

	function getStatus(playerIndex: number): 'current' | 'next' | 'waiting' {
		if (playerIndex === currentPlayerIndex) return 'current';
		const nextIndex = (currentPlayerIndex + 1) % players.length;
		if (playerIndex === nextIndex) return 'next';
		return 'waiting';
	}

	let queueStatusPromise = $state<Promise<QueueStatus> | null>(null);
	let isFetchingQueueStatus = $state(false);
	const triggerQueueStatusFetch = () => {
		if (!queueStatusFetcher) return;
		if (isFetchingQueueStatus) return;
		isFetchingQueueStatus = true;
		const fetchPromise = queueStatusFetcher().then((status) => {
			onQueueStatusUpdate?.(status);
			return status;
		});
		queueStatusPromise = fetchPromise.finally(() => {
			isFetchingQueueStatus = false;
		});
	};

	const queueInterval = useInterval(1500, {
		immediate: false,
		callback: () => triggerQueueStatusFetch()
	});

	$effect(() => {
		if (!queueStatusFetcher) {
			queueInterval.pause();
			queueStatusPromise = null;
			return;
		}
		triggerQueueStatusFetch();
		queueInterval.resume();
	});
</script>

<div class="unified-header">
	<div class="header-main">
		<div class="player-section">
			<div class="turn-indicator">🎵</div>
			<div class="player-info">
				<div class="turn-label">It's</div>
				<div class="player-name">{currentPlayer.name}'s Turn</div>
				<div class="turn-hint">Pass the device to continue</div>
				{#if turnNumber !== undefined && totalTurns !== undefined}
					<div class="turn-count">Turn {turnNumber} of {totalTurns}</div>
				{/if}
			</div>
		</div>
		<div class="controls-section">
			{#if currentTrack && onPlay && onStop}
				<div class="play-controls">
					<Button
						size="sm"
						variant="secondary"
						onclick={onPlay}
						disabled={isPlaying}
						class="play-button"
					>
						{isPlaying ? '⏸ Pause' : '▶ Play'}
					</Button>
					<Button size="sm" variant="outline" onclick={onStop} class="stop-button">⏹ Stop</Button>
				</div>
			{/if}
			{#if queueStatusPromise}
				<div class="queue-status">
					<svelte:boundary>
						{#await queueStatusPromise}
							<div class="queue-badge">
								<Badge variant="outline">Queue updating…</Badge>
							</div>
					{:then status}
							<div class="queue-badge">
								<Badge variant="secondary">Queue: {status.pendingCount}</Badge>
							</div>
						{:catch error}
							<div class="queue-badge">
								<Badge variant="destructive">Queue error</Badge>
							</div>
						{/await}
					</svelte:boundary>
				</div>
			{/if}
			<div class="scores-section">
				{#each players as player, index}
					{@const status = getStatus(index)}
					<div
						class="player-badge"
						class:current={status === 'current'}
						class:next={status === 'next'}
					>
						<span class="badge-name">{player.name}</span>
						<Badge
							variant={status === 'current'
								? 'default'
								: status === 'next'
									? 'secondary'
									: 'outline'}
							class="score-badge"
						>
							{player.score}/10
						</Badge>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.unified-header {
		background: linear-gradient(
			135deg,
			var(--primary) 0%,
			color-mix(in oklch, var(--primary) 80%, black) 100%
		);
		color: var(--primary-foreground);
		padding: 1rem 1.5rem;
		border-radius: calc(var(--radius) - 2px);
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 4px -1px rgb(0 0 0 / 0.1);
	}

	.header-main {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
		flex-wrap: wrap;
	}

	.player-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1;
		min-width: 200px;
	}

	.turn-indicator {
		font-size: 2rem;
		animation: pulse 2s ease-in-out infinite;
	}

	.player-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.turn-label {
		font-size: 0.75rem;
		opacity: 0.9;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.player-name {
		font-size: 1.5rem;
		font-weight: bold;
		line-height: 1.2;
	}

	.turn-hint {
		font-size: 0.75rem;
		opacity: 0.9;
	}

	.turn-count {
		font-size: 0.875rem;
		opacity: 0.8;
	}

	.controls-section {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.queue-status {
		display: flex;
		align-items: center;
	}

	.queue-badge {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.play-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.play-controls :global(button) {
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		height: auto;
		background-color: color-mix(in oklch, var(--primary-foreground) 20%, transparent);
		border-color: color-mix(in oklch, var(--primary-foreground) 40%, transparent);
		color: var(--primary-foreground);
	}

	.play-controls :global(button:hover:not(:disabled)) {
		background-color: color-mix(in oklch, var(--primary-foreground) 30%, transparent);
	}

	.play-controls :global(button:disabled) {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.scores-section {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		align-items: center;
		width: 100%;
		overflow-x: auto;
		padding-bottom: 0.25rem;
	}

	.player-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		background-color: color-mix(in oklch, var(--primary-foreground) 15%, transparent);
		border-radius: calc(var(--radius) - 4px);
		border: 2px solid transparent;
		transition: all 0.2s ease;
	}

	.player-badge.current {
		border-color: var(--primary-foreground);
		background-color: color-mix(in oklch, var(--primary-foreground) 25%, transparent);
	}

	.player-badge.next {
		opacity: 0.85;
	}

	.badge-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--primary-foreground);
		white-space: nowrap;
	}

	:global(.score-badge) {
		font-weight: bold;
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	@media (max-width: 768px) {
		.unified-header {
			padding: 1rem;
		}

		.header-main {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.player-section {
			width: 100%;
		}

		.player-name {
			font-size: 1.25rem;
		}

		.turn-indicator {
			font-size: 1.75rem;
		}

		.controls-section {
			width: 100%;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.play-controls {
			width: 100%;
		}

		.play-controls :global(button) {
			flex: 1;
		}

		.scores-section {
			width: 100%;
			justify-content: flex-start;
		}

		.player-badge {
			flex: 1;
			min-width: 0;
		}

		.badge-name {
			font-size: 0.8125rem;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>
