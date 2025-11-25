<!--
@component

The Needle component provides the central UI element for track placement in the timeline game interface.
It displays a needle indicator and a drop button for placing tracks either in gaps or on the same year.

Usage:
  ```html
  <Needle
    showDropButton={showDropButton}
    activeGapIndex={activeGapIndex}
    activeCardIndex={activeCardIndex}
    gameStatus={gameStatus}
    onPlaceFromGap={handlePlaceFromGap}
    onPlaceSameYear={handlePlaceSameYear}
  />
  ```
-->
<script lang="ts">
	import type { GameStatus } from '$lib/types/tunetap.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import TargetIcon from '@lucide/svelte/icons/target';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';

	let {
		showDropButton = false,
		activeGapIndex = null,
		activeCardIndex = null,
		gameStatus,
		onPlaceFromGap,
		onPlaceSameYear
	}: {
		showDropButton?: boolean;
		activeGapIndex?: number | null;
		activeCardIndex?: number | null;
		gameStatus: GameStatus;
		onPlaceFromGap: (gapIndex: number) => void;
		onPlaceSameYear: (cardIndex: number) => void;
	} = $props();
</script>

<!-- Zone B: The Needle (Middle Anchor) -->
<div class="zone-b-needle">
	<div class="needle-indicator" class:active={showDropButton && (activeGapIndex !== null || activeCardIndex !== null)}></div>
	<div
		class="drop-button-wrapper"
		class:visible={showDropButton &&
			(activeGapIndex !== null || activeCardIndex !== null) &&
			gameStatus === 'playing'}
	>
		<Button
			size="lg"
			onclick={() => {
				if (activeCardIndex !== null) {
					onPlaceSameYear(activeCardIndex);
				} else if (activeGapIndex !== null) {
					onPlaceFromGap(activeGapIndex);
				}
			}}
			disabled={!showDropButton ||
				(activeGapIndex === null && activeCardIndex === null) ||
				gameStatus !== 'playing'}
			class="place-button"
		>
			{#if activeCardIndex !== null}
				<TargetIcon size={18} aria-hidden="true" /> Same Year?
			{:else}
				<MapPinIcon size={18} aria-hidden="true" /> Place Here
			{/if}
		</Button>
	</div>
</div>

<style>
	.zone-b-needle {
		flex: 0 0 var(--needle-height, 80px);
		position: relative;
		z-index: 40;
		pointer-events: none;
		display: flex;
		width: 100%;
		/* Removed justify-content: center to use absolute positioning for precision */
	}

	.needle-indicator {
		position: absolute;
		left: calc(50% + var(--needle-horizontal-offset, 0px));
		bottom: 0;
		width: var(--needle-width, 5px);
		height: var(--needle-indicator-height, 50px);
		background: var(--needle-color);
		border-radius: 2px;
		box-shadow: 0 0 10px var(--needle-color);
		/* Translate X -50% ensures the center of the needle aligns with left: 50% */
		transform: translateX(-50%) translateY(2px);
		transition:
			width 0.15s ease,
			box-shadow 0.15s ease;
	}

	.needle-indicator.active {
		width: calc(var(--needle-width, 5px) * 1.5);
		box-shadow: 0 0 20px var(--needle-color), 0 0 40px var(--needle-color);
		animation: pulse-glow 1s ease-in-out infinite;
	}

	@keyframes pulse-glow {
		0%,
		100% {
			box-shadow: 0 0 20px var(--needle-color), 0 0 40px var(--needle-color);
		}
		50% {
			box-shadow: 0 0 30px var(--needle-color), 0 0 60px var(--needle-color);
		}
	}

	.drop-button-wrapper {
		position: absolute;
		top: var(--needle-button-top, -70px);
		left: calc(50% + var(--needle-horizontal-offset, 0px));
		transform: translateX(-50%) translateY(-10px);
		pointer-events: auto;
		opacity: 0;
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
		z-index: 41;
	}

	.drop-button-wrapper.visible {
		opacity: 1;
		transform: translateX(-50%) translateY(-10px);
	}

	:global(.place-button) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		animation: button-pop 0.2s ease-out;
	}

	@keyframes button-pop {
		0% {
			transform: scale(0.9);
		}
		50% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.needle-indicator.active,
		:global(.place-button) {
			animation: none;
		}
	}
</style>
