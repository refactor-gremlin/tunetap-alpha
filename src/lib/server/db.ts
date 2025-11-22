import { createRequire } from 'node:module';

// Using createRequire keeps Prisma's CommonJS client in a native CJS context so
// it isn't bundled into SvelteKit's ESM output (which breaks __dirname usage).
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const DEFAULT_DATABASE_URL = 'file:./prisma/dev.db';
const globalRuntime = globalThis as typeof globalThis & {
	__tunetapDbWarningLogged?: boolean;
};

if (!process.env.DATABASE_URL) {
	if (!globalRuntime.__tunetapDbWarningLogged) {
		console.warn(
			`[DB] DATABASE_URL not set. Falling back to local SQLite at ${DEFAULT_DATABASE_URL}`
		);
		globalRuntime.__tunetapDbWarningLogged = true;
	}
	process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}

// Singleton Prisma client instance
const prisma = new PrismaClient();

/**
 * Get cached release date from database
 * @param trackName - The name of the track
 * @param artistName - The name of the artist
 * @returns The cached release date (YYYY-MM-DD) or null if not found in cache
 */
export async function getCachedReleaseDate(
	trackName: string,
	artistName: string
): Promise<string | null> {
	try {
		const cached = await prisma.releaseDateCache.findUnique({
			where: {
				trackName_artistName: {
					trackName,
					artistName
				}
			},
			select: {
				releaseDate: true
			}
		});

		if (cached) {
			console.log(
				`[DB Cache] Found cached release date for "${trackName}" by "${artistName}": ${cached.releaseDate || 'not found'}`
			);
			return cached.releaseDate;
		}

		return null;
	} catch (error) {
		console.error(`[DB Cache] Error getting cached release date:`, error);
		return null;
	}
}

/**
 * Get cached release dates for multiple tracks in a single batch query
 * @param tracks - Array of track objects with trackName and artistName
 * @returns Map keyed by `${trackName}|${artistName}` with release dates (or null if not found)
 */
export async function getCachedReleaseDatesBatch(
	tracks: Array<{ trackName: string; artistName: string }>
): Promise<Map<string, string | null>> {
	const result = new Map<string, string | null>();

	if (tracks.length === 0) {
		return result;
	}

	try {
		// Build OR conditions for findMany
		const whereConditions = tracks.map(({ trackName, artistName }) => ({
			trackName,
			artistName
		}));

		const cached = await prisma.releaseDateCache.findMany({
			where: {
				OR: whereConditions
			},
			select: {
				trackName: true,
				artistName: true,
				releaseDate: true
			}
		});

		// Create a map of found cache entries
		const foundMap = new Map<string, string | null>();
		for (const entry of cached) {
			const key = `${entry.trackName}|${entry.artistName}`;
			foundMap.set(key, entry.releaseDate);
		}

		// Populate result map - only include tracks actually found in cache
		for (const { trackName, artistName } of tracks) {
			const key = `${trackName}|${artistName}`;
			if (foundMap.has(key)) {
				result.set(key, foundMap.get(key) ?? null);
			}
		}

		console.log(
			`[DB Cache] Batch check: Found ${cached.length} cached dates out of ${tracks.length} tracks`
		);
		return result;
	} catch (error) {
		console.error(`[DB Cache] Error getting cached release dates batch:`, error);
		// Return empty map on error - tracks will be fetched normally
		return result;
	}
}

/**
 * Cache a release date in the database
 * @param trackName - The name of the track
 * @param artistName - The name of the artist
 * @param releaseDate - The release date (YYYY-MM-DD) or null if not found
 */
export async function cacheReleaseDate(
	trackName: string,
	artistName: string,
	releaseDate: string | null
): Promise<void> {
	try {
		await prisma.releaseDateCache.upsert({
			where: {
				trackName_artistName: {
					trackName,
					artistName
				}
			},
			update: {
				releaseDate,
				updatedAt: new Date()
			},
			create: {
				trackName,
				artistName,
				releaseDate
			}
		});

		console.log(
			`[DB Cache] Cached release date for "${trackName}" by "${artistName}": ${releaseDate || 'not found'}`
		);
	} catch (error) {
		console.error(`[DB Cache] Error caching release date:`, error);
		// Don't throw - caching failures shouldn't break the flow
	}
}

/**
 * Get cached playlist from database
 * @param url - The Spotify playlist URL
 * @returns The cached tracks JSON string or null if not found
 */
export async function getCachedPlaylist(url: string): Promise<string | null> {
	try {
		const cached = await prisma.spotifyPlaylistCache.findUnique({
			where: { id: url },
			select: { tracksJson: true }
		});

		if (cached) {
			console.log(`[DB Cache] Found cached playlist for "${url}"`);
			return cached.tracksJson;
		}
		return null;
	} catch (error) {
		console.error(`[DB Cache] Error getting cached playlist:`, error);
		return null;
	}
}

/**
 * Cache a playlist in the database
 * @param url - The Spotify playlist URL
 * @param tracksJson - The JSON string of tracks
 */
export async function cachePlaylist(url: string, tracksJson: string): Promise<void> {
	try {
		await prisma.spotifyPlaylistCache.upsert({
			where: { id: url },
			update: {
				tracksJson,
				updatedAt: new Date()
			},
			create: {
				id: url,
				tracksJson
			}
		});
		console.log(`[DB Cache] Cached playlist for "${url}"`);
	} catch (error) {
		console.error(`[DB Cache] Error caching playlist:`, error);
	}
}

/**
 * Get cached audio source from database
 * @param trackName - The name of the track
 * @param artistName - The name of the artist
 * @returns The cached audio source data or null if not found
 */
export async function getCachedAudioSource(
	trackName: string,
	artistName: string
): Promise<{
	audioUrl: string | null;
	spotifyPreviewUrl: string | null;
	youtubeUrl: string | null;
	coverImage: string | null;
	status: string;
} | null> {
	try {
		const cached = await prisma.audioSourceCache.findUnique({
			where: {
				trackName_artistName: {
					trackName,
					artistName
				}
			}
		});

		if (cached) {
			console.log(
				`[DB Cache] Found cached audio source for "${trackName}" by "${artistName}": ${cached.status}`
			);
			return {
				audioUrl: cached.audioUrl,
				spotifyPreviewUrl: cached.spotifyPreviewUrl,
				youtubeUrl: cached.youtubeUrl,
				coverImage: cached.coverImage,
				status: cached.status
			};
		}
		return null;
	} catch (error) {
		console.error(`[DB Cache] Error getting cached audio source:`, error);
		return null;
	}
}

/**
 * Cache audio source in the database
 * @param data - The audio source data
 */
export async function cacheAudioSource(data: {
	trackName: string;
	artistName: string;
	audioUrl: string | null;
	spotifyPreviewUrl: string | null;
	youtubeUrl: string | null;
	coverImage: string | null;
	status: string;
}): Promise<void> {
	try {
		await prisma.audioSourceCache.upsert({
			where: {
				trackName_artistName: {
					trackName: data.trackName,
					artistName: data.artistName
				}
			},
			update: {
				audioUrl: data.audioUrl,
				spotifyPreviewUrl: data.spotifyPreviewUrl,
				youtubeUrl: data.youtubeUrl,
				coverImage: data.coverImage,
				status: data.status,
				updatedAt: new Date()
			},
			create: {
				trackName: data.trackName,
				artistName: data.artistName,
				audioUrl: data.audioUrl,
				spotifyPreviewUrl: data.spotifyPreviewUrl,
				youtubeUrl: data.youtubeUrl,
				coverImage: data.coverImage,
				status: data.status
			}
		});
		console.log(
			`[DB Cache] Cached audio source for "${data.trackName}" by "${data.artistName}": ${data.status}`
		);
	} catch (error) {
		console.error(`[DB Cache] Error caching audio source:`, error);
	}
}
