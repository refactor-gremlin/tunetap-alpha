<script lang="ts">
	import type { Track } from '$lib/types.js';
	import { getReleaseYear, calculateTimelinePosition } from '$lib/utils/timeline.js';
	import TrackCard from './TrackCard.svelte';

	let {
		tracks,
		showReleaseDates = false,
		minYear,
		maxYear,
		showPlacementButtons = false,
		selectedTrackIndex = null as number | null,
		selectedPlacementType = null as 'before' | 'after' | null,
		width = 100,
		showSongName = false,
		showArtistName = false,
		onPlaceBefore,
		onPlaceAfter
	}: {
		tracks: Track[];
		showReleaseDates?: boolean;
		minYear: number;
		maxYear: number;
		showPlacementButtons?: boolean;
		selectedTrackIndex?: number | null;
		selectedPlacementType?: 'before' | 'after' | null;
		width?: number;
		showSongName?: boolean;
		showArtistName?: boolean;
		onPlaceBefore?: (index: number) => void;
		onPlaceAfter?: (index: number) => void;
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
				<TrackCard
					{track}
					showReleaseDate={showReleaseDates}
					showPlacementButtons={showPlacementButtons && !showReleaseDates}
					isSelected={selectedTrackIndex === index && selectedPlacementType !== null}
					showSongName={showSongName || index === 0}
					showArtistName={showArtistName || index === 0}
					isFirstTrack={index === 0}
					onPlaceBefore={onPlaceBefore ? () => onPlaceBefore(index) : undefined}
					onPlaceAfter={onPlaceAfter ? () => onPlaceAfter(index) : undefined}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.timeline-container {
		position: relative;
		width: 100%;
		min-height: 150px;
		padding: 1rem 0;
		overflow-x: auto;
		overflow-y: visible;
	}

	.timeline-track-container {
		position: relative;
		width: 100%;
		min-height: 120px;
		padding: 0 100px; /* Padding to allow tracks at edges */
	}

	.track-position {
		position: absolute;
		transform: translateX(-50%);
		top: 0;
		transition: all 0.3s ease;
	}

	/* Ensure tracks don't overlap */
	.track-position:hover {
		z-index: 10;
	}

	@media (max-width: 768px) {
		.timeline-track-container {
			padding: 0 80px;
		}
	}
</style>

