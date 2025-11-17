import { YouTube } from 'youtube-sr';
import type { Track } from '$lib/types';

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
const { getTracks } = spotify;

// Progress tracking storage
const progressStore = new Map<string, {
	status: string;
	current: number;
	total: number;
	message: string;
}>();

let currentProcessingUrl: string | null = null;

export function getProgress() {
	console.log('[getProgress] Called');
	if (!currentProcessingUrl) {
		console.log('[getProgress] No current processing URL, returning null');
		return null;
	}
	const progress = progressStore.get(currentProcessingUrl) || null;
	console.log('[getProgress] Returning progress:', progress);
	return progress;
}

export async function processPlaylist(
	playlistUrl: string,
	onProgress?: (status: string, current: number, total: number, message: string) => void
): Promise<Track[]> {
	console.log('[processPlaylist] Starting processing for URL:', playlistUrl);
	currentProcessingUrl = playlistUrl;
	
	const updateProgress = (status: string, current: number, total: number, message: string) => {
		console.log(`[processPlaylist] Progress update - Status: ${status}, Current: ${current}/${total}, Message: ${message}`);
		progressStore.set(playlistUrl, { status, current, total, message });
		if (onProgress) {
			onProgress(status, current, total, message);
		}
	};

	updateProgress('fetching', 0, 0, 'Fetching tracks from Spotify...');
	console.log('[processPlaylist] Fetching tracks from Spotify...');
	const spotifyTracks = await getTracks(playlistUrl) as SpotifyTrack[];
	console.log(`[processPlaylist] Fetched ${spotifyTracks.length} tracks from Spotify`);
	updateProgress('processing', 0, spotifyTracks.length, `Found ${spotifyTracks.length} tracks from Spotify`);
	
	const tracks: Track[] = [];
	
	// Process tracks with a timeout for YouTube searches
	const processTrack = async (spotifyTrack: SpotifyTrack, index: number): Promise<Track> => {
		console.log(`[processTrack] Raw Spotify track data for track ${index + 1}:`, JSON.stringify(spotifyTrack, null, 2));
		
		// Extract artists - handle different possible formats
		let artists: string[] = [];
		
		// Check for singular "artist" string (from spotify-url-info)
		if (spotifyTrack.artist && typeof spotifyTrack.artist === 'string') {
			// Split by comma in case there are multiple artists
			artists = spotifyTrack.artist.split(',').map(a => a.trim()).filter(a => a.length > 0);
			console.log(`[processTrack] Found artist (singular) property: "${spotifyTrack.artist}"`);
		}
		// Check for plural "artists" array (from other APIs)
		else if (spotifyTrack.artists) {
			if (Array.isArray(spotifyTrack.artists)) {
				artists = spotifyTrack.artists.map((artist) => {
					// Handle both object format {name: "..."} and string format
					if (typeof artist === 'string') {
						return artist;
					} else if (artist && typeof artist === 'object' && 'name' in artist) {
						return artist.name;
					}
					return '';
				}).filter(name => name.length > 0);
				console.log(`[processTrack] Found artists (plural) array`);
			}
		}
		
		const artistNames = artists.join(', ');
		const trackName = spotifyTrack.name || '';
		console.log(`[processTrack] Processing track ${index + 1}: "${trackName}" by ${artistNames || '(no artists)'}`);
		console.log(`[processTrack] Extracted artists array:`, artists);
		console.log(`[processTrack] Artist names string: "${artistNames}"`);
		
		// Check if Spotify provides a preview URL - handle both camelCase and snake_case
		const spotifyPreviewUrl = spotifyTrack.previewUrl || spotifyTrack.preview_url;
		
		let audioUrl: string | undefined;
		let status: 'found' | 'missing' = 'missing';
		
		if (spotifyPreviewUrl) {
			// Use Spotify preview URL
			console.log(`[processTrack] Track ${index + 1} has Spotify preview URL: ${spotifyPreviewUrl}`);
			audioUrl = spotifyPreviewUrl;
			status = 'found';
			updateProgress('processing', index + 1, spotifyTracks.length, `[${index + 1}/${spotifyTracks.length}] ${trackName} - Using Spotify preview`);
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
				updateProgress('processing', index + 1, spotifyTracks.length, `[${index + 1}/${spotifyTracks.length}] ${trackName} - Searching YouTube...`);
				
				// Add timeout to YouTube search (5 seconds)
				const youtubePromise = YouTube.searchOne(searchQuery);
				const timeoutPromise = new Promise((_, reject) => 
					setTimeout(() => reject(new Error('YouTube search timeout')), 5000)
				);
				
				const youtubeResult = await Promise.race([youtubePromise, timeoutPromise]) as unknown;
				console.log(`[processTrack] YouTube search result for track ${index + 1}:`, youtubeResult);
				
				if (youtubeResult && typeof youtubeResult === 'object' && 'url' in youtubeResult) {
					const url = (youtubeResult as { url?: string }).url;
					if (url) {
						console.log(`[processTrack] Found YouTube URL for track ${index + 1}: ${url}`);
						audioUrl = url;
						status = 'found';
						updateProgress('processing', index + 1, spotifyTracks.length, `[${index + 1}/${spotifyTracks.length}] ${trackName} - Found YouTube video`);
					} else {
						console.log(`[processTrack] Track ${index + 1} YouTube result has no URL`);
						updateProgress('processing', index + 1, spotifyTracks.length, `[${index + 1}/${spotifyTracks.length}] ${trackName} - No YouTube video found`);
					}
				} else {
					console.log(`[processTrack] Track ${index + 1} YouTube search returned invalid result`);
					updateProgress('processing', index + 1, spotifyTracks.length, `[${index + 1}/${spotifyTracks.length}] ${trackName} - No YouTube video found`);
				}
			} catch (error) {
				// YouTube search failed or timed out, mark as missing
				console.error(`[processTrack] YouTube search failed for track ${index + 1}:`, error);
				updateProgress('processing', index + 1, spotifyTracks.length, `[${index + 1}/${spotifyTracks.length}] ${trackName} - YouTube search failed: ${(error as Error).message}`);
			}
		}
		
		const trackResult = {
			name: trackName,
			artists,
			audioUrl,
			status,
			spotifyPreviewUrl,
			youtubeUrl: audioUrl && !spotifyPreviewUrl ? audioUrl : undefined
		};
		console.log(`[processTrack] Completed track ${index + 1}, status: ${status}, audioUrl: ${audioUrl || 'none'}`);
		return trackResult;
	};
	
	// Process tracks in parallel batches to speed things up
	const batchSize = 5;
	console.log(`[processPlaylist] Processing ${spotifyTracks.length} tracks in batches of ${batchSize}`);
	for (let i = 0; i < spotifyTracks.length; i += batchSize) {
		const batch = spotifyTracks.slice(i, i + batchSize);
		console.log(`[processPlaylist] Processing batch starting at index ${i}, batch size: ${batch.length}`);
		const batchResults = await Promise.all(
			batch.map((track, batchIndex) => processTrack(track, i + batchIndex))
		);
		tracks.push(...batchResults);
		const processed = Math.min(i + batchSize, spotifyTracks.length);
		console.log(`[processPlaylist] Completed batch, total processed: ${processed}/${spotifyTracks.length}`);
		updateProgress('processing', processed, spotifyTracks.length, `Processed ${processed}/${spotifyTracks.length} tracks`);
	}
	
	const foundCount = tracks.filter(t => t.status === 'found').length;
	console.log(`[processPlaylist] Finished processing. Found ${foundCount} tracks with audio out of ${tracks.length} total`);
	updateProgress('completed', spotifyTracks.length, spotifyTracks.length, `Finished processing playlist. Found ${foundCount} tracks with audio`);
	
	// Clean up progress after a delay
	setTimeout(() => {
		console.log(`[processPlaylist] Cleaning up progress store for URL: ${playlistUrl}`);
		progressStore.delete(playlistUrl);
		if (currentProcessingUrl === playlistUrl) {
			currentProcessingUrl = null;
		}
	}, 60000);
	
	console.log(`[processPlaylist] Returning ${tracks.length} tracks`);
	return tracks;
}

