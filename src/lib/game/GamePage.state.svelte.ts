import type { Track } from '$lib/types';
import type { PlacementType } from '$lib/types/tunetap.js';
import { TuneTapGame } from '$lib/game/TuneTapGame.svelte.js';
import { getContext, setContext, tick } from 'svelte';
import { Spring, prefersReducedMotion } from 'svelte/motion';
import { useEventListener } from 'runed';
import { goto } from '$app/navigation';
import type { Page } from '@sveltejs/kit';
import { isTrackPlayable, needsReleaseDate } from '$lib/utils/track';
import {
	type GameSessionData,
	saveSession,
	saveSessionImmediate,
	clearSession
} from '$lib/game/GameSession.store';

const GAME_PAGE_KEY = Symbol('GamePageState');

export function createGamePageContext() {
	const ctx = new GamePageState();
	setContext(GAME_PAGE_KEY, ctx);
	return ctx;
}

export function useGamePageContext() {
	const ctx = getContext<GamePageState>(GAME_PAGE_KEY);
	if (!ctx) {
		throw new Error('GamePageState context not found. Ensure createGamePageContext() is called in a parent component.');
	}
	return ctx;
}

export class GamePageState {
	// Tracks and Players
	tracks = $state<Track[]>([]);
	playerCount = $state(2);
	playerNames = $state<string[]>([]);
	allowPartialStartPreference = $state(false);

	// Initialization and data fetching
	hasInitialized = $state(false);
	releaseDates = $state<Map<number, string | undefined>>(new Map());
	queueSize = $state(0);

	// Game Engine
	gameEngine = $state<TuneTapGame | null>(null);
	playableTracks = $derived(this.tracks.filter(isTrackPlayable));

	// UI state
	showReleaseDates = $state(false);
	showSongName = $state(false);
	showArtistName = $state(false);
	exactYearBonusAwarded = $state<number | null>(null);
	blurred = $state(true);
	showHandoff = $state(false);

	// Audio
	audioElement: HTMLAudioElement | null = $state(null);
	isPlaying = $state(false);
	isPaused = $state(true);

	// Needle Drop Layout State
	timelineReel: HTMLDivElement | null = $state(null);
	needleOverlayEl: HTMLDivElement | null = $state(null);
	needleSpring = new Spring(0, {
		stiffness: 0.15,
		damping: 0.8
	});
	activeGapIndex = $state<number | null>(null);
	activeCardIndex = $state<number | null>(null);
	showDropButton = $state(false);
	previousActiveElement: HTMLElement | null = $state(null);

	// Timeline Navigation State
	canScrollLeft = $state(false);
	canScrollRight = $state(false);

	private lastAudioSrc: string | null = null;

	constructor() {

		useEventListener(
			() => window,
			'keydown',
			(event: KeyboardEvent) => {
				// Don't handle shortcuts when typing in inputs
				if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
					return;
				}

				// Global shortcuts (work in any game state)
				if (event.key === ' ' || event.key === 'Spacebar') {
					event.preventDefault();
					this.togglePlayPause();
					return;
				}

				// Only handle these shortcuts when playing
				if (!this.gameEngine || this.gameEngine.gameStatus !== 'playing') return;

				switch (event.key) {
					case 'ArrowLeft':
						if (this.canScrollLeft) {
							event.preventDefault();
							this.scrollTimelineLeft();
						}
						break;
					case 'ArrowRight':
						if (this.canScrollRight) {
							event.preventDefault();
							this.scrollTimelineRight();
						}
						break;
					case 'Enter':
						// Confirm placement if button is visible
						if (this.showDropButton) {
							event.preventDefault();
							if (this.activeCardIndex !== null) {
								this.placeTrackSameYear(this.activeCardIndex);
							} else if (this.activeGapIndex !== null) {
								this.placeTrackFromGap(this.activeGapIndex);
							}
						}
						break;
					case 'r':
					case 'R':
						// Reveal track info
						if (this.blurred) {
							event.preventDefault();
							this.handleRevealClick();
						}
						break;
				}
			}
		);
		
		useEventListener(() => this.timelineReel, 'scroll', this.handleScroll.bind(this));
		
		// Track when timelineReel changes (e.g., player switches, timeline content updates)
		let reelEffectCount = 0;
		$effect(() => {
			// Only track timelineReel - don't modify state synchronously to avoid loops
			const reel = this.timelineReel;
			if (!reel) return;
			
			reelEffectCount++;
			const currentCount = reelEffectCount;
			console.log(`[GamePageState] timelineReel effect triggered #${currentCount}`);
			
			// Defer all state modifications to after the effect tracking phase
			tick().then(() => {
				console.log(`[GamePageState] timelineReel tick.then #${currentCount}`);
				this.updateScrollState();
				if (this.gameEngine?.gameStatus === 'playing') {
					this.detectNeedleCollision();
				}
			});
		});

		// Track needle overlay setup - this effect should only run when elements change
		let needleEffectCount = 0;
		$effect(() => {
			if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
			if (!this.timelineReel || !this.needleOverlayEl) return;

			needleEffectCount++;
			console.log(`[GamePageState] needleOverlay effect triggered #${needleEffectCount}`);

			const updateNeedleOffset = () => {
				const reelRect = this.timelineReel?.getBoundingClientRect();
				const overlayRect = this.needleOverlayEl?.getBoundingClientRect();
				if (!reelRect || !overlayRect) return;
				const offset =
					reelRect.left + reelRect.width / 2 - (overlayRect.left + overlayRect.width / 2);
				if (prefersReducedMotion.current) {
					this.needleSpring.set(offset, { instant: true });
				} else {
					this.needleSpring.target = offset;
				}
			};

			updateNeedleOffset();
			const resizeObserver = new ResizeObserver(() => updateNeedleOffset());
			resizeObserver.observe(this.timelineReel);
			resizeObserver.observe(this.needleOverlayEl);
			window.addEventListener('resize', updateNeedleOffset);

			return () => {
				resizeObserver.disconnect();
				window.removeEventListener('resize', updateNeedleOffset);
			};
		});

	}

	/**
	 * Hydrate the state with game data. This is the preferred method per AGENTS.md -
	 * data loading should happen in the component, then passed to the state class.
	 */
	hydrateData(data: {
		tracks: Track[];
		playerCount: number;
		showSongName?: boolean;
		showArtistName?: boolean;
		allowPartialStart?: boolean;
	}) {
		if (this.hasInitialized) return;

		const playerCount = Math.min(6, Math.max(2, data.playerCount));

		if (data.tracks.length > 0) {
			this.hasInitialized = true;
			this.tracks = data.tracks;
			this.playerCount = playerCount;
			this.playerNames = Array(playerCount)
				.fill('')
				.map((_, i) => `Player ${i + 1}`);
			this.showSongName = data.showSongName ?? false;
			this.showArtistName = data.showArtistName ?? false;
			this.allowPartialStartPreference = data.allowPartialStart ?? false;
			this.initializeReleaseMap(data.tracks);
		}

		this.updateScrollState();
	}

	/**
	 * Convenience method that loads data from sessionStorage/page state.
	 * Prefer using hydrateData() with data loaded in the component.
	 */
	init(page: Page) {
		if (this.hasInitialized) return;

		let loadedTracks: Track[] | null = null;
		let loadedPlayerCount = 2;
		let loadedFromSessionStorage = false;
		let showSongName = false;
		let showArtistName = false;
		let allowPartialStart = false;

		try {
			const tracksData = sessionStorage.getItem('tunetap_tracks');
			const playerCountData = sessionStorage.getItem('tunetap_playerCount');
			const showSongNameData = sessionStorage.getItem('tunetap_showSongName');
			const showArtistNameData = sessionStorage.getItem('tunetap_showArtistName');
			const allowPartialStartData = sessionStorage.getItem('tunetap_allowPartialStart');

			if (tracksData) {
				loadedTracks = JSON.parse(tracksData);
				loadedFromSessionStorage = true;
			}
			if (playerCountData) loadedPlayerCount = parseInt(playerCountData, 10);
			if (showSongNameData) showSongName = showSongNameData === 'true';
			if (showArtistNameData) showArtistName = showArtistNameData === 'true';
			if (allowPartialStartData) allowPartialStart = allowPartialStartData === 'true';
		} catch (error) {
			console.error('[Game] Error loading from sessionStorage:', error);
		}

		if (!loadedTracks) {
			const pageState = page.state as any;
			if (pageState?.tracks) loadedTracks = pageState.tracks;
			else if (pageState?.tracksData) {
				try {
					loadedTracks = JSON.parse(pageState.tracksData);
				} catch (error) {
					console.error('[Game] Error parsing tracksData:', error);
				}
			}
			if (pageState?.playerCount) loadedPlayerCount = pageState.playerCount;
			if (pageState?.showSongName !== undefined) showSongName = pageState.showSongName;
			if (pageState?.showArtistName !== undefined) showArtistName = pageState.showArtistName;
			if (pageState?.allowPartialStart !== undefined) allowPartialStart = pageState.allowPartialStart;
		}

		if (loadedTracks && loadedTracks.length > 0) {
			this.hydrateData({
				tracks: loadedTracks,
				playerCount: loadedPlayerCount,
				showSongName,
				showArtistName,
				allowPartialStart
			});

			if (loadedFromSessionStorage) {
				this.clearSessionStorage();
			}
		}

		this.updateScrollState();
	}

	private clearSessionStorage() {
		try {
			sessionStorage.removeItem('tunetap_tracks');
			sessionStorage.removeItem('tunetap_playerCount');
			sessionStorage.removeItem('tunetap_showSongName');
			sessionStorage.removeItem('tunetap_showArtistName');
			sessionStorage.removeItem('tunetap_allowPartialStart');
		} catch (error) {
			console.error('[Game] Error clearing sessionStorage:', error);
		}
	}

	private initializeReleaseMap(tracks: Track[]) {
		const dates = new Map<number, string | undefined>();
		tracks.forEach((track, index) => {
			if (track.firstReleaseDate) {
				dates.set(index, track.firstReleaseDate);
			}
		});
		this.releaseDates = dates;
	}

	getTracksNeedingReleaseDates() {
		return this.tracks
			.map((track, index) => ({ track, index }))
			.filter(({ track }) => needsReleaseDate(track));
	}

	applyReleaseDateById(trackId: string, releaseDate: string | undefined) {
		if (!releaseDate) {
			return false;
		}
		const index = this.tracks.findIndex((track) => track.id === trackId);
		if (index === -1) {
			return false;
		}
		return this.applyTrackReleaseDate(index, releaseDate);
	}

	getTrackById(trackId: string) {
		const index = this.tracks.findIndex((track) => track.id === trackId);
		if (index === -1) return null;
		return { track: this.tracks[index], index };
	}

	initializeGame() {
		this.gameEngine = new TuneTapGame();
		this.gameEngine.initializeGame(this.playableTracks, this.playerNames);
		this.showReleaseDates = false;
		this.exactYearBonusAwarded = null;
		this.blurred = true;
		this.stopTrack();
	}

	playTrack() {
		const currentTrack = this.gameEngine?.currentTrack;
		if (!this.audioElement || !currentTrack?.audioUrl) return;
		if (this.lastAudioSrc !== currentTrack.audioUrl) {
			this.lastAudioSrc = currentTrack.audioUrl;
			this.audioElement.load();
		}
		this.audioElement
			.play()
			.then(() => {
				this.isPlaying = true;
				this.isPaused = false;
			})
			.catch((error) => console.error('[Game] Error playing audio:', error));
	}

	togglePlayPause() {
		if (this.isPlaying) {
			this.stopTrack();
		} else {
			this.playTrack();
		}
	}



	private applyTrackReleaseDate(index: number, releaseDate: string | undefined) {
		if (!releaseDate) return false;
		const track = this.tracks[index];
		if (!track || track.firstReleaseDate === releaseDate) {
			return false;
		}
		const updatedTracks = [...this.tracks];
		updatedTracks[index] = { ...track, firstReleaseDate: releaseDate };
		this.tracks = updatedTracks;
		const updatedMap = new Map(this.releaseDates);
		updatedMap.set(index, releaseDate);
		this.releaseDates = updatedMap;
		return true;
	}

	stopTrack() {
		if (this.audioElement) {
			this.audioElement.pause();
			this.audioElement.currentTime = 0;
		}
		this.isPaused = true;
		this.isPlaying = false;
	}

	placeTrackFromGap(gapIndex: number) {
		if (!this.gameEngine) return;
		this.gameEngine.placeTrackFromGap(gapIndex);
		this.showReleaseDates = true;
		this.exactYearBonusAwarded = null;
		// Reset UI state after placement
		this.showDropButton = false;
		this.activeGapIndex = null;
		this.activeCardIndex = null;
		if (this.previousActiveElement) {
			this.previousActiveElement.style.opacity = '0.5';
			this.previousActiveElement = null;
		}
	}

	placeTrackSameYear(cardIndex: number) {
		if (!this.gameEngine) return;
		this.gameEngine.placeTrackSameYear(cardIndex);
		this.showReleaseDates = true;
		this.exactYearBonusAwarded = null;
		// Reset UI state after placement
		this.showDropButton = false;
		this.activeGapIndex = null;
		this.activeCardIndex = null;
		if (this.previousActiveElement) {
			this.previousActiveElement.style.opacity = '0.5';
			this.previousActiveElement = null;
		}
	}

	nextTurn() {
		if (!this.gameEngine) {
			console.warn('[GamePageState] nextTurn: No game engine');
			return;
		}
		
		const playerCount = this.gameEngine.players.length;
		const currentIdx = this.gameEngine.currentPlayerIndex;
		console.log(`[GamePageState] nextTurn called - players: ${playerCount}, currentIdx: ${currentIdx}`);
		
		// Show handoff screen if multiplayer
		if (playerCount > 1) {
			console.log('[GamePageState] Setting showHandoff = true for multiplayer handoff');
			this.showHandoff = true;
		} else {
			console.log('[GamePageState] Single player - completing turn directly');
			this.completeNextTurn();
		}
	}

	completeNextTurn() {
		if (!this.gameEngine) {
			console.warn('[GamePageState] completeNextTurn: No game engine');
			return;
		}
		
		const prevIdx = this.gameEngine.currentPlayerIndex;
		console.log(`[GamePageState] completeNextTurn - advancing from player ${prevIdx}`);
		
		// Advance the game state first
		this.gameEngine.nextTurn();
		
		const newIdx = this.gameEngine.currentPlayerIndex;
		const newStatus = this.gameEngine.gameStatus;
		console.log(`[GamePageState] Game advanced - new player: ${newIdx}, status: ${newStatus}`);
		
		// Reset game UI state
		this.blurred = true;
		this.showSongName = false;
		this.showArtistName = false;
		this.showHandoff = false;
		this.showReleaseDates = false;
		this.stopTrack();
		
		// Re-trigger collision detection after timeline updates
		// Use tick() to wait for the DOM to update with new timeline content
		tick().then(() => {
			this.updateScrollState();
			this.detectNeedleCollision();
			console.log(`[GamePageState] Re-detected collision - showDropButton: ${this.showDropButton}`);
		});
	}

	endGame() {
		if (!this.gameEngine) return;
		this.gameEngine.endGame();
		this.showReleaseDates = true;
		this.stopTrack();
	}

	restartGame() {
		clearSession();
		goto('/playlist');
	}

	handleRevealClick() {
		this.blurred = false;
		this.showSongName = true;
		this.showArtistName = true;
	}

	handleScroll() {
		if (!this.timelineReel) return;
		this.updateScrollState();
		this.detectNeedleCollision();
	}

	updateScrollState() {
		if (!this.timelineReel) {
			this.canScrollLeft = false;
			this.canScrollRight = false;
			return;
		}
		const { scrollLeft, scrollWidth, clientWidth } = this.timelineReel;
		this.canScrollLeft = scrollLeft > 0;
		this.canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;
	}
	
	scrollTimelineLeft() {
		if (!this.timelineReel) return;
		this.timelineReel.scrollBy({ left: -150, behavior: 'smooth' });
	}

	scrollTimelineRight() {
		if (!this.timelineReel) return;
		this.timelineReel.scrollBy({ left: 150, behavior: 'smooth' });
	}

	detectNeedleCollision() {
		if (!this.timelineReel || !this.gameEngine || this.gameEngine.gameStatus !== 'playing') {
			this.showDropButton = false;
			this.activeGapIndex = null;
			this.activeCardIndex = null;
			return;
		}

		const centerX = window.innerWidth / 2;
		const elements = Array.from(
			this.timelineReel.querySelectorAll<HTMLElement>('.timeline-card, .timeline-gap')
		);

		if (elements.length === 0) {
			this.activeGapIndex = null;
			this.activeCardIndex = null;
			this.showDropButton = false;
			return;
		}

		let closestElement: HTMLElement | null = null;
		let minDistance = Infinity;

		for (const element of elements) {
			const rect = element.getBoundingClientRect();
			const childCenterX = rect.left + rect.width / 2;
			const distance = Math.abs(centerX - childCenterX);
			if (distance < minDistance) {
				minDistance = distance;
				closestElement = element;
			}
		}

		if (this.previousActiveElement && this.previousActiveElement.classList.contains('timeline-card')) {
			this.previousActiveElement.style.opacity = '0.5';
		}

		if (closestElement) {
			if (closestElement.classList.contains('timeline-card')) {
				closestElement.style.opacity = '1';
				this.previousActiveElement = closestElement;
			} else if (this.previousActiveElement) {
				this.previousActiveElement.style.opacity = '0.5';
				this.previousActiveElement = null;
			}

			if (closestElement.classList.contains('timeline-gap')) {
				const gapIndex = parseInt(closestElement.dataset.gapIndex || '0', 10);
				this.activeGapIndex = gapIndex;
				this.activeCardIndex = null;
				this.showDropButton = true;
				elements.forEach((element) => {
					if (element.classList.contains('timeline-gap')) {
						element.classList.toggle('active', element === closestElement);
					}
				});
			} else if (closestElement.classList.contains('timeline-card')) {
				const cardIndex = parseInt(closestElement.dataset.index || '-1', 10);
				if (cardIndex >= 0) {
					this.activeCardIndex = cardIndex;
					this.activeGapIndex = null;
					this.showDropButton = true;
				} else {
					this.activeCardIndex = null;
					this.activeGapIndex = null;
					this.showDropButton = false;
				}
				elements.forEach((element) => {
					if (element.classList.contains('timeline-gap')) {
						element.classList.remove('active');
					}
				});
			} else {
				this.activeGapIndex = null;
				this.activeCardIndex = null;
				this.showDropButton = false;
				elements.forEach((element) => {
					if (element.classList.contains('timeline-gap')) {
						element.classList.remove('active');
					}
				});
			}
		} else {
			this.activeGapIndex = null;
			this.activeCardIndex = null;
			this.showDropButton = false;
			elements.forEach((element) => {
				if (element.classList.contains('timeline-gap')) {
					element.classList.remove('active');
				}
			});
		}
	}

	/**
	 * Serialize the complete game state for sessionStorage persistence.
	 * Called automatically via $effect when state changes.
	 */
	serialize(): GameSessionData {
		const gameEngineData = this.gameEngine
			? this.gameEngine.serialize(this.tracks)
			: {
					players: [],
					currentPlayerIndex: 0,
					currentTrackId: null,
					availableTrackIds: [],
					gameStatus: 'setup' as const,
					turnsTaken: 0,
					initialTurnCount: 0
				};

		return {
			tracks: this.tracks,
			playerNames: this.playerNames,
			playerCount: this.playerCount,
			showSongName: this.showSongName,
			showArtistName: this.showArtistName,
			allowPartialStart: this.allowPartialStartPreference,
			queueSize: this.queueSize,
			players: gameEngineData.players,
			currentPlayerIndex: gameEngineData.currentPlayerIndex,
			currentTrackId: gameEngineData.currentTrackId,
			availableTrackIds: gameEngineData.availableTrackIds,
			gameStatus: gameEngineData.gameStatus,
			turnsTaken: gameEngineData.turnsTaken,
			initialTurnCount: gameEngineData.initialTurnCount,
			showHandoff: this.showHandoff,
			blurred: this.blurred,
			showReleaseDates: this.showReleaseDates,
			exactYearBonusAwarded: this.exactYearBonusAwarded
		};
	}

	/**
	 * Deserialize game state from sessionStorage.
	 * Called on layout mount to restore game state after navigation/refresh.
	 */
	deserialize(data: GameSessionData): void {
		// Restore track data
		this.tracks = data.tracks;
		this.playerNames = data.playerNames;
		this.playerCount = data.playerCount;
		this.showSongName = data.showSongName;
		this.showArtistName = data.showArtistName;
		this.allowPartialStartPreference = data.allowPartialStart;
		this.queueSize = data.queueSize;

		// Restore UI state
		this.showHandoff = data.showHandoff;
		this.blurred = data.blurred;
		this.showReleaseDates = data.showReleaseDates;
		this.exactYearBonusAwarded = data.exactYearBonusAwarded;

		// Initialize release map from tracks
		this.initializeReleaseMap(data.tracks);

		// Restore game engine if game is in progress
		if (data.gameStatus !== 'setup' && data.players.length > 0) {
			this.gameEngine = new TuneTapGame();
			this.gameEngine.deserialize(
				{
					players: data.players,
					currentPlayerIndex: data.currentPlayerIndex,
					currentTrackId: data.currentTrackId,
					availableTrackIds: data.availableTrackIds,
					gameStatus: data.gameStatus,
					turnsTaken: data.turnsTaken,
					initialTurnCount: data.initialTurnCount
				},
				data.tracks
			);
		}

		this.hasInitialized = true;
		this.updateScrollState();
	}

	/**
	 * Save current state to sessionStorage.
	 * Use debounced version for frequent updates, immediate for critical changes.
	 */
	saveToSession(immediate = false): void {
		if (!this.hasInitialized) return;

		const data = this.serialize();
		if (immediate) {
			saveSessionImmediate(data);
		} else {
			saveSession(data);
		}
	}

	/**
	 * Enable automatic session persistence.
	 * Call this once after context is created to enable auto-save on state changes.
	 */
	enableSessionPersistence(): void {
		let persistEffectCount = 0;
		$effect(() => {
			// Track all serializable state changes
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this.tracks;
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this.playerNames;
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this.gameEngine?.gameStatus;
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this.gameEngine?.currentPlayerIndex;
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this.gameEngine?.turnsTaken;
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this.showHandoff;
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			this.blurred;

			persistEffectCount++;
			if (persistEffectCount > 50) {
				console.error(`[GamePageState] POSSIBLE LOOP: sessionPersistence effect triggered ${persistEffectCount} times!`);
				return; // Stop to prevent freeze
			}

			if (this.hasInitialized) {
				this.saveToSession();
			}
		});
	}
}
