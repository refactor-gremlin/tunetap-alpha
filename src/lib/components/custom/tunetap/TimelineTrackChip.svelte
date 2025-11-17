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

<div
	class="track-chip"
	class:selected={isSelected}
	onclick={onClick}
	role={onClick ? 'button' : undefined}
	tabindex={onClick ? 0 : undefined}
>
	<div class="chip-cover">
		{#if track.coverImage}
			<img src={track.coverImage} alt={`${track.name} album cover`} loading="lazy" />
		{:else}
			<div class="cover-placeholder">🎵</div>
		{/if}
		{#if showReleaseDate && track.firstReleaseDate}
			<div class="chip-year">{track.firstReleaseDate.slice(0, 4)}</div>
		{/if}
	</div>
	{#if showSongName || showArtistName}
		<div class="chip-info">
			{#if showSongName}
				<span class="chip-name">{track.name}</span>
			{/if}
			{#if showArtistName}
				<span class="chip-artist">{track.artists[0]}</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.track-chip {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
		padding: 0.15rem;
		background-color: transparent;
		border-radius: calc(var(--radius) - 2px);
		border: 2px solid transparent;
		transition: all 0.2s ease;
		width: 80px;
		max-width: 80px;
		max-height: 100%;
		cursor: default;
		flex-shrink: 0;
	}

	.track-chip[role='button'] {
		cursor: pointer;
	}

	.track-chip[role='button']:hover {
		border-color: var(--border);
		transform: translateY(-2px);
	}

	.track-chip.selected {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 30%, transparent);
	}

	.track-chip[role='button']:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.chip-cover {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: calc(var(--radius) - 4px);
		overflow: hidden;
		background-color: color-mix(in oklch, var(--muted) 40%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		border: 1px solid var(--border);
		max-height: calc(100% - 2rem); /* Leave room for text below */
	}

	.chip-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.cover-placeholder {
		font-size: 1rem;
		color: var(--muted-foreground);
	}

	.chip-year {
		position: absolute;
		right: 0.25rem;
		bottom: 0.25rem;
		background-color: rgb(0 0 0 / 0.7);
		color: white;
		padding: 0.1rem 0.3rem;
		border-radius: 999px;
		font-size: 0.65rem;
		font-weight: 600;
		line-height: 1;
	}

	.chip-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.1rem;
		width: 100%;
		min-height: 0;
		line-height: 1.1;
	}

	.chip-name {
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
		text-align: center;
		color: var(--foreground);
	}

	.chip-artist {
		font-size: 0.65rem;
		color: var(--muted-foreground);
		line-height: 1.1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		width: 100%;
		text-align: center;
	}

	@media (max-width: 768px) {
		.track-chip {
			width: 70px;
			max-width: 70px;
			padding: 0.3rem;
			gap: 0.25rem;
		}

		.chip-name {
			font-size: 0.65rem;
		}

		.chip-artist {
			font-size: 0.6rem;
		}

		.chip-year {
			font-size: 0.6rem;
			padding: 0.05rem 0.25rem;
		}
	}
</style>

