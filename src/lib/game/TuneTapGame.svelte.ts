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
	turnNumber = $state(1);

	// Derived
	currentPlayer = $derived(
		this.players.length > 0 && this.currentPlayerIndex >= 0 && this.currentPlayerIndex < this.players.length
			? this.players[this.currentPlayerIndex]
			: undefined
	);

	winner = $derived(this.players.find((p) => p.score >= 10));

	totalTurns = $derived(
		Math.ceil(
			(this.availableTracks.length + this.players.reduce((sum, p) => sum + p.timeline.length, 0)) /
				this.players.length
		)
	);

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

		this.gameStatus = 'playing';
		this.currentPlayerIndex = 0;
		this.turnNumber = 1;
		this.selectRandomTrack();
	}

	// Select random track for current turn
	selectRandomTrack() {
		if (this.availableTracks.length === 0) {
			this.endGame();
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
		if (!trackYear) {
			return { correct: false, correctPosition: -1 };
		}

		// 1. Calculate the correct chronological index where this track SHOULD go
		const correctIndex = player.timeline.findIndex((t) => {
			const tYear = getReleaseYear(t) || 0;
			return tYear > trackYear; // Find first track newer than current
		});
		const actualCorrectIndex = correctIndex === -1 ? player.timeline.length : correctIndex;

		// 2. Determine where the user TRIED to put it
		let userTargetIndex = 0;
		const newTimeline = [...player.timeline];

		if (placementType === 'before') {
			if (referenceIndex !== null) {
				userTargetIndex = referenceIndex;
				// Check if placing before a track in the same year - this should be incorrect
				if (referenceIndex >= 0 && referenceIndex < newTimeline.length) {
					const referenceTrack = newTimeline[referenceIndex];
					const referenceYear = getReleaseYear(referenceTrack);
					if (referenceYear !== null && referenceYear === trackYear) {
						// Same year - mark as incorrect
						return { correct: false, correctPosition: userTargetIndex };
					}
				}
			} else {
				userTargetIndex = newTimeline.findIndex((t) => {
					const tYear = getReleaseYear(t);
					return tYear !== null && tYear >= trackYear;
				});
				if (userTargetIndex === -1) userTargetIndex = newTimeline.length;
			}
		} else if (placementType === 'after') {
			if (referenceIndex !== null) {
				userTargetIndex = referenceIndex + 1;
				// Check if placing after a track in the same year - this should be incorrect
				if (referenceIndex >= 0 && referenceIndex < newTimeline.length) {
					const referenceTrack = newTimeline[referenceIndex];
					const referenceYear = getReleaseYear(referenceTrack);
					if (referenceYear !== null && referenceYear === trackYear) {
						// Same year - mark as incorrect
						return { correct: false, correctPosition: userTargetIndex };
					}
				}
			} else {
				userTargetIndex = newTimeline.findIndex((t) => {
					const tYear = getReleaseYear(t);
					return tYear !== null && tYear > trackYear;
				});
				if (userTargetIndex === -1) userTargetIndex = newTimeline.length;
			}
		} else if (placementType === 'same' && year !== undefined) {
			userTargetIndex = newTimeline.findIndex((t) => {
				const tYear = getReleaseYear(t);
				return tYear !== null && tYear > year;
			});
			if (userTargetIndex === -1) userTargetIndex = newTimeline.length;
		} else {
			userTargetIndex = newTimeline.findIndex((t) => {
				const tYear = getReleaseYear(t);
				return tYear !== null && tYear >= trackYear;
			});
			if (userTargetIndex === -1) userTargetIndex = newTimeline.length;
		}

		// 3. Check for same-year adjacency violations (only if not using 'same' placement)
		if (placementType !== 'same') {
			// Check the track before (if exists)
			if (userTargetIndex > 0) {
				const prevTrack = newTimeline[userTargetIndex - 1];
				const prevYear = getReleaseYear(prevTrack);
				if (prevYear !== null && prevYear === trackYear) {
					// Adjacent to a track in the same year - mark as incorrect
					return { correct: false, correctPosition: userTargetIndex };
				}
			}
			// Check the track after (if exists)
			if (userTargetIndex < newTimeline.length) {
				const nextTrack = newTimeline[userTargetIndex];
				const nextYear = getReleaseYear(nextTrack);
				if (nextYear !== null && nextYear === trackYear) {
					// Adjacent to a track in the same year - mark as incorrect
					return { correct: false, correctPosition: userTargetIndex };
				}
			}
		}

		// 4. Compare target vs correct index
		const isCorrect = userTargetIndex === actualCorrectIndex;

		// 5. Validate chronological order
		newTimeline.splice(userTargetIndex, 0, track);
		let correct = isCorrect;
		for (let i = 0; i < newTimeline.length - 1; i++) {
			const year1 = getReleaseYear(newTimeline[i]);
			const year2 = getReleaseYear(newTimeline[i + 1]);
			// Allow same year (year1 === year2), but not wrong order (year1 > year2)
			if (year1 === null || year2 === null || year1 > year2) {
				correct = false;
				break;
			}
		}

		return { correct, correctPosition: actualCorrectIndex };
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

		const insertIndex = result.correctPosition >= 0 ? result.correctPosition : player.timeline.length;
		player.timeline.splice(insertIndex, 0, track);

		// Ensure timeline is sorted chronologically (oldest to newest, left to right)
		player.timeline.sort((a, b) => {
			const yearA = getReleaseYear(a);
			const yearB = getReleaseYear(b);
			if (yearA === null && yearB === null) return 0;
			if (yearA === null) return 1;
			if (yearB === null) return -1;
			return yearA - yearB;
		});

		if (result.correct) {
			player.score += 1;
		} else {
			player.score = 0;
		}

		return result;
	}

	// Place track from gap selection
	placeTrackFromGap(gapIndex: number): PlacementResult | null {
		if (!this.currentTrack || !this.currentPlayer) return null;

		const player = this.currentPlayer;
		let placementType: PlacementType = 'before';
		let referenceIndex: number | null = null;

		// Gap index represents position between cards
		// gapIndex 0 = before first card
		// gapIndex 1 = between first and second card, etc.
		if (gapIndex === 0) {
			// Before timeline start
			placementType = 'before';
			referenceIndex = null;
		} else if (gapIndex > player.timeline.length) {
			// After timeline end
			placementType = 'after';
			referenceIndex = null;
		} else {
			// Between cards - use 'before' the card at gapIndex
			placementType = 'before';
			referenceIndex = gapIndex - 1;
		}

		const result = this.validatePlacement(
			this.currentPlayerIndex,
			this.currentTrack,
			placementType,
			referenceIndex
		);

		if (result.correct) {
			player.score += 1;
		} else {
			player.score = 0;
		}

		// Only add track to timeline if guess was correct
		if (result.correct) {
			// Insert at the chronologically correct position (calculated by validatePlacement)
			const insertIndex = result.correctPosition >= 0 ? result.correctPosition : player.timeline.length;
			player.timeline.splice(insertIndex, 0, this.currentTrack);

			// Ensure timeline is sorted chronologically (oldest to newest, left to right)
			player.timeline.sort((a, b) => {
				const yearA = getReleaseYear(a);
				const yearB = getReleaseYear(b);
				if (yearA === null && yearB === null) return 0;
				if (yearA === null) return 1;
				if (yearB === null) return -1;
				return yearA - yearB;
			});
		}

		this.availableTracks = this.availableTracks.filter((t) => t !== this.currentTrack);
		this.roundResult = result;
		this.gameStatus = 'roundEnd';

		if (player.score >= 10) {
			setTimeout(() => {
				this.endGame();
			}, 2000);
		}

		return result;
	}

	// Place track in same year as card selection
	placeTrackSameYear(cardIndex: number): PlacementResult | null {
		if (!this.currentTrack || !this.currentPlayer) return null;

		const player = this.currentPlayer;

		// Validate card index
		if (cardIndex < 0 || cardIndex >= player.timeline.length) {
			return null;
		}

		// Get the reference track at the card index
		const referenceTrack = player.timeline[cardIndex];
		const referenceYear = getReleaseYear(referenceTrack);

		if (referenceYear === null) {
			return null;
		}

		// Validate placement with same-year type
		const result = this.validatePlacement(
			this.currentPlayerIndex,
			this.currentTrack,
			'same',
			null,
			referenceYear
		);

		if (result.correct) {
			player.score += 1;
		} else {
			player.score = 0;
		}

		// Only add track to timeline if guess was correct
		if (result.correct) {
			// Insert at the chronologically correct position (calculated by validatePlacement)
			const insertIndex = result.correctPosition >= 0 ? result.correctPosition : player.timeline.length;
			player.timeline.splice(insertIndex, 0, this.currentTrack);

			// Ensure timeline is sorted chronologically (oldest to newest, left to right)
			player.timeline.sort((a, b) => {
				const yearA = getReleaseYear(a);
				const yearB = getReleaseYear(b);
				if (yearA === null && yearB === null) return 0;
				if (yearA === null) return 1;
				if (yearB === null) return -1;
				return yearA - yearB;
			});
		}

		this.availableTracks = this.availableTracks.filter((t) => t !== this.currentTrack);
		this.roundResult = result;
		this.gameStatus = 'roundEnd';

		if (player.score >= 10) {
			setTimeout(() => {
				this.endGame();
			}, 2000);
		}

		return result;
	}

	nextTurn() {
		if (this.gameStatus === 'roundEnd') {
			this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
			this.turnNumber++;
			this.selectRandomTrack();
			this.gameStatus = 'playing';
		}
	}

	endGame() {
		this.gameStatus = 'gameEnd';
	}

	// Build timeline items (cards and gaps), grouping tracks by year
	buildTimelineItems(currentPlayer: Player | undefined): Array<{
		type: 'card' | 'gap';
		track?: Track;
		index?: number;
		gapIndex?: number;
		sameYearCount?: number;
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
					items.push({
						type: 'card',
						track,
						index,
						sameYearCount: yearGroup && yearGroup.count > 1 ? yearGroup.count - 1 : undefined
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
}

