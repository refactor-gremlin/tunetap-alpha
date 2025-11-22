import { command, query } from '$app/server';
import { z } from 'zod';
import { processPlaylist, getProgress, recordProgressError } from '$lib/server/playlist.server';

export const getPlaylistProgress = query(
	z.object({
		playlistUrl: z.string().url('Please provide the playlist URL being processed'),
		jobId: z.string().min(1, 'Missing job identifier')
	}),
	async ({ playlistUrl, jobId }) => {
		console.log('[getPlaylistProgress] Query called for URL:', playlistUrl, 'job:', jobId);
		const progress = getProgress(playlistUrl, jobId);
		console.log('[getPlaylistProgress] Returning progress:', progress);
		return progress;
	}
);

export const submitPlaylist = command(
	z.object({
		playlistUrl: z.string().url('Please enter a valid Spotify playlist URL'),
		jobId: z.string().min(1, 'Missing job identifier')
	}),
	async ({ playlistUrl, jobId }) => {
		console.log('[submitPlaylist] Command called with URL:', playlistUrl, 'job:', jobId);
		try {
			const { tracks } = await processPlaylist(playlistUrl, jobId);
			console.log(
				`[submitPlaylist] Successfully processed playlist, returning ${tracks.length} tracks`
			);
			return { tracks, success: true, jobId };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to process playlist';
			console.error('[submitPlaylist] Error processing playlist:', error);
			recordProgressError(playlistUrl, jobId, message);
			return { tracks: [], success: false, jobId, error: message };
		}
	}
);
