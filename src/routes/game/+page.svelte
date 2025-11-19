<script lang="ts">
	import type { Track } from '$lib/types';
	import { page } from '$app/stores';
	import {
		fetchFirstReleaseDate,
		getQueueSize,
		getCachedReleaseDatesBatchQuery
	} from './musicbrainz.remote';
	import { untrack } from 'svelte';
	import { useInterval } from 'runed';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { Badge } from '$lib/components/shadncn-ui/badge/index.js';
	import { Spinner } from '$lib/components/shadncn-ui/spinner/index.js';
	import * as Table from '$lib/components/shadncn-ui/table/index.js';
	import PageHeader from '$lib/components/custom/PageHeader.svelte';

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

			// Batch check database cache first
			async function initializeTracks() {
				// Prepare tracks for batch check (only those without dates and with artists)
				const tracksToCheck = pageState
					.tracks!.map((track, index) => ({ index, track }))
					.filter(({ track }) => !track.firstReleaseDate && track.artists.length > 0);

				// Initialize cachedDates object
				let cachedDates: Record<string, string | null> = {};

				if (tracksToCheck.length > 0) {
					// Batch check database cache
					const batchCheckTracks = tracksToCheck.map(({ track }) => ({
						trackName: track.name,
						artistName: track.artists[0]
					}));

					try {
						cachedDates = await getCachedReleaseDatesBatchQuery({ tracks: batchCheckTracks });

						// Update tracks with cached dates immediately
						untrack(() => {
							for (const { index, track } of tracksToCheck) {
								const key = `${track.name}|${track.artists[0]}`;
								const cachedDate = cachedDates[key];

								if (cachedDate !== undefined && cachedDate !== null) {
									// Found in cache, update track immediately
									const date = cachedDate;
									dates.set(index, date);
									tracks = tracks.map((t, idx) =>
										idx === index ? { ...t, firstReleaseDate: date } : t
									);
								}
							}
							releaseDates = new Map(dates);
						});
					} catch (error) {
						console.error('[Game] Error in batch cache check:', error);
					}
				}

				// Store tracks that already have dates
				pageState.tracks!.forEach((track, index) => {
					if (track.firstReleaseDate) {
						dates.set(index, track.firstReleaseDate);
					}
				});

				// Now only queue tracks that weren't found in cache and don't have dates
				const tracksToFetch: Array<{ index: number; track: Track }> = [];
				for (const { index, track } of tracksToCheck) {
					const key = `${track.name}|${track.artists[0]}`;
					const cachedDate = cachedDates[key];

					// Only queue if not found in cache (null or undefined)
					if (cachedDate === null || cachedDate === undefined) {
						tracksToFetch.push({ index, track });
					}
				}

				// Queue all items at once, then process them sequentially via the queue
				// This allows the queue size to accurately reflect pending items
				for (const { index, track } of tracksToFetch) {
					const artistName = track.artists[0];
					const promise = fetchFirstReleaseDate({ trackName: track.name, artistName }).then(
						(date) => {
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
						}
					);
					promises.set(index, promise);
				}

				// Update promises map once all are queued
				releaseDatePromises = new Map(promises);
				releaseDates = dates;
			}

			// Start initialization
			initializeTracks();
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
		audioElement
			.play()
			.then(() => {
				console.log('[playTrack] Audio playback started successfully');
			})
			.catch((error) => {
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

<PageHeader title="Game">
	{#snippet rightActions()}
		<Badge variant="default">
			Server Queue: {queueSize}
		</Badge>
	{/snippet}
</PageHeader>

{#if tracks.length === 0}
	<Card.Root class="no-tracks">
		<Card.Content>
			<p>No tracks available. Please go back and load a playlist.</p>
			<Button variant="link" href="/playlist">Back to Playlist Input</Button>
		</Card.Content>
	</Card.Root>
{/if}

{#if tracks.length > 0}
	<div class="game-content">
		<Card.Root class="track-info">
			<Card.Header>
				<Card.Title>Track {currentTrackIndex + 1} of {tracks.length}</Card.Title>
			</Card.Header>
			<Card.Content>
				{#if tracks[currentTrackIndex]}
					{@const track = tracks[currentTrackIndex]}
					<div class="controls">
						<Button onclick={() => playTrack(track)}>Play</Button>
						<Button variant="outline" onclick={stopTrack}>Stop</Button>
					</div>
					<div class="track-details">
						<p>
							<strong>Status:</strong>
							<Badge variant={track.status === 'found' ? 'default' : 'destructive'}>
								{track.status}
							</Badge>
						</p>
						<p>
							<strong>Audio:</strong>
							<Badge variant={track.audioUrl ? 'default' : 'secondary'}>
								{track.audioUrl ? 'Available' : 'Missing'}
							</Badge>
						</p>
						<p>
							<strong>Release Date:</strong>
							{#if track.firstReleaseDate}
								<Badge variant="default">{track.firstReleaseDate}</Badge>
							{:else if getReleaseDatePromise(currentTrackIndex)}
								{#await getReleaseDatePromise(currentTrackIndex)}
									<span class="loading-date">
										<Spinner />
										Loading...
									</span>
								{:then date}
									{#if date}
										<Badge variant="default">{date}</Badge>
									{:else}
										<Badge variant="destructive">Not found</Badge>
									{/if}
								{:catch}
									<Badge variant="destructive">Error</Badge>
								{/await}
							{:else}
								<Badge variant="destructive">Not found</Badge>
							{/if}
						</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root class="track-list">
			<Card.Header>
				<Card.Title>All Tracks</Card.Title>
			</Card.Header>
			<Card.Content>
				<Table.Root>
					<Table.Body>
						{#each tracks as track, index}
							<Table.Row
								data-state={index === currentTrackIndex ? 'selected' : undefined}
								class="selected-row"
								onclick={() => (currentTrackIndex = index)}
							>
								<Table.Cell class="track-name-cell">
									{track.name} - {track.artists.join(', ')}
								</Table.Cell>
								<Table.Cell class="status-cell">
									{#if track.status === 'found'}
										<Badge variant="default">✓</Badge>
									{:else}
										<Badge variant="destructive">✗</Badge>
									{/if}
								</Table.Cell>
								<Table.Cell class="date-cell">
									{#if !track.firstReleaseDate && getReleaseDatePromise(index)}
										{#await getReleaseDatePromise(index)}
											<Spinner />
										{:then date}
											{#if date}
												<Badge variant="default">{date}</Badge>
											{:else}
												<Badge variant="destructive">✗</Badge>
											{/if}
										{:catch error}
											<Badge variant="destructive">✗</Badge>
										{/await}
									{:else if track.firstReleaseDate}
										<Badge variant="default">{track.firstReleaseDate}</Badge>
									{:else}
										<Badge variant="destructive">✗</Badge>
									{/if}
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>
{/if}

<style>
	.game-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	.controls {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
	}

	.track-details {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.track-details p {
		margin: 0;
		color: var(--foreground);
	}

	.track-list :global(table) {
		width: 100%;
	}

	.track-list :global(tr.selected-row) {
		cursor: pointer;
		position: relative;
	}

	.track-list :global(tr.selected-row[data-state='selected']) {
		background-color: var(--accent);
		border-left: 3px solid var(--primary);
	}

	.track-list :global(tr.selected-row[data-state='selected']:hover) {
		background-color: var(--accent);
		opacity: 0.95;
	}

	.track-list :global(tr.selected-row:hover:not([data-state='selected'])) {
		background-color: color-mix(in oklch, var(--muted) 50%, transparent);
	}

	.track-name-cell {
		width: auto;
		min-width: 0;
	}

	.status-cell {
		width: 80px;
		text-align: center;
	}

	.date-cell {
		width: 120px;
		text-align: right;
	}

	.loading-date {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted-foreground);
	}
</style>
