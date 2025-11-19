import type { Track } from '$lib/types';
import type { PlacementType } from '$lib/types/tunetap.js';
import { TuneTapGame } from '$lib/game/TuneTapGame.svelte.js';
import { fetchFirstReleaseDate, getQueueSize, getCachedReleaseDatesBatchQuery } from '../../routes/game/musicbrainz.remote';
import { untrack, tick } from 'svelte';
import { useInterval, useEventListener } from 'runed';
import { goto } from '$app/navigation';
import type { Page } from '@sveltejs/kit';

export class GamePageState {
	// Tracks and Players
	tracks = $state<Track[]>([]);
	playerCount = $state(2);
	playerNames = $state<string[]>([]);

	// Initialization and data fetching
	hasInitialized = $state(false);
	releaseDatePromises = $state<Map<number, Promise<string | undefined>>>(new Map());
	releaseDates = $state<Map<number, string | undefined>>(new Map());
	queueSize = $state(0);

	// Game Engine
	gameEngine = $state<TuneTapGame | null>(null);

	// UI state
	showReleaseDates = $state(false);
	showSongName = $state(false);
	showArtistName = $state(false);
	exactYearBonusAwarded = $state<number | null>(null);
	blurred = $state(true);

	// Audio
	audioElement: HTMLAudioElement | null = $state(null);
	isPlaying = $state(false);
	isPaused = $state(true);

	// Needle Drop Layout State
	timelineReel: HTMLDivElement | null = $state(null);
	needleOverlayEl: HTMLDivElement | null = $state(null);
	needleHorizontalOffset = $state(0);
	activeGapIndex = $state<number | null>(null);
	activeCardIndex = $state<number | null>(null);
	showDropButton = $state(false);
	previousActiveElement: HTMLElement | null = $state(null);

	// Timeline Navigation State
	canScrollLeft = $state(false);
	canScrollRight = $state(false);

	constructor() {
		useInterval(1000, {
			callback: async () => {
				try {
					const size = await getQueueSize();
					this.queueSize = size;
				} catch (error) {
					console.error('[Game] Error fetching queue size:', error);
				}
			}
		});

		useEventListener(
			() => window,
			'keydown',
			(event: KeyboardEvent) => {
				if (!this.gameEngine || this.gameEngine.gameStatus !== 'playing') return;
				if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
					return;
				}
				if (event.key === 'ArrowLeft' && this.canScrollLeft) {
					event.preventDefault();
					this.scrollTimelineLeft();
				} else if (event.key === 'ArrowRight' && this.canScrollRight) {
					event.preventDefault();
					this.scrollTimelineRight();
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
				this.needleHorizontalOffset =
					reelRect.left + reelRect.width / 2 - (overlayRect.left + overlayRect.width / 2);
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

	init(page: Page) {
		if (this.hasInitialized) return;

		let loadedTracks: Track[] | null = null;
		let loadedPlayerCount = 2;

		try {
			const tracksData = sessionStorage.getItem('tunetap_tracks');
			const playerCountData = sessionStorage.getItem('tunetap_playerCount');
			const showSongNameData = sessionStorage.getItem('tunetap_showSongName');
			const showArtistNameData = sessionStorage.getItem('tunetap_showArtistName');

			if (tracksData) loadedTracks = JSON.parse(tracksData);
			if (playerCountData) loadedPlayerCount = parseInt(playerCountData, 10);
			if (showSongNameData) this.showSongName = showSongNameData === 'true';
			if (showArtistNameData) this.showArtistName = showArtistNameData === 'true';

			sessionStorage.removeItem('tunetap_tracks');
			sessionStorage.removeItem('tunetap_playerCount');
			sessionStorage.removeItem('tunetap_showSongName');
			sessionStorage.removeItem('tunetap_showArtistName');
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
			if (pageState?.showSongName !== undefined) this.showSongName = pageState.showSongName;
			if (pageState?.showArtistName !== undefined) this.showArtistName = pageState.showArtistName;
		}

		if (loadedTracks && loadedTracks.length > 0) {
			this.hasInitialized = true;
			this.tracks = loadedTracks;
			this.playerCount = loadedPlayerCount;
			this.playerNames = Array(this.playerCount).fill('').map((_, i) => `Player ${i + 1}`);
			this.initializeTrackDates(loadedTracks);
		}
		
		this.updateScrollState();
	}

	private async initializeTrackDates(loadedTracks: Track[]) {
		const promises = new Map<number, Promise<string | undefined>>();
		const dates = new Map<number, string | undefined>();
		const tracksToCheck = loadedTracks.map((track, index) => ({ index, track })).filter(({ track }) => !track.firstReleaseDate && track.artists.length > 0);
		let cachedDates: Record<string, string | null> = {};

		if (tracksToCheck.length > 0) {
			const batchCheckTracks = tracksToCheck.map(({ track }) => ({ trackName: track.name, artistName: track.artists[0] }));
			try {
				cachedDates = await getCachedReleaseDatesBatchQuery({ tracks: batchCheckTracks });
				untrack(() => {
					for (const { index, track } of tracksToCheck) {
						const key = `${track.name}|${track.artists[0]}`;
						const cachedDate = cachedDates[key];
						if (cachedDate) {
							dates.set(index, cachedDate);
							this.tracks[index].firstReleaseDate = cachedDate;
						}
					}
					this.releaseDates = new Map(dates);
				});
			} catch (error) {
				console.error('[Game] Error in batch cache check:', error);
			}
		}

		loadedTracks.forEach((track, index) => {
			if (track.firstReleaseDate) dates.set(index, track.firstReleaseDate);
		});

		const tracksToFetch = tracksToCheck.filter(({ track }) => {
			const key = `${track.name}|${track.artists[0]}`;
			return cachedDates[key] === null || cachedDates[key] === undefined;
		});

		for (const { index, track } of tracksToFetch) {
			const artistName = track.artists[0];
			const promise = fetchFirstReleaseDate({ trackName: track.name, artistName }).then(date => {
				untrack(() => {
					dates.set(index, date);
					this.releaseDates = new Map(dates);
					if (date) this.tracks[index].firstReleaseDate = date;
				});
				return date;
			});
			promises.set(index, promise);
		}

		this.releaseDatePromises = new Map(promises);
		this.releaseDates = dates;
	}

	get playableTracks() {
		return this.tracks.filter((t) => t.firstReleaseDate && t.audioUrl && t.status === 'found');
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
		if (!this.audioElement) return;
		this.audioElement.load();
		this.audioElement.play().then(() => {
			this.isPlaying = true;
			this.isPaused = false;
		}).catch(error => console.error('[Game] Error playing audio:', error));
	}

	stopTrack() {
		if (this.audioElement) {
			this.isPaused = true;
			this.isPlaying = false;
		}
	}

	placeTrackFromGap(gapIndex: number) {
		if (!this.gameEngine) return;
		this.gameEngine.placeTrackFromGap(gapIndex);
		this.showReleaseDates = true;
		this.exactYearBonusAwarded = null;
	}

	placeTrackSameYear(cardIndex: number) {
		if (!this.gameEngine) return;
		this.gameEngine.placeTrackSameYear(cardIndex);
		this.showReleaseDates = true;
		this.exactYearBonusAwarded = null;
	}

	nextTurn() {
		if (!this.gameEngine) return;
		this.gameEngine.nextTurn();
		this.blurred = true;
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
		const children = Array.from(this.timelineReel.children);
		let closestChild: Element | null = null;
		let minDistance = Infinity;

		for (const child of children) {
			const rect = child.getBoundingClientRect();
			const childCenterX = rect.left + rect.width / 2;
			const distance = Math.abs(centerX - childCenterX);
			if (distance < minDistance) {
				minDistance = distance;
				closestChild = child;
			}
		}

		if (this.previousActiveElement && this.previousActiveElement.classList.contains('timeline-card')) {
			this.previousActiveElement.style.opacity = '0.5';
		}

		if (closestChild) {
			if (closestChild.classList.contains('timeline-card')) {
				(closestChild as HTMLElement).style.opacity = '1';
				this.previousActiveElement = closestChild as HTMLElement;
			} else if (this.previousActiveElement) {
				this.previousActiveElement.style.opacity = '0.5';
				this.previousActiveElement = null;
			}

			if (closestChild.classList.contains('timeline-gap')) {
				const gapIndex = parseInt((closestChild as HTMLElement).dataset.gapIndex || '0', 10);
				this.activeGapIndex = gapIndex;
				this.activeCardIndex = null;
				this.showDropButton = true;
				for (const child of children) {
					child.classList.toggle('active', child === closestChild);
				}
			} else if (closestChild.classList.contains('timeline-card')) {
				const cardIndex = parseInt((closestChild as HTMLElement).dataset.index || '-1', 10);
				if (cardIndex >= 0) {
					this.activeCardIndex = cardIndex;
					this.activeGapIndex = null;
					this.showDropButton = true;
				} else {
					this.activeCardIndex = null;
					this.activeGapIndex = null;
					this.showDropButton = false;
				}
				for (const child of children) {
					if (child.classList.contains('timeline-gap')) {
						child.classList.remove('active');
					}
				}
			} else {
				this.activeGapIndex = null;
				this.activeCardIndex = null;
				this.showDropButton = false;
				for (const child of children) {
					if (child.classList.contains('timeline-gap')) {
						child.classList.remove('active');
					}
				}
			}
		} else {
			this.activeGapIndex = null;
			this.activeCardIndex = null;
			this.showDropButton = false;
			for (const child of children) {
				if (child.classList.contains('timeline-gap')) {
					child.classList.remove('active');
				}
			}
		}
	}
}
