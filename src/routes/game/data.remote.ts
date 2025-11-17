import { query } from '$app/server';
import type { Track } from '$lib/types';

export const getGameTracks = query(async (): Promise<Track[]> => {
	console.log('[getGameTracks] Query called');
	// This query can be used if we need to fetch tracks from server
	// For now, tracks come from navigation state
	console.log('[getGameTracks] Returning empty array (tracks come from navigation state)');
	return [];
});

