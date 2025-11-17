<script lang="ts">
	import type { Track } from '$lib/types.js';
	import { getReleaseYear, calculateTimelinePosition } from '$lib/utils/timeline.js';
	import TimelineTrackChip from './TimelineTrackChip.svelte';

	let {
		tracks,
		showReleaseDates = false,
		minYear,
		maxYear,
		selectedTrackIndex = null as number | null,
		width = 100,
		showSongName = false,
		showArtistName = false,
		onTrackClick
	}: {
		tracks: Track[];
		showReleaseDates?: boolean;
		minYear: number;
		maxYear: number;
		selectedTrackIndex?: number | null;
		width?: number;
		showSongName?: boolean;
		showArtistName?: boolean;
		onTrackClick?: (index: number) => void;
	} = $props();

	function getTrackPosition(track: Track): number {
		const year = getReleaseYear(track);
		if (year === null) return 0;
		return calculateTimelinePosition(year, minYear, maxYear);
	}
</script>

<div class="timeline-container">
	<div class="timeline-track-container" style="width: {width}%">
		{#each tracks as track, index}
			{@const position = getTrackPosition(track)}
			<div
				class="track-position"
				style="left: {position}%"
			>
				<TimelineTrackChip
					{track}
					showReleaseDate={true}
					isSelected={selectedTrackIndex === index}
					showSongName={showSongName || index === 0}
					showArtistName={showArtistName || index === 0}
					onClick={onTrackClick && !showReleaseDates ? () => onTrackClick(index) : undefined}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.timeline-container {
		position: relative;
		min-width: 100%; /* At least 100% wide, but can expand */
		padding: 0.25rem 0;
		overflow-y: hidden;
		height: 120px; /* Fixed height to prevent vertical scrolling */
		/* No overflow-x set - parent .timeline-wrapper handles scrolling */
	}

	.timeline-track-container {
		position: relative;
		width: 100%;
		height: 100%;
		/* Padding accounts for half card width (40px) to ensure cards at edges are fully visible */
		padding-left: 40px;
		padding-right: 40px;
		box-sizing: border-box;
		min-width: 100%; /* Ensure it's at least as wide as container */
	}

	.track-position {
		position: absolute;
		transform: translateX(-50%);
		top: 0;
		transition: all 0.3s ease;
		max-height: 100%;
		display: flex;
		align-items: flex-start;
	}

	/* Ensure tracks don't overlap */
	.track-position:hover {
		z-index: 10;
	}

	@media (max-width: 768px) {
		.timeline-container {
			height: 110px;
		}
		.timeline-track-container {
			padding: 0 35px;
		}
	}
</style>
