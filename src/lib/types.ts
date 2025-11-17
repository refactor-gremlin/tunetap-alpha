export interface Track {
	name: string;
	artists: string[];
	audioUrl?: string; // YouTube URL or Spotify preview URL
	status: 'found' | 'missing';
	spotifyPreviewUrl?: string;
	youtubeUrl?: string;
	firstReleaseDate?: string; // First release date from MusicBrainz (YYYY-MM-DD format)
	coverImage?: string;
}
