export function buildTrackArtistKey(trackName: string, artistName: string): string {
	return JSON.stringify([trackName ?? '', artistName ?? '']);
}

export function parseTrackArtistKey(
	key: string
): { trackName: string; artistName: string } | null {
	try {
		const parsed = JSON.parse(key);
		if (
			Array.isArray(parsed) &&
			parsed.length === 2 &&
			typeof parsed[0] === 'string' &&
			typeof parsed[1] === 'string'
		) {
			return { trackName: parsed[0], artistName: parsed[1] };
		}
	} catch {
		// ignore parsing errors
	}
	return null;
}
