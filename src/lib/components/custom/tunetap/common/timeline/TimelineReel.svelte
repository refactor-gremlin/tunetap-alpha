<script lang="ts">
	import type { Track } from '$lib/types.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import TimelineCard from './TimelineCard.svelte';

	type TimelineItem = {
		type: 'card' | 'gap';
		track?: Track;
		index?: number;
		gapIndex?: number;
		sameYearCount?: number;
	};

	let {
		timelineReel = $bindable(null),
		timelineItems,
		canScrollLeft = false,
		canScrollRight = false,
		showSongName = false,
		showArtistName = false,
		showReleaseDates = false,
		onScrollLeft,
		onScrollRight
	}: {
		timelineReel?: HTMLDivElement | null;
		timelineItems: TimelineItem[];
		canScrollLeft?: boolean;
		canScrollRight?: boolean;
		showSongName?: boolean;
		showArtistName?: boolean;
		showReleaseDates?: boolean;
		onScrollLeft: () => void;
		onScrollRight: () => void;
	} = $props();
</script>

<!-- Zone C: The Timeline Reel (Bottom Flex) -->
<div class="zone-c-timeline-wrapper">
	<!-- Navigation Buttons -->
	<Button
		class="timeline-nav-button timeline-nav-left"
		variant="outline"
		size="icon"
		onclick={onScrollLeft}
		disabled={!canScrollLeft}
		aria-label="Scroll timeline left"
	>
		<ArrowLeftIcon class="size-4" />
	</Button>

	<div class="zone-c-timeline-reel" bind:this={timelineReel}>
		{#if timelineItems.length === 0}
			<!-- Empty state - show at least one gap -->
			<div class="timeline-gap" data-gap-index="0">
				<div class="gap-marker"></div>
			</div>
		{:else}
			{#each timelineItems as item, i}
				{#if item.type === 'card' && item.track}
					<TimelineCard {item} {showSongName} {showArtistName} />
				{/if}
				{#if item.type === 'gap'}
					<div class="timeline-gap" data-gap-index={item.gapIndex ?? 0}>
						<div class="gap-marker"></div>
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	<Button
		class="timeline-nav-button timeline-nav-right"
		variant="outline"
		size="icon"
		onclick={onScrollRight}
		disabled={!canScrollRight}
		aria-label="Scroll timeline right"
	>
		<ArrowRightIcon class="size-4" />
	</Button>
</div>

<style>
	.zone-c-timeline-wrapper {
		flex: 1;
		position: relative;
		display: flex;
		min-height: 0;
		min-width: 0;
		width: 100%;
		box-sizing: border-box;
		overflow: hidden; /* Prevent buttons from causing scroll on parent */
	}

	.zone-c-timeline-reel {
		flex: 1;
		display: flex;
		flex-direction: row;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		width: 100%;
		/* FIX: Explicit border-box to handle padding correctly */
		box-sizing: border-box;
		/* FIX: Use gap instead of margins */
		gap: 1rem;
		/* FIX: Exact center calc. Use CSS var for gap width. */
		padding: 0 calc(50% - (var(--timeline-gap-width, 120px) / 2)) 0;
		align-items: flex-start;
		position: relative;
		z-index: 10;
		-webkit-overflow-scrolling: touch;
		scroll-behavior: smooth;
		min-height: 0;
		min-width: 0;
		background: color-mix(in oklch, var(--background) 95%, transparent);
		touch-action: pan-x;
	}

	.zone-c-timeline-reel::before {
		content: '';
		position: absolute;
		top: calc(1rem + 75px);
		left: 0;
		right: 0;
		height: 2px;
		background: color-mix(in oklch, var(--muted) 20%, transparent);
		z-index: -1;
		pointer-events: none;
	}

	.timeline-gap {
		flex: 0 0 var(--timeline-gap-width, 120px);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		scroll-snap-align: center;
		position: relative;
		/* FIX: Remove margin, let gap handle it */
		margin: 0;
		width: var(--timeline-gap-width, 120px);
		min-width: var(--timeline-gap-width, 120px);
		height: 100%;
		min-height: 80px;
		pointer-events: auto;
	}

	.gap-marker {
		width: 2px;
		height: 100%; /* Fill the height */
		background: var(--gap-marker);
		border-radius: 1px;
		transition:
			width 0.2s ease,
			background 0.2s ease,
			box-shadow 0.2s ease;
		margin-top: 0; /* Remove negative margin if using flex alignment */
	}

	.timeline-gap.active .gap-marker {
		width: 4px;
		background: var(--gap-marker-active);
		box-shadow: 0 0 12px var(--gap-marker-active);
	}

	/* Hide scrollbar */
	.zone-c-timeline-reel::-webkit-scrollbar {
		display: none;
	}

	.zone-c-timeline-reel {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	/* Timeline Navigation Buttons */
	.timeline-nav-button {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		z-index: 50;
		background: var(--background);
		border: 2px solid var(--border);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		pointer-events: auto;
		transition:
			opacity 0.2s ease,
			transform 0.2s ease,
			background-color 0.2s ease;
	}

	.timeline-nav-button:hover:not(:disabled) {
		background: var(--accent);
		transform: translateY(-50%) scale(1.05);
	}

	.timeline-nav-button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.timeline-nav-left {
		left: 1rem;
	}

	.timeline-nav-right {
		right: 1rem;
	}
</style>
