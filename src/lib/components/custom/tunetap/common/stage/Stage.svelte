<!--
@component

The Stage component displays the current track being played with a vinyl record visualization and track information.

Usage:
  ```html
  <Stage
    currentTrack={currentTrack}
    isPlaying={isPlaying}
    showSongName={showSongName}
    showArtistName={showArtistName}
    showReleaseDates={showReleaseDates}
    blurred={blurred}
    onRevealClick={handleRevealClick}
  />
  ```
-->
<script lang="ts">
	import type { Track } from '$lib/types.js';
	import { Spring, prefersReducedMotion } from 'svelte/motion';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let {
		currentTrack,
		isPlaying = false,
		showSongName = false,
		showArtistName = false,
		showReleaseDates = false,
		blurred = true,
		onRevealClick,
		onPlayClick,
		onStopClick
	}: {
		currentTrack: Track | null;
		isPlaying?: boolean;
		showSongName?: boolean;
		showArtistName?: boolean;
		showReleaseDates?: boolean;
		blurred?: boolean;
		onRevealClick: () => void;
		onPlayClick?: () => void;
		onStopClick?: () => void;
	} = $props();

	function handleVinylClick() {
		if (isPlaying) {
			onStopClick?.();
		} else {
			onPlayClick?.();
		}
	}

	const blurSpring = new Spring(5, {
		stiffness: 0.22,
		damping: 0.72
	});

	const reducedMotion = $derived(prefersReducedMotion.current);
	const textRevealTransition = $derived(
		reducedMotion ? { duration: 0, y: 0 } : { y: 12, duration: 220, easing: cubicOut }
	);
	const placeholderFade = $derived(reducedMotion ? { duration: 0 } : { duration: 200 });

	$effect(() => {
		const target = blurred ? 5 : 0;
		if (reducedMotion) {
			blurSpring.set(target, { instant: true });
		} else {
			blurSpring.target = target;
		}
	});
</script>

<div class="zone-a-stage">
	<div class="stage-content">
		{#if currentTrack}
			<!-- Vinyl Record - Clickable for Play/Pause -->
			<button
				type="button"
				class="vinyl-container"
				class:playing={isPlaying}
				onclick={handleVinylClick}
				aria-label={isPlaying ? 'Pause track' : 'Play track'}
			>
				<div class="vinyl-record" style={`filter: blur(${blurSpring.current}px);`}>
					{#if currentTrack.coverImage}
						<img src={currentTrack.coverImage} alt={`${currentTrack.name} album cover`} />
					{:else}
						<div class="vinyl-placeholder">🎵</div>
					{/if}
					<div class="vinyl-center"></div>
				</div>
				<!-- Play/Pause Overlay -->
				<div class="vinyl-overlay" class:visible={!isPlaying}>
					<div class="play-icon">▶</div>
				</div>
				<div class="vinyl-overlay pause-overlay" class:visible={isPlaying}>
					<div class="pause-icon">⏸</div>
				</div>
			</button>

			<!-- Track Info -->
			<button
				type="button"
				class="track-info"
				class:blurred
				onclick={onRevealClick}
				onkeydown={(e) => e.key === 'Enter' && onRevealClick()}
				aria-label={blurred ? 'Tap to reveal track info' : 'Track info'}
			>
				{#if showSongName}
					<div class="track-title" in:fly={textRevealTransition}>{currentTrack.name}</div>
				{/if}
				{#if showArtistName}
					<div class="track-artist" in:fly={textRevealTransition}>{currentTrack.artists.join(', ')}</div>
				{/if}
				{#if !showSongName && !showArtistName}
					<div class="track-placeholder" in:fade={placeholderFade}>
						<span class="tap-icon">👆</span>
						<span>Tap to reveal</span>
					</div>
				{/if}
				{#if showReleaseDates && currentTrack.firstReleaseDate}
					<div class="track-year" in:fly={textRevealTransition}>
						{currentTrack.firstReleaseDate.slice(0, 4)}
					</div>
				{/if}
			</button>

			<!-- Instruction hint -->
			<div class="stage-hint">
				{#if blurred}
					Listen & place this track on your timeline
				{:else}
					Scroll timeline below to place this track
				{/if}
			</div>
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
		position: relative;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		transition: transform 0.2s ease;
	}

	.vinyl-container:hover {
		transform: scale(1.02);
	}

	.vinyl-container:active {
		transform: scale(0.98);
	}

	.vinyl-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.4);
		border-radius: 50%;
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
	}

	.vinyl-overlay.visible {
		opacity: 1;
	}

	.vinyl-container:hover .vinyl-overlay.visible {
		opacity: 0.8;
	}

	.play-icon,
	.pause-icon {
		font-size: calc(var(--vinyl-size, 200px) / 4);
		color: white;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	.vinyl-overlay.pause-overlay {
		opacity: 0;
	}

	.vinyl-container:hover .vinyl-overlay.pause-overlay.visible {
		opacity: 0.6;
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
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.tap-icon {
		font-size: 2rem;
		animation: bounce 1.5s ease-in-out infinite;
	}

	@keyframes bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-8px);
		}
	}

	.stage-hint {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		text-align: center;
		margin-top: 0.5rem;
		opacity: 0.8;
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

	@media (prefers-reduced-motion: reduce) {
		.vinyl-record,
		.tap-icon {
			animation: none;
		}
	}
</style>
