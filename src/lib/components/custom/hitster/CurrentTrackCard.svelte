<script lang="ts">
	import type { Track } from '$lib/types.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

	let {
		track,
		isPlaying,
		showSongName = false,
		showArtistName = false,
		onPlay,
		onStop
	}: {
		track: Track | null;
		isPlaying: boolean;
		showSongName?: boolean;
		showArtistName?: boolean;
		onPlay: () => void;
		onStop: () => void;
	} = $props();
</script>

<div class="current-track-display">
	<div class="track-header">
		<h3 class="section-title">Current Song</h3>
	</div>
	{#if track}
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
			<div class="audio-controls">
				<Button onclick={onPlay} disabled={isPlaying} size="lg">
					{isPlaying ? 'Playing...' : '▶ Play'}
				</Button>
				<Button variant="outline" onclick={onStop} size="lg">Stop</Button>
			</div>
		</div>
	{:else}
		<div class="no-track">No track selected</div>
	{/if}
</div>

<style>
	.current-track-display {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border);
	}

	.track-header {
		margin-bottom: 1rem;
	}

	.section-title {
		font-size: 1rem;
		font-weight: 600;
		color: var(--muted-foreground);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.track-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
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

	.audio-controls {
		display: flex;
		gap: 1rem;
		justify-content: flex-start;
	}

	.no-track {
		text-align: center;
		color: var(--muted-foreground);
		padding: 2rem;
	}

	@media (max-width: 768px) {
		.current-track-display {
			margin-bottom: 1.5rem;
			padding-bottom: 1rem;
		}

		.track-title {
			font-size: 1.5rem;
		}

		.track-artist {
			font-size: 1.125rem;
		}

		.audio-controls {
			flex-direction: column;
		}

		.audio-controls button {
			width: 100%;
		}
	}
</style>

