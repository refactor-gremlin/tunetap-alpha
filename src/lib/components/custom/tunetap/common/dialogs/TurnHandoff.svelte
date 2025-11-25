<!--
@component

Full-screen interstitial shown between turns to facilitate device handoff in local multiplayer.
Ensures the next player doesn't accidentally see the previous player's track info.

Usage:
  ```html
  <TurnHandoff
    nextPlayer={nextPlayer}
    onReady={handleReady}
  />
  ```
-->
<script lang="ts">
	import type { Player } from '$lib/types/tunetap.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';

	let {
		nextPlayer,
		turnNumber = 1,
		onReady
	}: {
		nextPlayer: Player;
		turnNumber?: number;
		onReady: () => void;
	} = $props();

	const titleId = 'handoff-title';

	const reducedMotion = $derived(prefersReducedMotion.current);
	const overlayFadeDuration = $derived(reducedMotion ? 0 : 200);
	const handoffFly = $derived(
		reducedMotion ? { duration: 0, y: 0 } : { y: 30, duration: 400, easing: cubicOut }
	);

</script>

<div
	class="handoff-overlay"
	role="dialog"
	aria-modal="true"
	aria-labelledby={titleId}
	transition:fade={{ duration: overlayFadeDuration }}
>
	<div class="handoff-content" in:fly={handoffFly}>
		<div class="handoff-icon">🎵</div>
		<h1 class="handoff-title" id={titleId}>Pass the device to</h1>
		<h2 class="player-name">{nextPlayer.name}</h2>
		<p class="handoff-subtitle">Get ready for turn {turnNumber}!</p>
		
		<div class="player-score">
			<span class="score-label">Current Score</span>
			<span class="score-value">{nextPlayer.score}/10</span>
		</div>

		<Button size="lg" onclick={onReady} class="ready-button" autofocus>
			I'm {nextPlayer.name} — Start My Turn
		</Button>

		<p class="handoff-hint">
			Don't peek! The next track will be revealed after you tap the button.
		</p>
	</div>
</div>

<style>
	.handoff-overlay {
		position: fixed;
		inset: 0;
		background: var(--background);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.handoff-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 400px;
		gap: 1rem;
	}

	.handoff-icon {
		font-size: 4rem;
		animation: pulse 2s ease-in-out infinite;
	}

	.handoff-title {
		font-size: 1.25rem;
		color: var(--muted-foreground);
		margin: 0;
		font-weight: 400;
	}

	.player-name {
		font-size: 2.5rem;
		color: var(--primary);
		margin: 0;
		font-weight: 700;
	}

	.handoff-subtitle {
		font-size: 1rem;
		color: var(--muted-foreground);
		margin: 0;
	}

	.player-score {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem 2rem;
		background: var(--muted);
		border-radius: var(--radius);
		margin: 1rem 0;
	}

	.score-label {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.score-value {
		font-size: 1.75rem;
		font-weight: 700;
		color: var(--foreground);
	}

	:global(.ready-button) {
		width: 100%;
		font-size: 1.125rem;
		padding: 1.5rem 2rem;
		margin-top: 1rem;
	}

	.handoff-hint {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin: 1rem 0 0 0;
		opacity: 0.8;
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

	@media (prefers-reduced-motion: reduce) {
		.handoff-icon {
			animation: none;
		}
	}
</style>
