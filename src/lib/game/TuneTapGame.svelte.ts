import type { Track } from '$lib/types';
import type { Player, PlacementResult, GameStatus, PlacementType } from '$lib/types/tunetap.js';
import { getReleaseYear } from '$lib/utils/timeline.js';

export class TuneTapGame {
	// State
	players = $state<Player[]>([]);
	currentPlayerIndex = $state(0);
	currentTrack = $state<Track | null>(null);
	availableTracks = $state<Track[]>([]);
	gameStatus = $state<GameStatus>('setup');
	roundResult = $state<PlacementResult | null>(null);
	turnsTaken = $state(0);
	initialTurnCount = $state(0);
	turnNumber = $derived(
		this.initialTurnCount === 0
			? 0
			: Math.min(this.turnsTaken + 1, this.initialTurnCount)
	);
	totalTurns = $derived(this.initialTurnCount);

	// Derived
	currentPlayer = $derived(
		this.players.length > 0 &&
			this.currentPlayerIndex >= 0 &&
			this.currentPlayerIndex < this.players.length
			? this.players[this.currentPlayerIndex]
			: undefined
	);

	winner = $derived(this.players.find((p) => p.score >= 10));

	tracksPlaced = $derived(this.players.reduce((sum, p) => sum + p.timeline.length, 0));

	tracksRemaining = $derived(this.availableTracks.length);

	constructor() {
		// Initialization will be done via initializeGame()
	}

	// Initialize game
	initializeGame(playableTracks: Track[], playerNames: string[]) {
		const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
		this.availableTracks = shuffled;

		this.players = playerNames.map((name) => ({
			name,
			score: 0,
			timeline: []
		}));

		// Automatically place first track for all players
		for (let i = 0; i < this.players.length; i++) {
			if (this.availableTracks.length === 0) break;

			const track = this.availableTracks[0];
			this.placeTrackForPlayer(i, track, 'before', null);
			this.availableTracks = this.availableTracks.slice(1);
		}

		this.initialTurnCount = this.availableTracks.length;
		this.turnsTaken = 0;
		this.currentPlayerIndex = 0;

		if (this.availableTracks.length === 0) {
			this.setWaitingForTracks();
		} else {
			this.gameStatus = 'playing';
			this.selectRandomTrack();
		}
	}

	// Select random track for current turn
	selectRandomTrack() {
		if (this.availableTracks.length === 0) {
			this.setWaitingForTracks();
			return;
		}

		const randomIndex = Math.floor(Math.random() * this.availableTracks.length);
		this.currentTrack = this.availableTracks[randomIndex];
		this.roundResult = null;
	}

	// Validate placement - simplified version
	validatePlacement(
		playerIndex: number,
		track: Track,
		placementType: PlacementType,
		referenceIndex: number | null,
		year?: number
	): PlacementResult {
		const player = this.players[playerIndex];
		const trackYear = getReleaseYear(track);
		const trackDate = track.firstReleaseDate;

		if (!trackDate) {
			return { correct: false, correctPosition: -1 };
		}

		// 1. Calculate the correct chronological index for the track using full date string comparison.
		const correctIndex = player.timeline.findIndex((t) => {
			const tDate = t.firstReleaseDate || '0';
			return tDate > trackDate;
		});
		const actualCorrectIndex = correctIndex === -1 ? player.timeline.length : correctIndex;

		// 2. Determine the user's target index based on their action.
		let userTargetIndex: number;
		if (placementType === 'before') {
			userTargetIndex = referenceIndex ?? 0;
		} else if (placementType === 'after') {
			userTargetIndex = referenceIndex !== null ? referenceIndex + 1 : player.timeline.length;
		} else if (placementType === 'same' && year !== undefined) {
			// Find the first song with a year greater than the target year.
			const firstNewerSongIndex = player.timeline.findIndex(
				(t) => (getReleaseYear(t) ?? 0) > year
			);
			userTargetIndex =
				firstNewerSongIndex === -1 ? player.timeline.length : firstNewerSongIndex;
		} else {
			// Fallback for initial placement or other cases
			userTargetIndex = player.timeline.length;
		}

		// New rule: if placing 'before' or 'after' a track of the same year, it's incorrect.
		if (placementType === 'before' || placementType === 'after') {
			const prevTrack = player.timeline[userTargetIndex - 1];
			const nextTrack = player.timeline[userTargetIndex];

			if (prevTrack && getReleaseYear(prevTrack) === trackYear) {
				return { correct: false, correctPosition: actualCorrectIndex };
			}
			if (nextTrack && getReleaseYear(nextTrack) === trackYear) {
				return { correct: false, correctPosition: actualCorrectIndex };
			}
		}

		// 3. Check if the placement is correct.
		// The move is correct if the user's target index matches the actual correct index.
		// For 'same' year placements, the check is slightly different: the new track's year
		// must match the reference track's year.
		let isCorrect: boolean;
		if (placementType === 'same') {
			if (referenceIndex !== null) {
				const referenceTrack = player.timeline[referenceIndex];
				const referenceYear = getReleaseYear(referenceTrack);
				isCorrect = referenceYear === trackYear;
			} else {
				isCorrect = false;
			}
		} else {
			isCorrect = userTargetIndex === actualCorrectIndex;
		}

		// 4. Final verification: ensure the new timeline is still in chronological order.
		// This is a safeguard.
		const newTimeline = [...player.timeline];
		// For 'same' year placements, the user isn't picking an index, so we check
		// against the actual correct chronological position for the safeguard.
		const insertionIndex = placementType === 'same' ? actualCorrectIndex : userTargetIndex;
		newTimeline.splice(insertionIndex, 0, track);
		let isChronological = true;
		for (let i = 0; i < newTimeline.length - 1; i++) {
			const date1 = newTimeline[i].firstReleaseDate;
			const date2 = newTimeline[i + 1].firstReleaseDate;
			if (date1 && date2 && date1 > date2) {
				isChronological = false;
				break;
			}
		}

		// The placement is only truly correct if it maintains chronological order.
		return { correct: isCorrect && isChronological, correctPosition: actualCorrectIndex };
	}

	// Helper function to place a track for a specific player (for auto-placement)
	placeTrackForPlayer(
		playerIndex: number,
		track: Track,
		placementType: PlacementType = 'before',
		referenceIndex: number | null = null,
		year?: number
	): PlacementResult {
		const player = this.players[playerIndex];
		const result = this.validatePlacement(playerIndex, track, placementType, referenceIndex, year);

		const insertIndex =
			result.correctPosition >= 0 ? result.correctPosition : player.timeline.length;
		player.timeline.splice(insertIndex, 0, track);

		if (result.correct) {
			player.score += 1;
		}

		return result;
	}

	// Place track from gap selection
	placeTrackFromGap(gapIndex: number): PlacementResult | null {
		if (!this.currentTrack || !this.currentPlayer) return null;
		const player = this.currentPlayer;

		// Determine the placement relative to the timeline.
		// A gap selection always implies placing 'before' the item at that index.
		const placementType: PlacementType = 'before';
		const referenceIndex = gapIndex === 0 ? null : gapIndex;

		const result = this.validatePlacement(
			this.currentPlayerIndex,
			this.currentTrack,
			placementType,
			referenceIndex
		);

		this.handlePlacementResult(result);
		return result;
	}

	// Place track in same year as card selection
	placeTrackSameYear(cardIndex: number): PlacementResult | null {
		if (!this.currentTrack || !this.currentPlayer) return null;

		const referenceTrack = this.currentPlayer.timeline[cardIndex];
		const referenceYear = getReleaseYear(referenceTrack);
		if (referenceYear === null) return null;

		const result = this.validatePlacement(
			this.currentPlayerIndex,
			this.currentTrack,
			'same',
			cardIndex,
			referenceYear
		);

		this.handlePlacementResult(result);
		return result;
	}

	private handlePlacementResult(result: PlacementResult) {
		if (!this.currentTrack || !this.currentPlayer) return;

		const player = this.currentPlayer;
		if (result.correct) {
			player.score += 1;
			player.timeline.splice(result.correctPosition, 0, this.currentTrack);
		}

		const trackIndexToRemove = this.availableTracks.findIndex(
			(t) => t.id === this.currentTrack!.id
		);
		if (trackIndexToRemove > -1) {
			this.availableTracks.splice(trackIndexToRemove, 1);
		}
		this.roundResult = result;
		this.gameStatus = 'roundEnd';

		if (player.score >= 10) {
			setTimeout(() => this.endGame(), 2000);
		}
	}

	nextTurn() {
		if (this.gameStatus !== 'roundEnd') {
			return;
		}

		this.turnsTaken = Math.min(this.turnsTaken + 1, this.initialTurnCount);
		this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

		if (this.availableTracks.length === 0) {
			this.setWaitingForTracks();
			return;
		}

		this.selectRandomTrack();
		this.gameStatus = 'playing';
	}

	endGame() {
		this.gameStatus = 'gameEnd';
	}

	addPlayableTracks(tracks: Track[]) {
		const eligibleTracks = tracks.filter(
			(track) => this.isTrackPlayable(track) && !this.isTrackAlreadyUsed(track.id)
		);
		if (eligibleTracks.length === 0) {
			return;
		}

		this.availableTracks = [...this.availableTracks, ...eligibleTracks];
		this.initialTurnCount += eligibleTracks.length;

		if (this.gameStatus === 'waiting') {
			this.gameStatus = 'playing';
			this.selectRandomTrack();
		} else if (!this.currentTrack) {
			this.selectRandomTrack();
		}
	}

	// Build timeline items (cards and gaps), grouping tracks by year
	buildTimelineItems(currentPlayer: Player | undefined): Array<{
		type: 'card' | 'gap';
		track?: Track;
		index?: number;
		gapIndex?: number;
		sameYearCount?: number;
		sameYearTracks?: Track[];
	}> {
		if (!currentPlayer || !this.players.length) {
			// Return at least one gap if no player
			return [{ type: 'gap' as const, gapIndex: 0 }];
		}

		const items: Array<{
			type: 'card' | 'gap';
			track?: Track;
			index?: number;
			gapIndex?: number;
			sameYearCount?: number; // Number of other tracks in the same year
			sameYearTracks?: Track[];
		}> = [];

		// Add gap before first card
		items.push({ type: 'gap', gapIndex: 0 });

		// Group tracks by year and add cards/gaps
		if (currentPlayer.timeline && currentPlayer.timeline.length > 0) {
			// First pass: count tracks per year group
			// Using plain object for internal computation only, not reactive state
			const yearGroups: Record<number, { startIndex: number; count: number }> = {};
			let currentYear: number | null = null;
			let yearGroupStartIndex = 0;

			currentPlayer.timeline.forEach((track, index) => {
				const trackYear = getReleaseYear(track);

				if (trackYear !== currentYear) {
					// Save previous group if it had multiple tracks
					if (currentYear !== null && index > yearGroupStartIndex) {
						const count = index - yearGroupStartIndex;
						if (count > 1) {
							yearGroups[currentYear] = { startIndex: yearGroupStartIndex, count };
						}
					}

					// Start new year group
					currentYear = trackYear;
					yearGroupStartIndex = index;
				}
			});

			// Save last group if it had multiple tracks
			if (currentYear !== null && currentPlayer.timeline.length > yearGroupStartIndex) {
				const count = currentPlayer.timeline.length - yearGroupStartIndex;
				if (count > 1) {
					yearGroups[currentYear] = { startIndex: yearGroupStartIndex, count };
				}
			}

			// Second pass: build items with count badges
			currentPlayer.timeline.forEach((track, index) => {
				const trackYear = getReleaseYear(track);
				const yearGroup = trackYear !== null ? yearGroups[trackYear] : undefined;

				// Only show first track of each year group, with count badge
				const isFirstInGroup = yearGroup?.startIndex === index;

				if (isFirstInGroup || !yearGroup) {
					const sameYearTracks =
						yearGroup && yearGroup.count > 1
							? currentPlayer.timeline.slice(
									yearGroup.startIndex + 1,
									yearGroup.startIndex + yearGroup.count
								)
							: undefined;
					items.push({
						type: 'card',
						track,
						index,
						sameYearCount: yearGroup && yearGroup.count > 1 ? yearGroup.count - 1 : undefined,
						sameYearTracks
					});

					// Only add gap after cards that are actually shown
					// For same-year groups, calculate gapIndex based on the last track in the group
					if (yearGroup && yearGroup.count > 1) {
						// This is a same-year group - gap should be after the last track in the group
						const lastTrackInGroupIndex = yearGroup.startIndex + yearGroup.count - 1;
						items.push({ type: 'gap', gapIndex: lastTrackInGroupIndex + 1 });
					} else {
						// Single track - add gap after it
						items.push({ type: 'gap', gapIndex: index + 1 });
					}
				}
				// Skip adding gaps for hidden tracks in same-year groups
			});
		}

		// Always return at least one gap
		if (items.length === 0) {
			items.push({ type: 'gap', gapIndex: 0 });
		}

		return items;
	}

	private isTrackPlayable(track: Track) {
		return Boolean(track.firstReleaseDate && track.audioUrl && track.status === 'found');
	}

	private isTrackAlreadyUsed(trackId: string) {
		if (this.currentTrack?.id === trackId) {
			return true;
		}
		if (this.availableTracks.some((track) => track.id === trackId)) {
			return true;
		}
		return this.players.some((player) => player.timeline.some((track) => track.id === trackId));
	}

	private setWaitingForTracks() {
		this.gameStatus = 'waiting';
		this.currentTrack = null;
		this.roundResult = null;
	}
}
