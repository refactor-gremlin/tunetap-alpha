<!--
@component

Individual track card displayed in the timeline. Shows track artwork, name, artist,
and release year. Supports grouped same-year tracks with expand functionality.

Usage:
  ```html
  <TimelineCard
    item={timelineItem}
    showSongName={showSongName}
    showArtistName={showArtistName}
    showReleaseDates={showReleaseDates}
    fetchReleaseDate={fetchReleaseDate}
    onReleaseDateResolved={handleResolved}
  />
  ```
-->
<script lang="ts">
	import type { Track } from '$lib/types.js';
	import * as Dialog from '$lib/components/shadncn-ui/dialog/index.js';
	import * as Tooltip from '$lib/components/shadncn-ui/tooltip/index.js';
	import TrackReleaseDateFetcher from './TrackReleaseDateFetcher.svelte';

	type TimelineItem = {
		type: 'card' | 'gap';
		track?: Track;
		index?: number;
		gapIndex?: number;
		sameYearCount?: number;
	sameYearTracks?: Track[];
	};

	let {
		item,
		showSongName = false,
		showArtistName = false,
		showReleaseDates = false,
		fetchReleaseDate = null,
		onReleaseDateResolved
	}: {
		item: TimelineItem;
		showSongName?: boolean;
		showArtistName?: boolean;
		showReleaseDates?: boolean;
		fetchReleaseDate?: ((args: {
			trackName: string;
			artistName: string;
			priority?: 'high' | 'low';
		}) => Promise<string | undefined>) | null;
		onReleaseDateResolved?: (payload: { trackId: string; date?: string; error?: unknown }) => void;
	} = $props();

	let dialogOpen = $state(false);
const releaseYear = $derived(item.track?.firstReleaseDate?.slice(0, 4) ?? null);
const overlappingTracks = $derived(item.sameYearTracks ?? []);
const hasSameYearOverlap = $derived(overlappingTracks.length > 0);
const needsReleaseDate = $derived(
	!!item.track && !item.track.firstReleaseDate && !!fetchReleaseDate && item.track.artists.length > 0
);
</script>

{#if item.track}
	<div
		class="timeline-card"
		data-index={item.index}
		onclick={() => (dialogOpen = true)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				dialogOpen = true;
			}
		}}
		role="button"
		tabindex="0"
	>
		<!-- Visible Card Content -->
		<div class="card-cover">
			{#if item.track.coverImage}
				<img src={item.track.coverImage} alt={`${item.track.name} album cover`} />
			{:else}
				<div class="cover-placeholder">🎵</div>
			{/if}
			{#if releaseYear && showReleaseDates}
				<div class="card-year">{releaseYear}</div>
			{/if}
			{#if hasSameYearOverlap}
				<Tooltip.Provider>
					<Tooltip.Root>
						<Tooltip.Trigger>
							<div class="card-same-year-badge" aria-label="Multiple tracks share this year">
								+{overlappingTracks.length}
							</div>
						</Tooltip.Trigger>
						<Tooltip.Content side="bottom" align="center">
							<p class="tooltip-title">
								{overlappingTracks.length} other {overlappingTracks.length === 1 ? 'track' : 'tracks'} share
								{releaseYear ? ` ${releaseYear}` : ' this year'}.
							</p>
							<ul class="tooltip-track-list">
								{#each overlappingTracks as track}
									<li>
										<span class="tooltip-track-name">{track.name}</span>
										{#if track.artists?.length}
											<span class="tooltip-track-artist"> — {track.artists[0]}</span>
										{/if}
									</li>
								{/each}
							</ul>
							<p class="tooltip-hint">Use Same Year placement to stack them.</p>
						</Tooltip.Content>
					</Tooltip.Root>
				</Tooltip.Provider>
			{/if}
		</div>
		{#if showSongName || showArtistName || (showReleaseDates && releaseYear)}
			<div class="card-info">
				{#if showSongName}
					<div class="card-name">{item.track.name}</div>
				{/if}
				{#if showReleaseDates && releaseYear}
					<div class="card-year-text">{releaseYear}</div>
				{/if}
				{#if showArtistName}
					<div class="card-artist">{item.track.artists[0]}</div>
				{/if}
			</div>
		{/if}

		{#if needsReleaseDate}
			<TrackReleaseDateFetcher
				track={item.track}
				fetchReleaseDate={fetchReleaseDate}
				onResolved={onReleaseDateResolved}
			/>
		{/if}
	</div>

	<Dialog.Root bind:open={dialogOpen}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{item.track.name}</Dialog.Title>
				<Dialog.Description>
					{item.track.artists.join(', ')}
				</Dialog.Description>
			</Dialog.Header>
			<div class="track-details-dialog">
				{#if item.track.coverImage}
					<img
						src={item.track.coverImage}
						alt={`${item.track.name} cover`}
						class="dialog-cover-image"
					/>
				{/if}
				<div class="details-grid">
					<p><strong>Release Date:</strong> {item.track.firstReleaseDate || 'N/A'}</p>
					<p><strong>Status:</strong> {item.track.status}</p>
					{#if item.track.spotifyPreviewUrl}
						<p>
							<strong>Spotify:</strong>
							<a href={item.track.spotifyPreviewUrl} target="_blank" rel="noopener noreferrer">
								Listen on Spotify
							</a>
						</p>
					{/if}
					{#if item.track.youtubeUrl}
						<p>
							<strong>YouTube:</strong>
							<a href={item.track.youtubeUrl} target="_blank" rel="noopener noreferrer">
								Watch on YouTube
							</a>
						</p>
					{/if}
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<style>
	.timeline-card {
		flex: 0 0 var(--timeline-card-width, 180px);
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--timeline-card-padding, 1rem);
		background: var(--timeline-card-bg);
		border: 2px solid var(--border);
		border-radius: calc(var(--radius) - 2px);
		margin: 0;
		scroll-snap-align: center;
		opacity: 0.7; /* Increased visibility */
		transition:
			opacity 0.2s ease,
			transform 0.2s ease;
		min-height: 150px;
		width: var(--timeline-card-width, 180px);
		position: relative; /* For the overlay trigger */
		cursor: pointer;
	}

	.timeline-card:hover,
	.timeline-card:focus-within {
		opacity: 1;
		transform: translateY(-4px);
		border-color: var(--primary);
	}

	.card-cover {
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: calc(var(--radius) - 4px);
		overflow: hidden;
		background: var(--muted);
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.75rem;
	}

	.card-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-placeholder {
		font-size: 2.5rem;
		color: var(--muted-foreground);
	}

	.card-year {
		position: absolute;
		right: 0.5rem;
		bottom: 0.5rem;
		background: rgb(0 0 0 / 0.7);
		color: white;
		padding: 0.25rem 0.625rem;
		border-radius: 999px;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.card-same-year-badge {
		position: absolute;
		left: 0.5rem;
		top: 0.5rem;
		background: var(--primary);
		color: white;
		padding: 0.25rem 0.625rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.card-info {
		width: 100%;
		text-align: center;
	}

	.card-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--foreground);
		margin-bottom: 0.375rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-year-text {
		font-size: 0.8rem;
		color: var(--primary);
		font-weight: 600;
		margin-bottom: 0.375rem;
	}

	.card-artist {
		font-size: 0.8rem;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tooltip-title {
		font-weight: 600;
		margin: 0;
	}

	.tooltip-hint {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.8);
	}

	.tooltip-track-list {
		list-style: none;
		padding: 0;
		margin: 0.5rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.tooltip-track-list li {
		font-size: 0.8rem;
		color: rgb(255 255 255 / 0.95);
	}

	.tooltip-track-name {
		font-weight: 600;
	}

	.tooltip-track-artist {
		font-weight: 400;
		opacity: 0.9;
	}

	/* Dialog styles */
	.track-details-dialog {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dialog-cover-image {
		width: 100%;
		max-width: 200px;
		aspect-ratio: 1 / 1;
		border-radius: var(--radius);
		object-fit: cover;
		margin: 0 auto;
	}

	.details-grid {
		display: grid;
		gap: 0.5rem;
	}

	.details-grid p {
		margin: 0;
	}

	.details-grid a {
		color: var(--primary);
		text-decoration: none;
	}

	.details-grid a:hover {
		text-decoration: underline;
	}
</style>
