<script lang="ts">
	import type { GameStatus } from '$lib/types/tunetap.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

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
	<div class="needle-indicator"></div>
	<div
		class="drop-button-wrapper"
		class:visible={showDropButton && (activeGapIndex !== null || activeCardIndex !== null) && gameStatus === 'playing'}
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
			disabled={!showDropButton || (activeGapIndex === null && activeCardIndex === null) || gameStatus !== 'playing'}
		>
			{activeCardIndex !== null ? 'Same Year?' : 'Place Here'}
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
	}

	.drop-button-wrapper {
		position: absolute;
		top: var(--needle-button-top, -70px);
		left: calc(50% + var(--needle-horizontal-offset, 0px));
		transform: translateX(-50%) translateY(-10px);
		pointer-events: auto;
		opacity: 0;
		transition: opacity 0.2s ease, transform 0.2s ease;
		z-index: 41;
	}

	.drop-button-wrapper.visible {
		opacity: 1;
		transform: translateX(-50%) translateY(-10px);
	}
</style>
