<script lang="ts">
	import type { Player } from '$lib/types/tunetap.js';
	import type { Track } from '$lib/types.js';
	import { getYearRange, generateYearMarkers, getReleaseYear, calculateTimelinePosition } from '$lib/utils/timeline.js';
	import TimelineTrackChip from './TimelineTrackChip.svelte';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

	let {
		player,
		isCurrentPlayer = false,
		showReleaseDates = false,
		selectedTrackIndex = null as number | null,
		showSongName = false,
		showArtistName = false,
		onTrackClick,
		onPlaceFirstTrack
	}: {
		player: Player;
		isCurrentPlayer?: boolean;
		showReleaseDates?: boolean;
		selectedTrackIndex?: number | null;
		showSongName?: boolean;
		showArtistName?: boolean;
		onTrackClick?: (index: number) => void;
		onPlaceFirstTrack?: () => void;
	} = $props();

	const yearRange = $derived.by(() => {
		if (player.timeline.length === 0) return null;
		return getYearRange(player.timeline);
	});

	const markers = $derived.by(() => {
		if (!yearRange) return [];
		return generateYearMarkers(yearRange.minYear, yearRange.maxYear);
	});

	const timelineWidth = $derived.by(() => {
		if (!yearRange) return 100;
		const range = yearRange.maxYear - yearRange.minYear;
		// Calculate width as percentage, minimum 100%
		// For ranges > 50 years, scale up to allow better spacing
		if (range > 50) {
			return Math.min(200, 100 + (range - 50) * 0.5);
		}
		return 100;
	});
</script>

<div class="player-timeline {isCurrentPlayer ? 'current-player' : ''}">
	{#if !isCurrentPlayer}
		<div class="timeline-header">
			<h3 class="timeline-title">{player.name}'s Timeline</h3>
			<div class="timeline-meta">Score: {player.score}/10 • {player.timeline.length} tracks</div>
		</div>
	{/if}
	<div class="timeline-content">
		{#if player.timeline.length === 0}
			<div class="empty-timeline">
				<p>Timeline is empty. Place your first track!</p>
				{#if isCurrentPlayer && !showReleaseDates && onPlaceFirstTrack}
					<Button size="lg" onclick={onPlaceFirstTrack} class="place-first-button">
						Place First Track
					</Button>
				{/if}
			</div>
		{:else if yearRange}
			<div class="timeline-wrapper">
				<div class="timeline-scroll-container" style="width: {timelineWidth}%">
					<!-- Axis -->
					<div class="timeline-axis-section">
						<div class="timeline-line"></div>
						<div class="markers-container">
							{#each markers as marker}
								<div
									class="marker"
									class:decade={marker.isDecade}
									style="left: {marker.position}%"
								>
									<div class="marker-line"></div>
									<div class="marker-label">{marker.year}</div>
								</div>
							{/each}
						</div>
					</div>
					<!-- Tracks -->
					<div class="timeline-tracks-section">
						{#each player.timeline as track, index}
							{@const year = getReleaseYear(track)}
							{@const position = year !== null ? calculateTimelinePosition(year, yearRange.minYear, yearRange.maxYear) : 0}
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
			</div>
		{/if}
	</div>
</div>

<style>
	/* All timelines use the same muted colors - no special styling for current player */

	.timeline-header {
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid var(--border);
	}

	.timeline-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0 0 0.25rem 0;
	}

	.timeline-meta {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	.timeline-content {
		width: 100%;
	}

	.timeline-wrapper {
		position: relative;
		width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		max-height: 165px; /* Axis (40px) + tracks (120px) + gap */
		scrollbar-width: none; /* Hide scrollbar in Firefox */
		-ms-overflow-style: none; /* Hide scrollbar in IE/Edge */
	}

	.timeline-wrapper::-webkit-scrollbar {
		display: none; /* Hide scrollbar in Chrome/Safari */
	}

	.timeline-scroll-container {
		position: relative;
		min-width: 100%;
		padding-left: 40px;
		padding-right: 40px;
		box-sizing: border-box;
	}

	.timeline-axis-section {
		position: relative;
		height: 40px;
		margin-bottom: 0.25rem;
	}

	.timeline-line {
		position: absolute;
		top: 15px;
		left: 0;
		right: 0;
		height: 2px;
		background-color: var(--border);
	}

	.markers-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.marker-line {
		width: 2px;
		height: 15px;
		background-color: var(--border);
		margin-bottom: 2px;
	}

	.marker.decade .marker-line {
		height: 20px;
		background-color: var(--foreground);
		width: 3px;
	}

	.marker-label {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		white-space: nowrap;
		font-weight: 500;
	}

	.marker.decade .marker-label {
		font-weight: 700;
		color: var(--foreground);
		font-size: 0.875rem;
	}

	.timeline-tracks-section {
		position: relative;
		height: 120px;
		padding: 0.25rem 0;
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

	.track-position:hover {
		z-index: 10;
	}

	.empty-timeline {
		text-align: center;
		color: var(--muted-foreground);
		padding: 3rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		align-items: center;
	}

	.empty-timeline p {
		margin: 0;
		font-size: 1rem;
	}

	.place-first-button {
		margin-top: 0.5rem;
	}

	@media (max-width: 768px) {
		.timeline-wrapper {
			max-height: 150px; /* Smaller on mobile: axis (35px) + tracks (110px) + gap */
		}

		.timeline-scroll-container {
			padding-left: 35px;
			padding-right: 35px;
		}

		.timeline-axis-section {
			height: 35px;
			margin-bottom: 0.2rem;
		}

		.timeline-line {
			top: 12px;
		}

		.marker-line {
			height: 12px;
		}

		.marker.decade .marker-line {
			height: 18px;
		}

		.marker-label {
			font-size: 0.625rem;
		}

		.marker.decade .marker-label {
			font-size: 0.75rem;
		}

		.timeline-tracks-section {
			height: 110px;
		}
	}
</style>

