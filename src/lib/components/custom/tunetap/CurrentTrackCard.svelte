<script lang="ts">
	import type { Track } from '$lib/types.js';

	let {
		track,
		showSongName = false,
		showArtistName = false,
		revealed = false
	}: {
		track: Track | null;
		showSongName?: boolean;
		showArtistName?: boolean;
		revealed?: boolean;
	} = $props();
</script>

<div class="current-track-display">
	<div class="track-header">
		<div>
			<p class="section-eyebrow">Track Preview</p>
			<h3 class="section-title">Listen & decide where it belongs</h3>
		</div>
		<div class="reveal-state">
			<span class="reveal-pill" class:active={showSongName}>
				{showSongName ? 'Song Revealed' : 'Song Hidden'}
			</span>
			<span class="reveal-pill" class:active={showArtistName}>
				{showArtistName ? 'Artist Revealed' : 'Artist Hidden'}
			</span>
		</div>
	</div>
	{#if track}
		<div class="track-cover" class:revealed>
			{#if track.coverImage}
				<img src={track.coverImage} alt={`${track.name} album cover`} loading="lazy" />
			{:else}
				<div class="cover-placeholder">🎵</div>
			{/if}
		</div>
		<div class="track-content">
			<div class="track-info">
				{#if showSongName}
					<div class="track-title">{track.name}</div>
				{/if}
				{#if showArtistName}
					<div class="track-artist">{track.artists.join(', ')}</div>
				{/if}
				{#if !showSongName && !showArtistName}
					<div class="track-placeholder">?</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="no-track">No track selected</div>
	{/if}
</div>

<style>
	.current-track-display {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.track-cover {
		width: min(420px, 100%);
		border-radius: calc(var(--radius) - 2px);
		overflow: hidden;
		background-color: color-mix(in oklch, var(--muted) 40%, transparent);
		margin: 0 auto 1rem auto;
		aspect-ratio: 4 / 3;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.track-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.cover-placeholder {
		font-size: 2rem;
		color: var(--muted-foreground);
	}

	.track-cover:not(.revealed)::after {
		content: '';
		position: absolute;
		inset: 0;
		backdrop-filter: blur(16px);
		background: rgb(0 0 0 / 0.35);
	}

	.track-cover:not(.revealed) img {
		filter: blur(12px);
		transform: scale(1.1);
	}

	.track-header {
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.section-title {
		font-size: 1.5rem;
		margin: 0;
		color: var(--foreground);
	}

	.section-eyebrow {
		margin: 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.reveal-state {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.reveal-pill {
		padding: 0.35rem 0.75rem;
		border-radius: 999px;
		font-size: 0.75rem;
		background-color: var(--muted);
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.reveal-pill.active {
		background-color: color-mix(in oklch, var(--primary) 20%, transparent);
		color: var(--primary);
	}

	.track-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.track-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.track-title {
		font-size: 1.75rem;
		font-weight: bold;
		color: var(--foreground);
		line-height: 1.3;
	}

	.track-artist {
		font-size: 1.25rem;
		color: var(--muted-foreground);
		line-height: 1.4;
	}

	.track-placeholder {
		font-size: 2rem;
		color: var(--muted-foreground);
		text-align: center;
		padding: 1rem 0;
	}

	.no-track {
		text-align: center;
		color: var(--muted-foreground);
		padding: 2rem;
	}

	@media (max-width: 768px) {
		.track-title {
			font-size: 1.5rem;
		}

		.track-artist {
			font-size: 1.125rem;
		}

		.track-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.reveal-state {
			justify-content: flex-start;
		}
	}
</style>
