import { PrismaClient } from '@prisma/client';

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

		// Populate result map - include all tracks, mark missing ones as null
		for (const { trackName, artistName } of tracks) {
			const key = `${trackName}|${artistName}`;
			result.set(key, foundMap.get(key) ?? null);
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
