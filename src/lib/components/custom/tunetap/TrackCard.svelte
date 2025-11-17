<script lang="ts">
	import type { Track } from '$lib/types.js';

	let {
		track,
		showReleaseDate = false,
		isSelected = false,
		showSongName = false,
		showArtistName = false,
		onClick
	}: {
		track: Track;
		showReleaseDate?: boolean;
		isSelected?: boolean;
		showSongName?: boolean;
		showArtistName?: boolean;
		onClick?: () => void;
	} = $props();
</script>

<div class="track-card" class:selected={isSelected} onclick={onClick} role={onClick ? "button" : undefined} tabindex={onClick ? 0 : undefined}>
	<div class="track-cover">
		{#if track.coverImage}
			<img src={track.coverImage} alt={`${track.name} album cover`} loading="lazy" />
		{:else}
			<div class="cover-placeholder">🎵</div>
		{/if}
		{#if showReleaseDate}
			<div class="cover-year">
				{#if track.firstReleaseDate}
					{track.firstReleaseDate.slice(0, 4)}
				{:else}
					——
				{/if}
			</div>
		{/if}
	</div>

	<div class="track-info">
		{#if showSongName}
			<strong class="track-name">{track.name}</strong>
		{/if}
		{#if showArtistName}
			<div class="artist">{track.artists.join(', ')}</div>
		{/if}
		{#if !showSongName && !showArtistName}
			<div class="track-placeholder">?</div>
		{/if}
	</div>
</div>

<style>
	.track-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background-color: color-mix(in oklch, var(--muted) 30%, transparent);
		border-radius: calc(var(--radius) - 2px);
		border: 2px solid transparent;
		transition: all 0.2s ease;
		width: 160px;
		max-width: 160px;
		position: relative;
		cursor: default;
	}

	.track-card[role="button"] {
		cursor: pointer;
	}

	.track-card[role="button"]:hover {
		border-color: var(--border);
		background-color: color-mix(in oklch, var(--muted) 40%, transparent);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgb(0 0 0 / 0.1);
	}

	.track-card.selected {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 15%, transparent);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 30%, transparent);
	}

	.track-card[role="button"]:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.track-cover {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: calc(var(--radius) - 4px);
		overflow: hidden;
		background-color: color-mix(in oklch, var(--muted) 50%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.track-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.cover-placeholder {
		font-size: 1.5rem;
		color: var(--muted-foreground);
	}

	.cover-year {
		position: absolute;
		right: 0.4rem;
		bottom: 0.4rem;
		background-color: rgb(0 0 0 / 0.65);
		color: white;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.track-info {
		flex: 1;
	}

	.track-name {
		display: block;
		margin-bottom: 0.2rem;
		font-size: 0.85rem;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.artist {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		line-height: 1.3;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-placeholder {
		font-size: 1.2rem;
		color: var(--muted-foreground);
		text-align: center;
		padding: 0.25rem 0;
	}

	@media (max-width: 768px) {
		.track-card {
			width: 140px;
			max-width: 140px;
			padding: 0.4rem;
		}

		.track-name {
			font-size: 0.75rem;
		}

		.artist {
			font-size: 0.7rem;
		}
	}
</style>
