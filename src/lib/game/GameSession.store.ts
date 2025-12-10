/**
 * GameSession Store
 *
 * Handles serialization and persistence of game state to sessionStorage.
 * This enables state to persist across route navigation and browser refresh.
 */

import type { Track } from '$lib/types';
import type { Player, GameStatus } from '$lib/types/tunetap';

const SESSION_KEY = 'tunetap_game_session';
const SESSION_TIMESTAMP_KEY = 'tunetap_game_session_timestamp';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Serializable subset of game state that can be stored in sessionStorage.
 * Does not include DOM refs, functions, or other non-serializable values.
 */
export interface GameSessionData {
	// Track data
	tracks: Track[];

	// Player configuration
	playerNames: string[];
	playerCount: number;

	// UI preferences
	showSongName: boolean;
	showArtistName: boolean;
	allowPartialStart: boolean;

	// Queue state
	queueSize: number;

	// Game engine state
	players: Player[];
	currentPlayerIndex: number;
	currentTrackId: string | null;
	availableTrackIds: string[];
	gameStatus: GameStatus;
	turnsTaken: number;
	initialTurnCount: number;

	// Round state
	showHandoff: boolean;
	blurred: boolean;
	showReleaseDates: boolean;
	exactYearBonusAwarded: number | null;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Save session data to sessionStorage with debouncing.
 * Debounce prevents excessive writes during rapid state changes.
 */
export function saveSession(data: GameSessionData, debounceMs = 100): void {
	if (typeof window === 'undefined') return;

	if (saveTimeout) {
		clearTimeout(saveTimeout);
	}

	saveTimeout = setTimeout(() => {
		try {
			sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
			sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
		} catch (error) {
			console.error('[GameSession] Failed to save session:', error);
		}
		saveTimeout = null;
	}, debounceMs);
}

/**
 * Save session data immediately without debouncing.
 * Use for critical state changes (e.g., before navigation).
 */
export function saveSessionImmediate(data: GameSessionData): void {
	if (typeof window === 'undefined') return;

	if (saveTimeout) {
		clearTimeout(saveTimeout);
		saveTimeout = null;
	}

	try {
		sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
		sessionStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
	} catch (error) {
		console.error('[GameSession] Failed to save session:', error);
	}
}

/**
 * Load session data from sessionStorage.
 * Returns null if no valid session exists or if session is expired.
 */
export function loadSession(): GameSessionData | null {
	if (typeof window === 'undefined') return null;

	try {
		const timestampStr = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);
		if (timestampStr) {
			const timestamp = parseInt(timestampStr, 10);
			if (Date.now() - timestamp > SESSION_MAX_AGE_MS) {
				// Session expired
				clearSession();
				return null;
			}
		}

		const data = sessionStorage.getItem(SESSION_KEY);
		if (!data) return null;

		const parsed = JSON.parse(data) as GameSessionData;

		// Validate essential fields
		if (!parsed.tracks || !Array.isArray(parsed.tracks)) {
			console.warn('[GameSession] Invalid session data: missing tracks');
			clearSession();
			return null;
		}

		return parsed;
	} catch (error) {
		console.error('[GameSession] Failed to load session:', error);
		clearSession();
		return null;
	}
}

/**
 * Clear all game session data from sessionStorage.
 */
export function clearSession(): void {
	if (typeof window === 'undefined') return;

	if (saveTimeout) {
		clearTimeout(saveTimeout);
		saveTimeout = null;
	}

	try {
		sessionStorage.removeItem(SESSION_KEY);
		sessionStorage.removeItem(SESSION_TIMESTAMP_KEY);

		// Also clear legacy keys from the old system
		sessionStorage.removeItem('tunetap_tracks');
		sessionStorage.removeItem('tunetap_playerCount');
		sessionStorage.removeItem('tunetap_showSongName');
		sessionStorage.removeItem('tunetap_showArtistName');
		sessionStorage.removeItem('tunetap_allowPartialStart');
	} catch (error) {
		console.error('[GameSession] Failed to clear session:', error);
	}
}

/**
 * Check if a valid game session exists.
 * Used by route guards to determine if game routes are accessible.
 */
export function hasValidSession(): boolean {
	if (typeof window === 'undefined') return false;

	try {
		// Check for expired session
		const timestampStr = sessionStorage.getItem(SESSION_TIMESTAMP_KEY);
		if (timestampStr) {
			const timestamp = parseInt(timestampStr, 10);
			if (Date.now() - timestamp > SESSION_MAX_AGE_MS) {
				return false;
			}
		}

		const data = sessionStorage.getItem(SESSION_KEY);
		if (!data) return false;

		const parsed = JSON.parse(data);
		return parsed.tracks && Array.isArray(parsed.tracks) && parsed.tracks.length > 0;
	} catch {
		return false;
	}
}

/**
 * Check if there's legacy session data from the old storage format.
 * Used during migration to the new session system.
 */
export function hasLegacySession(): boolean {
	if (typeof window === 'undefined') return false;

	try {
		const tracksData = sessionStorage.getItem('tunetap_tracks');
		if (!tracksData) return false;

		const tracks = JSON.parse(tracksData);
		return Array.isArray(tracks) && tracks.length > 0;
	} catch {
		return false;
	}
}

/**
 * Migrate legacy session data to the new format.
 * Returns partial session data that needs to be merged with defaults.
 */
export function migrateLegacySession(): Partial<GameSessionData> | null {
	if (typeof window === 'undefined') return null;

	try {
		const tracksData = sessionStorage.getItem('tunetap_tracks');
		if (!tracksData) return null;

		const tracks = JSON.parse(tracksData) as Track[];
		const playerCount = parseInt(sessionStorage.getItem('tunetap_playerCount') || '2', 10);
		const showSongName = sessionStorage.getItem('tunetap_showSongName') === 'true';
		const showArtistName = sessionStorage.getItem('tunetap_showArtistName') === 'true';
		const allowPartialStart = sessionStorage.getItem('tunetap_allowPartialStart') === 'true';

		// Clear legacy data after migration
		sessionStorage.removeItem('tunetap_tracks');
		sessionStorage.removeItem('tunetap_playerCount');
		sessionStorage.removeItem('tunetap_showSongName');
		sessionStorage.removeItem('tunetap_showArtistName');
		sessionStorage.removeItem('tunetap_allowPartialStart');

		return {
			tracks,
			playerCount,
			playerNames: Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`),
			showSongName,
			showArtistName,
			allowPartialStart
		};
	} catch (error) {
		console.error('[GameSession] Failed to migrate legacy session:', error);
		return null;
	}
}

/**
 * Create default session data for a new game.
 */
export function createDefaultSession(tracks: Track[], playerCount: number): GameSessionData {
	return {
		tracks,
		playerNames: Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`),
		playerCount,
		showSongName: false,
		showArtistName: false,
		allowPartialStart: false,
		queueSize: 0,
		players: [],
		currentPlayerIndex: 0,
		currentTrackId: null,
		availableTrackIds: [],
		gameStatus: 'setup',
		turnsTaken: 0,
		initialTurnCount: 0,
		showHandoff: false,
		blurred: true,
		showReleaseDates: false,
		exactYearBonusAwarded: null
	};
}

