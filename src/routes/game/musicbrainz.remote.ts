import { query } from '$app/server';
import { z } from 'zod';
import { musicBrainzQueue } from '$lib/server/musicbrainz-queue';
import { getCachedReleaseDatesBatch } from '$lib/server/db';

export const fetchFirstReleaseDate = query(
	z.object({
		trackName: z.string(),
		artistName: z.string(),
		priority: z.enum(['high', 'low']).optional().default('high')
	}),
	async ({ trackName, artistName, priority }) => {
		console.log(`[MusicBrainz Remote] Queueing request for: "${trackName}" by "${artistName}" (Priority: ${priority})`);
		try {
			// Use specified priority (default high) for interactive user requests
			const result = await musicBrainzQueue.enqueue(trackName, artistName, priority);
			return result;
		} catch (error) {
			console.error(`[MusicBrainz Remote] Error:`, error);
			return undefined;
		}
	}
);

export const ensureQueueBatch = query(
	z.object({
		tracks: z.array(
			z.object({
				trackName: z.string(),
				artistName: z.string()
			})
		)
	}),
	async ({ tracks }) => {
		console.log(`[MusicBrainz Remote] Ensuring ${tracks.length} tracks are queued (Low Priority)`);
		tracks.forEach(({ trackName, artistName }) => {
			musicBrainzQueue.enqueue(trackName, artistName, 'low').catch((err) => {
				console.error(`[Background Queue] Failed to enqueue "${trackName}":`, err);
			});
		});
		return { success: true };
	}
);

export const getQueueSize = query(async () => {
	return musicBrainzQueue.getPendingCount();
});

export const getQueueStatus = query(async () => {
	const pendingCount = musicBrainzQueue.getPendingCount();
	// Estimate time remaining (1 second per track)
	const estimatedSeconds = pendingCount;
	return {
		pendingCount,
		estimatedTimeRemaining: estimatedSeconds,
		// Format time as readable string
		timeRemainingString: estimatedSeconds > 60 
			? `${Math.floor(estimatedSeconds / 60)}m ${estimatedSeconds % 60}s`
			: `${estimatedSeconds}s`
	};
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
