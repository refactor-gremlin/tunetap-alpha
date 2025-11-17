import { getCachedReleaseDate, cacheReleaseDate } from './db';

interface QueueItem {
	trackName: string;
	artistName: string;
	resolve: (value: string | undefined) => void;
	reject: (error: Error) => void;
}

class MusicBrainzQueue {
	private queue: QueueItem[] = [];
	private isProcessing = false;
	private lastRequestTime = 0;
	private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second

	async enqueue(trackName: string, artistName: string): Promise<string | undefined> {
		// First check cache
		const cached = await getCachedReleaseDate(trackName, artistName);
		if (cached !== null) {
			// Return cached value (null means "not found" was cached)
			return cached || undefined;
		}

		// Not in cache, add to queue
		return new Promise((resolve, reject) => {
			this.queue.push({ trackName, artistName, resolve, reject });
			this.processQueue();
		});
	}

	private async processQueue() {
		if (this.isProcessing || this.queue.length === 0) {
			return;
		}

		this.isProcessing = true;

		while (this.queue.length > 0) {
			const item = this.queue.shift()!;

			try {
				// Wait for rate limit
				const now = Date.now();
				const timeSinceLastRequest = now - this.lastRequestTime;
				if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
					const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
					console.log(`[MusicBrainz Queue] Rate limiting: waiting ${waitTime}ms`);
					await new Promise(resolve => setTimeout(resolve, waitTime));
				}

				// Fetch from MusicBrainz
				const result = await this.fetchFromMusicBrainz(item.trackName, item.artistName);
				this.lastRequestTime = Date.now();
				
				// Cache the result (even if null/undefined)
				await cacheReleaseDate(item.trackName, item.artistName, result || null);
				
				item.resolve(result);
			} catch (error) {
				console.error(`[MusicBrainz Queue] Error processing "${item.trackName}":`, error);
				item.reject(error instanceof Error ? error : new Error(String(error)));
			}
		}

		this.isProcessing = false;
	}

	private async fetchFromMusicBrainz(
		trackName: string,
		artistName: string
	): Promise<string | undefined> {
		// Escape quotes in track and artist names for the query
		const escapedTrackName = trackName.replace(/"/g, '\\"');
		const escapedArtistName = artistName.replace(/"/g, '\\"');

		// Build the query string
		const query = `release:"${escapedTrackName}" AND artist:"${escapedArtistName}"`;
		const url = `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&limit=1&fmt=json`;

		console.log(`[MusicBrainz Queue] Fetching: "${trackName}" by "${artistName}"`);
		console.log(`[MusicBrainz Queue] Queue size: ${this.queue.length}`);

		try {
			const response = await fetch(url, {
				headers: {
					'User-Agent': 'TuneTap/1.0.0 (https://github.com/yourusername/tunetap-alpha)',
					'Accept': 'application/json'
				}
			});

			if (!response.ok) {
				console.error(`[MusicBrainz Queue] API error: ${response.status} ${response.statusText}`);
				return undefined;
			}

			const data = await response.json() as {
				'release-groups'?: Array<{ 'first-release-date'?: string }>;
			};

			if (!data['release-groups'] || data['release-groups'].length === 0) {
				console.log(`[MusicBrainz Queue] No release groups found for "${trackName}"`);
				return undefined;
			}

			const releaseGroup = data['release-groups'][0];
			const firstReleaseDate = releaseGroup['first-release-date'];

			if (firstReleaseDate) {
				console.log(`[MusicBrainz Queue] Found date for "${trackName}": ${firstReleaseDate}`);
				return firstReleaseDate;
			} else {
				console.log(`[MusicBrainz Queue] No release date for "${trackName}"`);
				return undefined;
			}
		} catch (error) {
			console.error(`[MusicBrainz Queue] Error fetching "${trackName}":`, error);
			throw error;
		}
	}
}

// Singleton instance - shared across all requests
export const musicBrainzQueue = new MusicBrainzQueue();

