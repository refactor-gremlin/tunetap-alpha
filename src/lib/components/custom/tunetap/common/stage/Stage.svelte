<script lang="ts">
	import type { Track } from '$lib/types.js';

	let {
		currentTrack,
		isPlaying = false,
		showSongName = false,
		showArtistName = false,
		showReleaseDates = false,
		blurred = true,
		onRevealClick
	}: {
		currentTrack: Track | null;
		isPlaying?: boolean;
		showSongName?: boolean;
		showArtistName?: boolean;
		showReleaseDates?: boolean;
		blurred?: boolean;
		onRevealClick: () => void;
	} = $props();
</script>

<div class="zone-a-stage">
	<div class="stage-content">
		{#if currentTrack}
			<!-- Vinyl Record -->
			<div class="vinyl-container" class:playing={isPlaying}>
				<div class="vinyl-record">
					{#if currentTrack.coverImage}
						<img src={currentTrack.coverImage} alt={`${currentTrack.name} album cover`} />
					{:else}
						<div class="vinyl-placeholder">🎵</div>
					{/if}
					<div class="vinyl-center"></div>
				</div>
			</div>

			<!-- Track Info -->
			<button
				type="button"
				class="track-info"
				class:blurred
				onclick={onRevealClick}
				onkeydown={(e) => e.key === 'Enter' && onRevealClick()}
			>
				{#if showSongName}
					<div class="track-title">{currentTrack.name}</div>
				{/if}
				{#if showArtistName}
					<div class="track-artist">{currentTrack.artists.join(', ')}</div>
				{/if}
				{#if !showSongName && !showArtistName}
					<div class="track-placeholder">Tap to reveal</div>
				{/if}
				{#if showReleaseDates && currentTrack.firstReleaseDate}
					<div class="track-year">{currentTrack.firstReleaseDate.slice(0, 4)}</div>
				{/if}
			</button>
		{:else}
			<div class="no-track-message">No track selected</div>
		{/if}
	</div>
</div>

<style>
	/* Zone A: The Stage */
	.zone-a-stage {
		flex: 0 0 40%;
		position: relative;
		z-index: 20;
		background: var(--stage-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.stage-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--stage-gap, 2rem);
		padding: var(--stage-padding, 2rem);
	}

	.vinyl-container {
		width: var(--vinyl-size, 200px);
		height: var(--vinyl-size, 200px);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vinyl-record {
		width: var(--vinyl-size, 200px);
		height: var(--vinyl-size, 200px);
		border-radius: 50%;
		background: radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%);
		border: var(--vinyl-border-width, 10px) solid #2a2a2a;
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		animation: rotate 10s linear infinite;
		animation-play-state: paused;
		filter: blur(5px);
	}

	.vinyl-container.playing .vinyl-record {
		animation-play-state: running;
	}

	.vinyl-record img {
		width: 80%;
		height: 80%;
		border-radius: 50%;
		object-fit: cover;
	}

	.vinyl-placeholder {
		font-size: calc(var(--vinyl-size, 200px) / 5);
		color: var(--muted-foreground);
	}

	.vinyl-center {
		position: absolute;
		width: var(--vinyl-center-size, 40px);
		height: var(--vinyl-center-size, 40px);
		border-radius: 50%;
		background: #0a0a0a;
		border: calc(var(--vinyl-center-size, 40px) / 13.33) solid #2a2a2a;
		z-index: 1;
	}

	.track-info {
		text-align: center;
		transition: filter 0.3s ease;
		cursor: pointer;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: inherit;
		width: 100%;
	}

	.track-info.blurred {
		filter: blur(8px);
	}

	.track-title {
		font-size: var(--track-title-size, 1.875rem);
		font-weight: bold;
		color: var(--foreground);
		margin-bottom: 0.75rem;
	}

	.track-artist {
		font-size: var(--track-artist-size, 1.375rem);
		color: var(--muted-foreground);
		margin-bottom: 0.75rem;
	}

	.track-placeholder {
		font-size: var(--track-placeholder-size, 1.5rem);
		color: var(--muted-foreground);
		font-style: italic;
	}

	.track-year {
		font-size: var(--track-year-size, 1.125rem);
		color: var(--primary);
		font-weight: 600;
		margin-top: 0.75rem;
	}

	.no-track-message {
		color: var(--muted-foreground);
		font-size: var(--track-artist-size, 1.375rem);
	}

	@keyframes rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
</style>
