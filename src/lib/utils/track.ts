import type { Track } from '$lib/types';

/**
 * Check if a track has audio available (for playlist page - before release dates are fetched)
 */
export function hasAudioSource(track: Track): boolean {
	return track.status === 'found' && !!track.audioUrl;
}

/**
 * Check if a track is fully playable in the game (has audio AND release date)
 */
export function isTrackPlayable(track: Track): boolean {
	return track.status === 'found' && !!track.audioUrl && !!track.firstReleaseDate;
}

/**
 * Check if a track needs a release date lookup (has audio but missing release date)
 */
export function needsReleaseDate(track: Track): boolean {
	return track.status === 'found' && !!track.audioUrl && !track.firstReleaseDate && track.artists.length > 0;
}
