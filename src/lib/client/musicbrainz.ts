// Rate limiter for MusicBrainz API (1 request per second)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second in milliseconds

/**
 * Wait until enough time has passed since the last request
 */
async function waitForRateLimit(): Promise<void> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;
	
	if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
		const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
		console.log(`[MusicBrainz] Rate limiting: waiting ${waitTime}ms before next request`);
		await new Promise(resolve => setTimeout(resolve, waitTime));
	}
	
	lastRequestTime = Date.now();
}

interface MusicBrainzReleaseGroup {
	id: string;
	title: string;
	'first-release-date'?: string;
}

interface MusicBrainzResponse {
	'release-groups'?: MusicBrainzReleaseGroup[];
}

/**
 * Fetch the first release date for a track from MusicBrainz API
 * @param trackName - The name of the track
 * @param artistName - The name of the artist (first artist if multiple)
 * @returns The first release date in YYYY-MM-DD format, or undefined if not found
 */
export async function fetchFirstReleaseDate(
	trackName: string,
	artistName: string
): Promise<string | undefined> {
	// Wait for rate limit before making request
	await waitForRateLimit();
	
	// Escape quotes in track and artist names for the query
	const escapedTrackName = trackName.replace(/"/g, '\\"');
	const escapedArtistName = artistName.replace(/"/g, '\\"');
	
	// Build the query string
	const query = `release:"${escapedTrackName}" AND artist:"${escapedArtistName}"`;
	const url = `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&limit=1&fmt=json`;
	
	console.log(`[MusicBrainz] Fetching release date for: "${trackName}" by "${artistName}"`);
	console.log(`[MusicBrainz] Query URL: ${url}`);
	
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'TuneTap/1.0.0 (https://github.com/yourusername/tunetap-alpha)', // Required by MusicBrainz
				'Accept': 'application/json'
			}
		});
		
		if (!response.ok) {
			console.error(`[MusicBrainz] API error: ${response.status} ${response.statusText}`);
			return undefined;
		}
		
		const data = await response.json() as MusicBrainzResponse;
		
		if (!data['release-groups'] || data['release-groups'].length === 0) {
			console.log(`[MusicBrainz] No release groups found for "${trackName}" by "${artistName}"`);
			return undefined;
		}
		
		const releaseGroup = data['release-groups'][0];
		const firstReleaseDate = releaseGroup['first-release-date'];
		
		if (firstReleaseDate) {
			console.log(`[MusicBrainz] Found release date for "${trackName}": ${firstReleaseDate}`);
			return firstReleaseDate;
		} else {
			console.log(`[MusicBrainz] Release group found but no first-release-date for "${trackName}"`);
			return undefined;
		}
	} catch (error) {
		console.error(`[MusicBrainz] Error fetching release date for "${trackName}":`, error);
		return undefined;
	}
}

