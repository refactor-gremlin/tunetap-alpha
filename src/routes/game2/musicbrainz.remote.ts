import { query } from '$app/server';
import { z } from 'zod';
import { musicBrainzQueue } from '$lib/server/musicbrainz-queue';
import { getCachedReleaseDatesBatch } from '$lib/server/db';

export const fetchFirstReleaseDate = query(
	z.object({
		trackName: z.string(),
		artistName: z.string()
	}),
	async ({ trackName, artistName }) => {
		console.log(`[MusicBrainz Remote] Queueing request for: "${trackName}" by "${artistName}"`);
		try {
			const result = await musicBrainzQueue.enqueue(trackName, artistName);
			return result;
		} catch (error) {
			console.error(`[MusicBrainz Remote] Error:`, error);
			return undefined;
		}
	}
);

export const getQueueSize = query(async () => {
	return musicBrainzQueue.getPendingCount();
});

export const getCachedReleaseDatesBatchQuery = query(
	z.object({
		tracks: z.array(
			z.object({
				trackName: z.string(),
				artistName: z.string()
			})
		)
	}),
	async ({ tracks }) => {
		console.log(`[MusicBrainz Remote] Batch checking ${tracks.length} tracks in database cache`);
		try {
			const cacheMap = await getCachedReleaseDatesBatch(tracks);
			// Convert Map to plain object for serialization
			const result: Record<string, string | null> = {};
			for (const [key, value] of cacheMap.entries()) {
				result[key] = value;
			}
			return result;
		} catch (error) {
			console.error(`[MusicBrainz Remote] Error in batch cache check:`, error);
			return {};
		}
	}
);

