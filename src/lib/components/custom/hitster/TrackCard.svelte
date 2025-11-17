<script lang="ts">
	import type { Track } from '$lib/types.js';
	import { Badge } from '$lib/components/shadncn-ui/badge/index.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

	let {
		track,
		showReleaseDate = false,
		showPlacementButtons = false,
		isSelected = false,
		showSongName = false,
		showArtistName = false,
		isFirstTrack = false,
		onPlaceBefore,
		onPlaceAfter
	}: {
		track: Track;
		showReleaseDate?: boolean;
		showPlacementButtons?: boolean;
		isSelected?: boolean;
		showSongName?: boolean;
		showArtistName?: boolean;
		isFirstTrack?: boolean;
		onPlaceBefore?: () => void;
		onPlaceAfter?: () => void;
	} = $props();
</script>

<div class="track-card" class:selected={isSelected} class:first-track={isFirstTrack}>
	{#if isFirstTrack}
		<div class="first-track-icon">🎵</div>
	{/if}
	<div class="track-info">
		{#if showSongName}
			<strong class="track-name">{track.name}</strong>
		{/if}
		{#if showArtistName}
			<div class="artist">{track.artists.join(', ')}</div>
		{/if}
		{#if !showSongName && !showArtistName && !isFirstTrack}
			<div class="track-placeholder">?</div>
		{/if}
	</div>
	<div class="track-badge">
		{#if showReleaseDate && track.firstReleaseDate}
			<Badge variant="default">{track.firstReleaseDate}</Badge>
		{:else}
			<Badge variant="secondary">?</Badge>
		{/if}
	</div>
	{#if showPlacementButtons && (onPlaceBefore || onPlaceAfter)}
		<div class="placement-buttons">
			{#if onPlaceBefore}
				<Button
					size="sm"
					variant={isSelected ? 'default' : 'outline'}
					onclick={onPlaceBefore}
				>
					Before
				</Button>
			{/if}
			{#if onPlaceAfter}
				<Button
					size="sm"
					variant={isSelected ? 'default' : 'outline'}
					onclick={onPlaceAfter}
				>
					After
				</Button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.track-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background-color: var(--muted);
		border-radius: calc(var(--radius) - 2px);
		border: 2px solid transparent;
		transition: all 0.2s ease;
		min-width: 200px;
		position: relative;
	}

	.track-card.selected {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 10%, transparent);
	}

	.track-card.first-track {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 15%, transparent);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.first-track-icon {
		position: absolute;
		top: -12px;
		left: 50%;
		transform: translateX(-50%);
		font-size: 1.5rem;
		background-color: var(--background);
		padding: 0.25rem 0.5rem;
		border-radius: 50%;
		z-index: 1;
	}

	.track-info {
		flex: 1;
	}

	.track-name {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.875rem;
		line-height: 1.3;
	}

	.artist {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		line-height: 1.4;
	}

	.track-placeholder {
		font-size: 1.5rem;
		color: var(--muted-foreground);
		text-align: center;
		padding: 0.5rem 0;
	}

	.track-badge {
		display: flex;
		justify-content: flex-end;
	}

	.placement-buttons {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	@media (max-width: 768px) {
		.track-card {
			min-width: 150px;
			padding: 0.5rem;
		}

		.track-name {
			font-size: 0.8125rem;
		}

		.artist {
			font-size: 0.6875rem;
		}
	}
</style>

