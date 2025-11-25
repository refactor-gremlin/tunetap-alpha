import type { Track } from '$lib/types';
import type { PlacementType } from '$lib/types/tunetap.js';
import { TuneTapGame } from '$lib/game/TuneTapGame.svelte.js';
import { getContext, setContext, tick } from 'svelte';
import { Spring, prefersReducedMotion } from 'svelte/motion';
import { useEventListener } from 'runed';
import { goto } from '$app/navigation';
import type { Page } from '@sveltejs/kit';
import { isTrackPlayable, needsReleaseDate } from '$lib/utils/track';

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
		
		$effect(() => {
			if (!this.timelineReel) return;
			this.updateScrollState();
			tick().then(() => {
				this.updateScrollState();
				if (this.gameEngine?.gameStatus === 'playing') {
					this.detectNeedleCollision();
				}
			});
		});

		$effect(() => {
			if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
			if (!this.timelineReel || !this.needleOverlayEl) return;

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
			console.log(`[GamePageState] applyReleaseDateById: No date for ${trackId}`);
			return false;
		}
		const index = this.tracks.findIndex((track) => track.id === trackId);
		if (index === -1) {
			console.log(`[GamePageState] applyReleaseDateById: Track not found ${trackId}`);
			return false;
		}
		const result = this.applyTrackReleaseDate(index, releaseDate);
		if (result) {
			console.log(`[GamePageState] Applied release date ${releaseDate} to track ${trackId} (index ${index})`);
		}
		return result;
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
		if (!this.gameEngine) return;
		
		// Show handoff screen if multiplayer
		if (this.gameEngine.players.length > 1) {
			this.showHandoff = true;
		} else {
			this.completeNextTurn();
		}
	}

	completeNextTurn() {
		if (!this.gameEngine) return;
		
		// Advance the game state first
		this.gameEngine.nextTurn();
		
		// Reset game UI state
		this.blurred = true;
		this.showSongName = false;
		this.showArtistName = false;
		this.showHandoff = false;
		this.stopTrack();
	}

	endGame() {
		if (!this.gameEngine) return;
		this.gameEngine.endGame();
		this.showReleaseDates = true;
		this.stopTrack();
	}

	restartGame() {
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
}
