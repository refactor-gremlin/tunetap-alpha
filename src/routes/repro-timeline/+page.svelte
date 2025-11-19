<script lang="ts">
	import TimelineReel from '$lib/components/custom/tunetap/common/timeline/TimelineReel.svelte';
	import Needle from '$lib/components/custom/tunetap/common/needle/Needle.svelte';

	let timelineReel: HTMLDivElement | null = $state(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);
	let needleOverlayEl: HTMLDivElement | null = $state(null);
	let needleHorizontalOffset = $state(0);

	const timelineItems = [
		{ type: 'gap', gapIndex: 0 },
		{ 
			type: 'card', 
			index: 0, 
			track: { 
				name: 'Test Track 1', 
				artists: ['Artist 1'], 
				firstReleaseDate: '2000-01-01',
				coverImage: null
			} 
		},
		{ type: 'gap', gapIndex: 1 },
		{ 
			type: 'card', 
			index: 1, 
			track: { 
				name: 'Test Track 2', 
				artists: ['Artist 2'], 
				firstReleaseDate: '2005-01-01',
				coverImage: null
			} 
		},
		{ type: 'gap', gapIndex: 2 }
	];

	function updateScrollState() {
		if (!timelineReel) return;
		const { scrollLeft, scrollWidth, clientWidth } = timelineReel;
		canScrollLeft = scrollLeft > 0;
		canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
	}

	function scrollTimelineLeft() {
		if (!timelineReel) return;
		timelineReel.scrollBy({ left: -150, behavior: 'smooth' });
	}

	function scrollTimelineRight() {
		if (!timelineReel) return;
		timelineReel.scrollBy({ left: 150, behavior: 'smooth' });
	}

	$effect(() => {
		if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
		if (!timelineReel || !needleOverlayEl) return;

		const updateNeedleOffset = () => {
			const reelRect = timelineReel?.getBoundingClientRect();
			const overlayRect = needleOverlayEl?.getBoundingClientRect();
			if (!reelRect || !overlayRect) return;
			needleHorizontalOffset =
				reelRect.left + reelRect.width / 2 - (overlayRect.left + overlayRect.width / 2);
		};

		updateNeedleOffset();
		const resizeObserver = new ResizeObserver(() => updateNeedleOffset());
		resizeObserver.observe(timelineReel);
		resizeObserver.observe(needleOverlayEl);
		window.addEventListener('resize', updateNeedleOffset);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateNeedleOffset);
		};
	});
</script>

	<div class="repro-container">
		<div class="repro-timeline-zone">
		<TimelineReel
			bind:timelineReel
			{timelineItems}
			{canScrollLeft}
			{canScrollRight}
			showSongName={true}
			showArtistName={true}
			showReleaseDates={true}
			onScrollLeft={scrollTimelineLeft}
			onScrollRight={scrollTimelineRight}
		/>

		<div
			class="needle-overlay"
			bind:this={needleOverlayEl}
			style={`--needle-horizontal-offset: ${needleHorizontalOffset}px;`}
		>
			<Needle 
				showDropButton={true} 
				activeGapIndex={0} 
				activeCardIndex={null} 
				gameStatus="playing"
				onPlaceFromGap={() => {}}
				onPlaceSameYear={() => {}}
			/>
		</div>
	</div>
</div>

<style>
	.repro-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100vw;
		justify-content: center;
		background: #f0f0f0;
		position: relative;
	}

	.repro-timeline-zone {
		--needle-overlay-height: 120px;
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		padding-top: var(--needle-overlay-height);
	}

	.repro-timeline-zone > :global(.zone-c-timeline-wrapper) {
		flex: 1;
	}

	.needle-overlay {
		pointer-events: none;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: var(--needle-overlay-height);
	}

	.needle-overlay :global(.zone-b-needle) {
		pointer-events: none;
	}

	.needle-overlay :global(.drop-button-wrapper) {
		pointer-events: auto;
	}
</style>
