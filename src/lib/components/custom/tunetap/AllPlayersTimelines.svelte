<script lang="ts">
	import { untrack } from 'svelte';
	import type { Player } from '$lib/types/tunetap.js';
	import PlayerTimeline from './PlayerTimeline.svelte';
	import * as Tabs from '$lib/components/shadncn-ui/tabs/index.js';

	let {
		players,
		currentPlayerIndex,
		showReleaseDates = false,
		selectedTrackIndex = null as number | null,
		showSongName = false,
		showArtistName = false,
		onTrackClick,
		onPlaceFirstTrack
	}: {
		players: Player[];
		currentPlayerIndex: number;
		showReleaseDates?: boolean;
		selectedTrackIndex?: number | null;
		showSongName?: boolean;
		showArtistName?: boolean;
		onTrackClick?: (index: number) => void;
		onPlaceFirstTrack?: () => void;
	} = $props();

	let activePlayerTab = $state(String(currentPlayerIndex));
	$effect(() => {
		const currentIdx = String(currentPlayerIndex);
		untrack(() => {
			activePlayerTab = currentIdx;
		});
	});
</script>

<div class="player-tabs-wrapper">
	<Tabs.Root class="player-tabs" bind:value={activePlayerTab}>
		<Tabs.List class="player-tabs-list">
			{#each players as player, index}
				<Tabs.Trigger
					value={String(index)}
					data-current={index === currentPlayerIndex}
				>
					<span>{player.name}</span>
					<small>{player.score}/10</small>
				</Tabs.Trigger>
			{/each}
		</Tabs.List>

		{#each players as player, index}
			<Tabs.Content value={String(index)} class="player-tab-panel">
				<section class="timeline-panel" class:current={index === currentPlayerIndex}>
					<div class="panel-header">
						<div>
							<p class="panel-eyebrow">{index === currentPlayerIndex ? 'Active Timeline' : 'Timeline'}</p>
							<h3>{player.name}</h3>
						</div>
						<div class="panel-meta">
							<span>{player.timeline.length} tracks placed</span>
							<span>Score {player.score}/10</span>
						</div>
					</div>
					<PlayerTimeline
						{player}
						isCurrentPlayer={index === currentPlayerIndex}
						{showReleaseDates}
						selectedTrackIndex={index === currentPlayerIndex ? selectedTrackIndex : null}
						{showSongName}
						{showArtistName}
						onTrackClick={index === currentPlayerIndex ? onTrackClick : undefined}
						onPlaceFirstTrack={index === currentPlayerIndex ? onPlaceFirstTrack : undefined}
					/>
				</section>
			</Tabs.Content>
		{/each}
	</Tabs.Root>
</div>

<style>
	.player-tabs-wrapper {
		width: 100%;
	}

	.player-tabs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.player-tabs-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		background: none;
		padding: 0;
		overflow-x: auto;
	}

	:global(.player-tabs-list [data-slot='tabs-trigger']) {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		align-items: center;
		text-transform: none;
		font-size: 0.8rem;
		padding: 0.5rem 0.75rem;
		min-width: fit-content;
		white-space: nowrap;
	}

	:global(.player-tabs-list [data-slot='tabs-trigger'] span) {
		font-size: 0.8rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100px;
	}

	:global(.player-tabs-list [data-slot='tabs-trigger'] small) {
		font-size: 0.7rem;
		opacity: 0.8;
	}

	/* All tab triggers use the same styling - no special styling for current player */

	.player-tab-panel {
		width: 100%;
	}

	.timeline-panel {
		border: 1px solid var(--border);
		border-radius: calc(var(--radius) - 2px);
		background: color-mix(in oklch, var(--muted) 20%, transparent);
		padding: 1.25rem;
	}

	/* All timelines use the same muted colors - no special styling for current player */

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.panel-eyebrow {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.panel-subtitle {
		margin: 0.25rem 0 0 0;
		color: var(--muted-foreground);
		font-size: 0.9rem;
	}

	.panel-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--muted-foreground);
	}

	@media (max-width: 768px) {
		.panel-header {
			flex-direction: column;
		}

		:global(.player-tabs-list [data-slot='tabs-trigger']) {
			font-size: 0.75rem;
			padding: 0.4rem 0.6rem;
		}

		:global(.player-tabs-list [data-slot='tabs-trigger'] span) {
			font-size: 0.75rem;
			max-width: 80px;
		}

		:global(.player-tabs-list [data-slot='tabs-trigger'] small) {
			font-size: 0.65rem;
		}
	}
</style>
