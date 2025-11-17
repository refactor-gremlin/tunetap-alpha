<script lang="ts">
	import type { Player } from '$lib/types/hitster.js';
	import type { Track } from '$lib/types.js';
	import { getYearRange, generateYearMarkers } from '$lib/utils/timeline.js';
	import TimelineAxis from './TimelineAxis.svelte';
	import HorizontalTimeline from './HorizontalTimeline.svelte';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

	let {
		player,
		isCurrentPlayer = false,
		showReleaseDates = false,
		showPlacementButtons = false,
		selectedTrackIndex = null as number | null,
		selectedPlacementType = null as 'before' | 'after' | null,
		showSongName = false,
		showArtistName = false,
		onPlaceBefore,
		onPlaceAfter,
		onPlaceFirstTrack
	}: {
		player: Player;
		isCurrentPlayer?: boolean;
		showReleaseDates?: boolean;
		showPlacementButtons?: boolean;
		selectedTrackIndex?: number | null;
		selectedPlacementType?: 'before' | 'after' | null;
		showSongName?: boolean;
		showArtistName?: boolean;
		onPlaceBefore?: (index: number) => void;
		onPlaceAfter?: (index: number) => void;
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
				{#if isCurrentPlayer && showPlacementButtons && onPlaceFirstTrack}
					<Button size="lg" onclick={onPlaceFirstTrack} class="place-first-button">
						Place First Track
					</Button>
				{/if}
			</div>
		{:else if yearRange}
			<div class="timeline-wrapper">
				<TimelineAxis markers={markers} width={timelineWidth} />
				<HorizontalTimeline
					tracks={player.timeline}
					{showReleaseDates}
					minYear={yearRange.minYear}
					maxYear={yearRange.maxYear}
					{showPlacementButtons}
					{selectedTrackIndex}
					{selectedPlacementType}
					width={timelineWidth}
					{showSongName}
					{showArtistName}
					{onPlaceBefore}
					{onPlaceAfter}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.player-timeline {
		margin-bottom: 2rem;
		padding: 1.5rem;
		background-color: color-mix(in oklch, var(--muted) 30%, transparent);
		border-radius: calc(var(--radius) - 2px);
		border: 1px solid var(--border);
		transition: all 0.3s ease;
	}

	.player-timeline.current-player {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 8%, transparent);
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--primary) 20%, transparent);
	}

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
</style>

