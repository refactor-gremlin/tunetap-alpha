<script lang="ts">
	import type { Track } from '$lib/types';
	import { page } from '$app/stores';
	import { fetchFirstReleaseDate, getQueueSize } from './musicbrainz.remote';
	import { untrack } from 'svelte';
	import { useInterval } from 'runed';

	// Get tracks from navigation state
	let tracks = $state<Track[]>([]);
	let currentTrackIndex = $state(0);
	let audioElement: HTMLAudioElement | null = $state(null);
	let releaseDatePromises = $state<Map<number, Promise<string | undefined>>>(new Map());
	let releaseDates = $state<Map<number, string | undefined>>(new Map());
	let hasInitialized = $state(false);
	
	// Poll queue size every second
	let queueSize = $state(0);
	
	const queueSizeInterval = useInterval(1000, {
		callback: async () => {
			try {
				const size = await getQueueSize();
				queueSize = size;
			} catch (error) {
				console.error('[Game] Error fetching queue size:', error);
			}
		}
	});

	// Initialize tracks from page state (only once)
	$effect(() => {
		const pageState = $page.state as { tracks?: Track[] };
		if (pageState?.tracks && !hasInitialized) {
			hasInitialized = true;
			tracks = pageState.tracks;
			// Create promises sequentially, starting from top
			const promises = new Map<number, Promise<string | undefined>>();
			const dates = new Map<number, string | undefined>();
			
			// Store tracks that need fetching
			const tracksToFetch: Array<{ index: number; track: Track }> = [];
			pageState.tracks.forEach((track, index) => {
				if (track.firstReleaseDate) {
					// Track already has a date, store it
					dates.set(index, track.firstReleaseDate);
				} else if (track.artists.length > 0) {
					// Track needs fetching
					tracksToFetch.push({ index, track });
				}
			});
			
			// Fetch sequentially, starting from top (index 0)
			async function fetchSequentially() {
				for (const { index, track } of tracksToFetch) {
					const artistName = track.artists[0];
					const promise = fetchFirstReleaseDate({ trackName: track.name, artistName }).then((date) => {
						// Use untrack to prevent reactivity from triggering effects
						untrack(() => {
							// Store the date in the map
							dates.set(index, date);
							releaseDates = new Map(dates);
							// Update tracks array
							if (date) {
								tracks = tracks.map((t, idx) => 
									idx === index ? { ...t, firstReleaseDate: date } : t
								);
							}
						});
						return date;
					});
					promises.set(index, promise);
					releaseDatePromises = new Map(promises);
					
					// Wait for this promise to complete before starting the next one
					// This ensures rate limiting is respected (1 per second)
					await promise;
				}
			}
			
			// Start fetching sequentially
			fetchSequentially();
			releaseDates = dates;
		}
	});

	// Helper function to get release date promise for a track
	function getReleaseDatePromise(trackIndex: number): Promise<string | undefined> | null {
		return releaseDatePromises.get(trackIndex) || null;
	}

	function playTrack(track: Track) {
		console.log('[playTrack] Called with track:', track.name, 'by', track.artists.join(', '));
		if (!track.audioUrl) {
			console.warn('[playTrack] Track has no audioUrl, cannot play');
			return;
		}

		if (audioElement) {
			console.log('[playTrack] Stopping current audio element');
			audioElement.pause();
		}

		console.log('[playTrack] Creating new Audio element with URL:', track.audioUrl);
		audioElement = new Audio(track.audioUrl);
		audioElement.play().then(() => {
			console.log('[playTrack] Audio playback started successfully');
		}).catch((error) => {
			console.error('[playTrack] Error playing audio:', error);
		});
	}

	function stopTrack() {
		console.log('[stopTrack] Called');
		if (audioElement) {
			console.log('[stopTrack] Pausing and clearing audio element');
			audioElement.pause();
			audioElement = null;
		} else {
			console.log('[stopTrack] No audio element to stop');
		}
	}
</script>

<div class="game-page">
	<div class="header">
		<h1>Game</h1>
		<div class="queue-indicator">
			Server Queue: {queueSize}
		</div>
	</div>

	{#if tracks.length === 0}
		<div class="no-tracks">
			<p>No tracks available. Please go back and load a playlist.</p>
			<a href="/playlist">Back to Playlist Input</a>
		</div>
	{/if}

	{#if tracks.length > 0}
		<div class="game-content">
			<div class="track-info">
				<h2>Track {currentTrackIndex + 1} of {tracks.length}</h2>
				{#if tracks[currentTrackIndex]}
					{@const track = tracks[currentTrackIndex]}
					<div class="controls">
						<button onclick={() => playTrack(track)}>Play</button>
						<button onclick={stopTrack}>Stop</button>
					</div>
					<div class="track-details">
						<p><strong>Status:</strong> {track.status}</p>
						{#if track.audioUrl}
							<p><strong>Audio:</strong> Available</p>
						{:else}
							<p><strong>Audio:</strong> Missing</p>
						{/if}
						<p><strong>Release Date:</strong>
							{#if track.firstReleaseDate}
								{track.firstReleaseDate}
							{:else if getReleaseDatePromise(currentTrackIndex)}
								{#await getReleaseDatePromise(currentTrackIndex)}
									<span class="loading-date">
										<svg class="clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<circle cx="12" cy="12" r="10"></circle>
											<polyline points="12 6 12 12 16 14"></polyline>
										</svg>
										Loading...
									</span>
								{:then date}
									{#if date}
										{date}
									{:else}
										<span class="not-found">
											<svg class="x-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<line x1="18" y1="6" x2="6" y2="18"></line>
												<line x1="6" y1="6" x2="18" y2="18"></line>
											</svg>
											Not found
										</span>
									{/if}
								{:catch}
									<span class="not-found">
										<svg class="x-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
											<line x1="18" y1="6" x2="6" y2="18"></line>
											<line x1="6" y1="6" x2="18" y2="18"></line>
										</svg>
										Error
									</span>
								{/await}
							{:else}
								<span class="not-found">
									<svg class="x-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="18" y1="6" x2="6" y2="18"></line>
										<line x1="6" y1="6" x2="18" y2="18"></line>
									</svg>
									Not found
								</span>
							{/if}
						</p>
					</div>
				{/if}
			</div>

			<div class="track-list">
				<h3>All Tracks</h3>
				<ul>
					{#each tracks as track, index}
						<li class:active={index === currentTrackIndex}>
							<button onclick={() => (currentTrackIndex = index)}>
								{track.name} - {track.artists.join(', ')}
								{#if track.status === 'found'}
									<span class="status-found">✓</span>
								{:else}
									<span class="status-missing">✗</span>
								{/if}
								{#if !track.firstReleaseDate && getReleaseDatePromise(index)}
									{#await getReleaseDatePromise(index)}
										<span class="loading-date-inline">
											<svg class="clock-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<circle cx="12" cy="12" r="10"></circle>
												<polyline points="12 6 12 12 16 14"></polyline>
											</svg>
										</span>
									{:then date}
										{#if date}
											<span class="release-date-badge">{date}</span>
										{:else}
											<span class="not-found-inline">
												<svg class="x-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
													<line x1="18" y1="6" x2="6" y2="18"></line>
													<line x1="6" y1="6" x2="18" y2="18"></line>
												</svg>
											</span>
										{/if}
									{:catch error}
										<span class="not-found-inline">
											<svg class="x-icon-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<line x1="18" y1="6" x2="6" y2="18"></line>
												<line x1="6" y1="6" x2="18" y2="18"></line>
											</svg>
										</span>
									{/await}
								{:else if track.firstReleaseDate}
									<span class="release-date-badge">{track.firstReleaseDate}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
</div>

<style>
	.game-page {
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		position: relative;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		text-align: center;
		flex: 1;
	}

	.queue-indicator {
		position: absolute;
		top: 0;
		right: 0;
		background-color: #1db954;
		color: white;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.game-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	.track-info {
		padding: 2rem;
		background-color: #f5f5f5;
		border-radius: 0.5rem;
	}

	.controls {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
	}

	button {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		background-color: #1db954;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	button:hover {
		background-color: #1ed760;
	}

	.track-list {
		padding: 2rem;
		background-color: #f5f5f5;
		border-radius: 0.5rem;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	li {
		margin-bottom: 0.5rem;
	}

	li button {
		width: 100%;
		text-align: left;
		background-color: white;
		color: #333;
		border: 1px solid #ddd;
	}

	li.active button {
		background-color: #1db954;
		color: white;
	}

	.status-found {
		color: #1db954;
		margin-left: 0.5rem;
	}

	.status-missing {
		color: #e74c3c;
		margin-left: 0.5rem;
	}

	.not-found {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #e74c3c;
		font-style: italic;
	}

	.x-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.not-found-inline {
		display: inline-flex;
		align-items: center;
		margin-left: 0.5rem;
	}

	.x-icon-inline {
		width: 0.875rem;
		height: 0.875rem;
		color: #e74c3c;
	}

	.loading-date {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: #666;
	}

	.clock-icon {
		width: 1rem;
		height: 1rem;
		animation: rotate 2s linear infinite;
	}

	.clock-icon-inline {
		width: 0.875rem;
		height: 0.875rem;
		animation: rotate 2s linear infinite;
		margin-left: 0.5rem;
		vertical-align: middle;
	}

	@keyframes rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.loading-date-inline {
		display: inline-flex;
		align-items: center;
		margin-left: 0.5rem;
	}

	.release-date-badge {
		margin-left: 0.5rem;
		font-size: 0.875rem;
		color: #1db954;
		font-weight: 500;
	}
</style>

