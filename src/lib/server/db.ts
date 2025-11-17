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
			console.log(`[DB Cache] Found cached release date for "${trackName}" by "${artistName}": ${cached.releaseDate || 'not found'}`);
			return cached.releaseDate;
		}

		return null;
	} catch (error) {
		console.error(`[DB Cache] Error getting cached release date:`, error);
		return null;
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

		console.log(`[DB Cache] Cached release date for "${trackName}" by "${artistName}": ${releaseDate || 'not found'}`);
	} catch (error) {
		console.error(`[DB Cache] Error caching release date:`, error);
		// Don't throw - caching failures shouldn't break the flow
	}
}

