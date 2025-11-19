<script lang="ts">
	import TimelineReel from '$lib/components/custom/tunetap/desktop/timeline/TimelineReel.svelte';
	import Needle from '$lib/components/custom/tunetap/desktop/needle/Needle.svelte';
	import { onMount } from 'svelte';

	let timelineReel: HTMLDivElement | null = $state(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

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
</script>

<div class="repro-container">
	<div class="needle-container">
		<Needle 
			showDropButton={true} 
			activeGapIndex={0} 
			activeCardIndex={null} 
			gameStatus="playing"
			onPlaceFromGap={() => {}}
			onPlaceSameYear={() => {}}
		/>
	</div>
	
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

	.needle-container {
		position: absolute;
		top: 50%;
		left: 0;
		width: 100%;
		transform: translateY(-50%);
		z-index: 100;
		pointer-events: none;
	}
</style>
