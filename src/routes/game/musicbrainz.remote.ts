import { query } from '$app/server';
import { z } from 'zod';
import { musicBrainzQueue } from '$lib/server/musicbrainz-queue';

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

