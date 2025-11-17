<script lang="ts">
	let {
		currentPlayerName,
		turnNumber,
		totalTurns
	}: {
		currentPlayerName: string;
		turnNumber?: number;
		totalTurns?: number;
	} = $props();
</script>

<div class="current-player-banner">
	<div class="banner-content">
		<div class="turn-indicator">🎵</div>
		<div class="player-info">
			<div class="turn-label">It's</div>
			<div class="player-name">{currentPlayerName}'s Turn</div>
			{#if turnNumber !== undefined && totalTurns !== undefined}
				<div class="turn-count">Turn {turnNumber} of {totalTurns}</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.current-player-banner {
		background: linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 80%, black) 100%);
		color: var(--primary-foreground);
		padding: 1.5rem 2rem;
		border-radius: calc(var(--radius) - 2px);
		margin-bottom: 1.5rem;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		animation: slideIn 0.3s ease-out;
	}

	.banner-content {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		justify-content: center;
	}

	.turn-indicator {
		font-size: 2.5rem;
		animation: pulse 2s ease-in-out infinite;
	}

	.player-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.turn-label {
		font-size: 0.875rem;
		opacity: 0.9;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.player-name {
		font-size: 1.75rem;
		font-weight: bold;
		text-align: center;
	}

	.turn-count {
		font-size: 0.875rem;
		opacity: 0.8;
		margin-top: 0.25rem;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes pulse {
		0%, 100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	@media (max-width: 768px) {
		.current-player-banner {
			padding: 1rem 1.5rem;
		}

		.player-name {
			font-size: 1.5rem;
		}

		.turn-indicator {
			font-size: 2rem;
		}
	}
</style>

