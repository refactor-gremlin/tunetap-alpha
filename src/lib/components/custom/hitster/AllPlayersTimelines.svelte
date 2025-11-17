<script lang="ts">
	import { untrack } from 'svelte';
	import type { Player } from '$lib/types/hitster.js';
	import PlayerTimeline from './PlayerTimeline.svelte';

	let {
		players,
		currentPlayerIndex,
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
		players: Player[];
		currentPlayerIndex: number;
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

	let expandedPlayers = $state<Set<number>>(new Set([currentPlayerIndex]));

	function togglePlayer(index: number) {
		if (index === currentPlayerIndex) return; // Can't collapse current player
		const newExpanded = new Set(expandedPlayers);
		if (newExpanded.has(index)) {
			newExpanded.delete(index);
		} else {
			newExpanded.add(index);
		}
		expandedPlayers = newExpanded;
	}

	$effect(() => {
		// Always expand current player - track only currentPlayerIndex, not expandedPlayers
		const currentIdx = currentPlayerIndex;
		untrack(() => {
			if (!expandedPlayers.has(currentIdx)) {
				expandedPlayers = new Set([...expandedPlayers, currentIdx]);
			}
		});
	});
</script>

<div class="all-timelines">
	{#each players as player, index}
		{@const isCurrentPlayer = index === currentPlayerIndex}
		{@const isExpanded = expandedPlayers.has(index)}
		
		{#if isCurrentPlayer}
			<!-- Current player's timeline - always expanded -->
			<PlayerTimeline
				{player}
				isCurrentPlayer={true}
				{showReleaseDates}
				{showPlacementButtons}
				{selectedTrackIndex}
				{selectedPlacementType}
				{showSongName}
				{showArtistName}
				{onPlaceBefore}
				{onPlaceAfter}
				{onPlaceFirstTrack}
			/>
		{:else}
			<!-- Other players' timelines - collapsible -->
			<div class="collapsed-timeline {isExpanded ? 'expanded' : ''}">
				<button
					class="timeline-header-button"
					onclick={() => togglePlayer(index)}
					type="button"
				>
					<div class="header-content">
						<div class="header-info">
							<h3 class="header-title">{player.name}</h3>
							<div class="header-meta">
								Score: {player.score}/10 • {player.timeline.length} tracks
							</div>
						</div>
						<div class="expand-icon">{isExpanded ? '▼' : '▶'}</div>
					</div>
				</button>
				{#if isExpanded}
					<div class="collapsed-content">
						<PlayerTimeline
							{player}
							isCurrentPlayer={false}
							{showReleaseDates}
							showPlacementButtons={false}
							{showSongName}
							{showArtistName}
						/>
					</div>
				{/if}
			</div>
		{/if}
	{/each}
</div>

<style>
	.all-timelines {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.collapsed-timeline {
		border: 1px solid var(--border);
		border-radius: calc(var(--radius) - 2px);
		background-color: color-mix(in oklch, var(--muted) 20%, transparent);
		transition: all 0.2s ease;
		overflow: hidden;
	}

	.collapsed-timeline.expanded {
		border-color: var(--muted-foreground);
	}

	.timeline-header-button {
		width: 100%;
		background: none;
		border: none;
		padding: 1rem 1.5rem;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.2s ease;
	}

	.timeline-header-button:hover {
		background-color: color-mix(in oklch, var(--muted) 30%, transparent);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
	}

	.header-info {
		flex: 1;
	}

	.header-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0 0 0.25rem 0;
	}

	.header-meta {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	.expand-icon {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin-left: 1rem;
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	.collapsed-content {
		padding: 0 1.5rem 1.5rem 1.5rem;
	}

	@media (max-width: 768px) {
		.all-timelines {
			gap: 1rem;
		}

		.timeline-header-button {
			padding: 0.75rem 1rem;
		}

		.collapsed-content {
			padding: 0 1rem 1rem 1rem;
		}
	}
</style>

