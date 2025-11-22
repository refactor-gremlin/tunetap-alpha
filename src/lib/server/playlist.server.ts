import { YouTube } from 'youtube-sr';
import type { Track } from '$lib/types';
import {
	getCachedPlaylist,
	cachePlaylist,
	getCachedAudioSource,
	cacheAudioSource
} from '$lib/server/db';
import { musicBrainzQueue } from '$lib/server/musicbrainz-queue';

// spotify-url-info is a CommonJS module that exports a function taking fetch
// Import as default and cast to the correct type
// @ts-expect-error - spotify-url-info is a CommonJS module without TypeScript definitions
import spotifyUrlInfoDefault from 'spotify-url-info';

interface SpotifyArtist {
	name: string;
}

interface SpotifyTrack {
	name?: string;
	artist?: string; // Singular string format from spotify-url-info
	artists?: SpotifyArtist[]; // Array format (if different API)
	previewUrl?: string; // camelCase format from spotify-url-info
	preview_url?: string; // snake_case format (if different API)
	uri?: string;
}

type SpotifyUrlInfo = (fetch: typeof globalThis.fetch) => {
	getTracks: (url: string, opts?: unknown) => Promise<SpotifyTrack[]>;
	getData: (url: string, opts?: unknown) => Promise<unknown>;
	getPreview: (url: string, opts?: unknown) => Promise<unknown>;
	getDetails: (url: string, opts?: unknown) => Promise<unknown>;
	getLink: (url: string, opts?: unknown) => Promise<unknown>;
};

const spotifyUrlInfo = spotifyUrlInfoDefault as unknown as SpotifyUrlInfo;
const spotify = spotifyUrlInfo(fetch);
const { getTracks, getPreview } = spotify;

interface SpotifyPreviewData {
	image?: string;
	audio?: string;
}

interface ProgressSnapshot {
	status: string;
	current: number;
	total: number;
	message: string;
	jobId: string;
	updatedAt: number;
}

const progressStore = new Map<string, ProgressSnapshot>();

const createJobId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function scheduleProgressCleanup(playlistUrl: string, jobId: string) {
	setTimeout(() => {
		console.log(`[processPlaylist] Cleaning up progress store for URL: ${playlistUrl}`);
		const snapshot = progressStore.get(playlistUrl);
		if (snapshot && snapshot.jobId === jobId) {
			progressStore.delete(playlistUrl);
		}
	}, 60000);
}

export function getProgress(playlistUrl: string) {
	if (!playlistUrl) return null;
	const snapshot = progressStore.get(playlistUrl);
	if (!snapshot) return null;
	const { status, current, total, message } = snapshot;
	return { status, current, total, message };
}

function getArtistsFromSpotifyTrack(spotifyTrack: SpotifyTrack): string[] {
	let artists: string[] = [];

	// Check for singular "artist" string (from spotify-url-info)
	if (spotifyTrack.artist && typeof spotifyTrack.artist === 'string') {
		// Split by comma in case there are multiple artists
		artists = spotifyTrack.artist
			.split(',')
			.map((a) => a.trim())
			.filter((a) => a.length > 0);
	}
	// Check for plural "artists" array (from other APIs)
	else if (spotifyTrack.artists) {
		if (Array.isArray(spotifyTrack.artists)) {
			artists = spotifyTrack.artists
				.map((artist) => {
					// Handle both object format {name: "..."} and string format
					if (typeof artist === 'string') {
						return artist;
					} else if (artist && typeof artist === 'object' && 'name' in artist) {
						return artist.name;
					}
					return '';
				})
				.filter((name) => name.length > 0);
		}
	}
	return artists;
}

// In-memory timestamp cache for background refresh
const lastBackgroundRefresh = new Map<string, number>();
const BACKGROUND_REFRESH_COOLDOWN = 5 * 60 * 1000; // 5 minutes

function queueTracksForMusicBrainz(spotifyTracks: SpotifyTrack[]) {
	console.log(`[Background] Queueing ${spotifyTracks.length} tracks for MusicBrainz lookup...`);
	spotifyTracks.forEach((track) => {
		const artists = getArtistsFromSpotifyTrack(track);
		const trackName = track.name || '';
		const artistNames = artists.join(', ');

		if (trackName && artistNames) {
			// Queue with low priority for background pre-fetching
			musicBrainzQueue.enqueue(trackName, artistNames, 'low').catch((err) => {
				console.error(`[Background Queue] Failed to enqueue "${trackName}":`, err);
			});
		}
	});
}

async function fetchAndQueueBackground(playlistUrl: string) {
	console.log(`[Background] Fetching full playlist to populate MusicBrainz queue...`);
	try {
		const spotifyTracks = (await getTracks(playlistUrl)) as SpotifyTrack[];
		console.log(`[Background] Found ${spotifyTracks.length} tracks. Queueing...`);
		queueTracksForMusicBrainz(spotifyTracks);
	} catch (error) {
		console.error(`[Background] Failed to fetch playlist for background queueing:`, error);
	}
}

export async function processPlaylist(
	playlistUrl: string,
	onProgress?: (status: string, current: number, total: number, message: string) => void
): Promise<Track[]> {
	console.log('[processPlaylist] Starting processing for URL:', playlistUrl);
	const jobId = createJobId();

	const updateProgress = (status: string, current: number, total: number, message: string) => {
		console.log(
			`[processPlaylist] Progress update - Status: ${status}, Current: ${current}/${total}, Message: ${message}`
		);
		progressStore.set(playlistUrl, {
			status,
			current,
			total,
			message,
			jobId,
			updatedAt: Date.now()
		});
		if (onProgress) {
			onProgress(status, current, total, message);
		}
	};

	// 1. Check Playlist Cache
	const cachedTracksJson = await getCachedPlaylist(playlistUrl);
	if (cachedTracksJson) {
		console.log(`[processPlaylist] Found cached playlist for "${playlistUrl}"`);
		try {
			const cachedTracks = JSON.parse(cachedTracksJson) as Track[];
			updateProgress(
				'completed',
				cachedTracks.length,
				cachedTracks.length,
				`Loaded ${cachedTracks.length} tracks from cache`
			);

			// Check if we should trigger background refresh
			const now = Date.now();
			const lastRefresh = lastBackgroundRefresh.get(playlistUrl) || 0;
			
			if (now - lastRefresh > BACKGROUND_REFRESH_COOLDOWN) {
				console.log(`[processPlaylist] Triggering background queue population (last refresh was > 5m ago)`);
				lastBackgroundRefresh.set(playlistUrl, now);
				
				// Fire-and-forget background fetch
				fetchAndQueueBackground(playlistUrl).catch(err => 
					console.error(`[Background] Error in background queue population:`, err)
				);
			} else {
				console.log(`[processPlaylist] Skipping background queue population (cooldown active)`);
			}

			// Clean up progress after a delay
			scheduleProgressCleanup(playlistUrl, jobId);
			return cachedTracks;
		} catch (error) {
			console.error('[processPlaylist] Error parsing cached playlist:', error);
			// Fallback to normal processing if cache is invalid
		}
	}

	updateProgress('fetching', 0, 0, 'Fetching tracks from Spotify...');
	console.log('[processPlaylist] Fetching tracks from Spotify...');
	let spotifyTracks: SpotifyTrack[] = [];
	try {
		spotifyTracks = (await getTracks(playlistUrl)) as SpotifyTrack[];
	} catch (error) {
		console.error('[processPlaylist] Error fetching tracks from Spotify:', error);
		throw new Error('Failed to fetch playlist from Spotify');
	}

	console.log(`[processPlaylist] Fetched ${spotifyTracks.length} tracks from Spotify`);
	
	// Queue tracks for MusicBrainz lookup
	queueTracksForMusicBrainz(spotifyTracks);

	// Limit playlist processing to 100 random tracks if larger
	let tracksToProcess = spotifyTracks;
	if (spotifyTracks.length > 100) {
		console.log(`[processPlaylist] Playlist has ${spotifyTracks.length} tracks, limiting to 100 random tracks`);
		// Shuffle array
		const shuffled = [...spotifyTracks].sort(() => Math.random() - 0.5);
		tracksToProcess = shuffled.slice(0, 100);
		
		updateProgress(
			'processing',
			0,
			spotifyTracks.length, // Show total available
			`Playlist too large (${spotifyTracks.length} tracks). Selecting 100 random tracks...`
		);
	} else {
		updateProgress(
			'processing',
			0,
			spotifyTracks.length,
			`Found ${spotifyTracks.length} tracks from Spotify`
		);
	}

	const tracks: Track[] = [];

	// Process tracks with a timeout for YouTube searches
	const processTrack = async (spotifyTrack: SpotifyTrack, index: number): Promise<Track> => {
		console.log(
			`[processTrack] Raw Spotify track data for track ${index + 1}:`,
			JSON.stringify(spotifyTrack, null, 2)
		);

		// Extract artists using helper
		const artists = getArtistsFromSpotifyTrack(spotifyTrack);
		if (artists.length > 0) {
			console.log(`[processTrack] Found artists: ${artists.join(', ')}`);
		} else {
			// If helper didn't find anything, double check for debugging (optional, but keeping logs similar to before)
			if (spotifyTrack.artist) {
				console.log(`[processTrack] Found artist (singular) property: "${spotifyTrack.artist}"`);
			} else if (spotifyTrack.artists) {
				console.log(`[processTrack] Found artists (plural) array`);
			}
		}

		const artistNames = artists.join(', ');
		const trackName = spotifyTrack.name || '';
		const trackId = spotifyTrack.uri ? spotifyTrack.uri.split(':').pop() || '' : '';

		console.log(
			`[processTrack] Processing track ${index + 1}: "${trackName}" by ${artistNames || '(no artists)'}`
		);

		// 2. Check Audio Source Cache
		const cachedAudio = await getCachedAudioSource(trackName, artistNames);
		if (cachedAudio) {
			console.log(`[processTrack] Found cached audio source for track ${index + 1}`);
			updateProgress(
				'processing',
				index + 1,
				spotifyTracks.length,
				`[${index + 1}/${spotifyTracks.length}] ${trackName} - Loaded from cache`
			);
			return {
				id: trackId,
				name: trackName,
				artists,
				audioUrl: cachedAudio.audioUrl || undefined,
				status: cachedAudio.status as 'found' | 'missing',
				spotifyPreviewUrl: cachedAudio.spotifyPreviewUrl || undefined,
				youtubeUrl: cachedAudio.youtubeUrl || undefined,
				coverImage: cachedAudio.coverImage || undefined
			};
		}

		// Check if Spotify provides a preview URL - handle both camelCase and snake_case
		const spotifyPreviewUrl = spotifyTrack.previewUrl || spotifyTrack.preview_url;
		let coverImage: string | undefined;

		if (spotifyTrack.uri) {
			try {
				const previewData = (await getPreview(spotifyTrack.uri)) as SpotifyPreviewData;
				coverImage = previewData?.image;
			} catch (error) {
				console.warn(`[processTrack] Failed fetching preview data for track ${index + 1}:`, error);
			}
		}

		let audioUrl: string | undefined;
		let status: 'found' | 'missing' = 'missing';
		let youtubeUrl: string | undefined;

		if (spotifyPreviewUrl) {
			// Use Spotify preview URL
			console.log(
				`[processTrack] Track ${index + 1} has Spotify preview URL: ${spotifyPreviewUrl}`
			);
			audioUrl = spotifyPreviewUrl;
			status = 'found';
			updateProgress(
				'processing',
				index + 1,
				spotifyTracks.length,
				`[${index + 1}/${spotifyTracks.length}] ${trackName} - Using Spotify preview`
			);
		} else {
			// Search YouTube for the track with timeout
			try {
				// Construct search query with artist and track name
				// If no artist, just use track name
				const searchQuery = artistNames ? `${artistNames} ${trackName}` : trackName;
				console.log(`[processTrack] Track ${index + 1} has no Spotify preview`);
				console.log(`[processTrack] Artists available: ${artists.length > 0 ? 'YES' : 'NO'}`);
				console.log(`[processTrack] Artist names: "${artistNames}"`);
				console.log(`[processTrack] Track name: "${trackName}"`);
				console.log(`[processTrack] Final YouTube search query: "${searchQuery}"`);
				updateProgress(
					'processing',
					index + 1,
					spotifyTracks.length,
					`[${index + 1}/${spotifyTracks.length}] ${trackName} - Searching YouTube...`
				);

				// Add timeout to YouTube search (5 seconds)
				const youtubePromise = YouTube.searchOne(searchQuery);
				const timeoutPromise = new Promise((_, reject) =>
					setTimeout(() => reject(new Error('YouTube search timeout')), 5000)
				);

				const youtubeResult = (await Promise.race([youtubePromise, timeoutPromise])) as unknown;
				console.log(`[processTrack] YouTube search result for track ${index + 1}:`, youtubeResult);

				if (youtubeResult && typeof youtubeResult === 'object' && 'url' in youtubeResult) {
					const url = (youtubeResult as { url?: string }).url;
					if (url) {
						console.log(`[processTrack] Found YouTube URL for track ${index + 1}: ${url}`);
						audioUrl = url;
						youtubeUrl = url;
						status = 'found';
						updateProgress(
							'processing',
							index + 1,
							spotifyTracks.length,
							`[${index + 1}/${spotifyTracks.length}] ${trackName} - Found YouTube video`
						);
					} else {
						console.log(`[processTrack] Track ${index + 1} YouTube result has no URL`);
						updateProgress(
							'processing',
							index + 1,
							spotifyTracks.length,
							`[${index + 1}/${spotifyTracks.length}] ${trackName} - No YouTube video found`
						);
					}
				} else {
					console.log(`[processTrack] Track ${index + 1} YouTube search returned invalid result`);
					updateProgress(
						'processing',
						index + 1,
						spotifyTracks.length,
						`[${index + 1}/${spotifyTracks.length}] ${trackName} - No YouTube video found`
					);
				}
			} catch (error) {
				// YouTube search failed or timed out, mark as missing
				console.error(`[processTrack] YouTube search failed for track ${index + 1}:`, error);
				updateProgress(
					'processing',
					index + 1,
					spotifyTracks.length,
					`[${index + 1}/${spotifyTracks.length}] ${trackName} - YouTube search failed: ${(error as Error).message}`
				);
			}
		}

		// 3. Cache Audio Source Result
		await cacheAudioSource({
			trackName,
			artistName: artistNames,
			audioUrl: audioUrl || null,
			spotifyPreviewUrl: spotifyPreviewUrl || null,
			youtubeUrl: youtubeUrl || null,
			coverImage: coverImage || null,
			status
		});

		const trackResult: Track = {
			id: trackId,
			name: trackName,
			artists,
			audioUrl,
			status,
			spotifyPreviewUrl,
			youtubeUrl,
			coverImage
		};
		console.log(
			`[processTrack] Completed track ${index + 1}, status: ${status}, audioUrl: ${audioUrl || 'none'}`
		);
		return trackResult;
	};

	// Process tracks in parallel batches to speed things up
	const batchSize = 5;
	console.log(
		`[processPlaylist] Processing ${tracksToProcess.length} tracks in batches of ${batchSize}`
	);
	for (let i = 0; i < tracksToProcess.length; i += batchSize) {
		const batch = tracksToProcess.slice(i, i + batchSize);
		console.log(
			`[processPlaylist] Processing batch starting at index ${i}, batch size: ${batch.length}`
		);
		const batchResults = await Promise.all(
			batch.map((track, batchIndex) => processTrack(track, i + batchIndex))
		);
		tracks.push(...batchResults);
		const processed = Math.min(i + batchSize, tracksToProcess.length);
		console.log(
			`[processPlaylist] Completed batch, total processed: ${processed}/${tracksToProcess.length}`
		);
		updateProgress(
			'processing',
			processed,
			tracksToProcess.length,
			`Processed ${processed}/${tracksToProcess.length} tracks`
		);
	}

	// 4. Cache Playlist Result
	if (tracks.length > 0) {
		// Note: We are only caching the PROCESSED tracks (the random 100 or less)
		// If the user reloads, they will get these same 100 tracks from cache.
		// This is acceptable behavior as it keeps the playlist consistent for the session.
		await cachePlaylist(playlistUrl, JSON.stringify(tracks));
	}

	const foundCount = tracks.filter((t) => t.status === 'found').length;
	console.log(
		`[processPlaylist] Finished processing. Found ${foundCount} tracks with audio out of ${tracks.length} total`
	);
	updateProgress(
		'completed',
		spotifyTracks.length, // Use original length for final progress
		spotifyTracks.length,
		`Finished processing. Selected ${tracks.length} tracks, found ${foundCount} with audio.`
	);

	// Clean up progress after a delay
	scheduleProgressCleanup(playlistUrl, jobId);

	console.log(`[processPlaylist] Returning ${tracks.length} tracks`);
	return tracks;
}
