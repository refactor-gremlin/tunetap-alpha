import { command, query } from '$app/server';
import { z } from 'zod';
import { processPlaylist, getProgress } from '$lib/server/playlist.server';

export const getPlaylistProgress = query(
	z.object({
		playlistUrl: z.string().url('Please provide the playlist URL being processed')
	}),
	async ({ playlistUrl }) => {
		console.log('[getPlaylistProgress] Query called for URL:', playlistUrl);
		const progress = getProgress(playlistUrl);
		console.log('[getPlaylistProgress] Returning progress:', progress);
		return progress;
	}
);

export const submitPlaylist = command(
	z.object({
		playlistUrl: z.string().url('Please enter a valid Spotify playlist URL')
	}),
	async ({ playlistUrl }) => {
		console.log('[submitPlaylist] Command called with URL:', playlistUrl);
		try {
			const tracks = await processPlaylist(playlistUrl);
			console.log(
				`[submitPlaylist] Successfully processed playlist, returning ${tracks.length} tracks`
			);
			return { tracks, success: true };
		} catch (error) {
			console.error('[submitPlaylist] Error processing playlist:', error);
			return { tracks: [], success: false };
		}
	}
);
