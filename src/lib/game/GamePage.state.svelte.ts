import type { Track } from '$lib/types';
import type { PlacementType } from '$lib/types/tunetap.js';
import { TuneTapGame } from '$lib/game/TuneTapGame.svelte.js';
import {
	fetchFirstReleaseDate,
	getQueueSize as getQueueSizeRemote,
	getCachedReleaseDatesBatchQuery,
	ensureQueueBatch,
	refreshPlayableTracks
} from '../../routes/game/musicbrainz.remote';
import { untrack, tick } from 'svelte';
import { useInterval, useEventListener } from 'runed';
import { goto } from '$app/navigation';
import type { Page } from '@sveltejs/kit';

// Export wrapper functions for queue status to be used in components
export const getQueueSize = getQueueSizeRemote;
import { getQueueStatus as getQueueStatusRemote } from '../../routes/game/musicbrainz.remote';
export const getQueueStatus = getQueueStatusRemote;

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

	private playableTrackRefreshInterval: ReturnType<typeof useInterval> | null = null;

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

		this.playableTrackRefreshInterval = useInterval(5000, {
			immediate: false,
			callback: () => this.refreshPlayableTrackAvailability()
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

		loadedPlayerCount = Math.min(6, Math.max(2, loadedPlayerCount));

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
		const tracksToCheck = loadedTracks
			.map((track, index) => ({ index, track }))
			.filter(({ track }) => !track.firstReleaseDate && track.artists.length > 0);
		let cachedDates: Record<string, string | null> = {};

		// 1. Batch check cache for ALL missing tracks
		if (tracksToCheck.length > 0) {
			const batchCheckTracks = tracksToCheck.map(({ track }) => ({
				trackName: track.name,
				artistName: track.artists[0]
			}));
			try {
				cachedDates = await getCachedReleaseDatesBatchQuery({ tracks: batchCheckTracks });
				untrack(() => {
					for (const { index, track } of tracksToCheck) {
						const key = `${track.name}|${track.artists[0]}`;
						const cachedDate = cachedDates[key];
						if (cachedDate) {
							dates.set(index, cachedDate);
							this.applyTrackReleaseDate(index, cachedDate);
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

		// 2. Identify which tracks still need fetching
		const tracksToFetch = tracksToCheck.filter(({ track }) => {
			const key = `${track.name}|${track.artists[0]}`;
			// Only fetch if the key is completely missing from the cache map (undefined).
			// If it is null, it means we checked before and found nothing, so don't retry.
			return cachedDates[key] === undefined;
		});

		// 3. Hybrid Strategy: Urgent vs Background
		// Urgent: First 20 tracks - fetch immediately with HIGH priority
		const urgentTracks = tracksToFetch.slice(0, 20);
		// Background: The rest - queue with LOW priority and poll for results
		const backgroundTracks = tracksToFetch.slice(20);

		console.log(
			`[Game] Fetching strategy: ${urgentTracks.length} urgent (High Priority), ${backgroundTracks.length} background (Low Priority)`
		);

		// Process Urgent Tracks
		for (const { index, track } of urgentTracks) {
			const artistName = track.artists[0];
			const promise = fetchFirstReleaseDate({
				trackName: track.name,
				artistName,
				priority: 'high'
			}).then((date) => {
				untrack(() => {
					dates.set(index, date);
					this.releaseDates = new Map(dates);
					if (date) this.applyTrackReleaseDate(index, date);
				});
				return date;
			});
			promises.set(index, promise);
		}

		// Process Background Tracks
		if (backgroundTracks.length > 0) {
			// Fire-and-forget: Ensure they are in the queue (Low Priority)
			const batchQueueTracks = backgroundTracks.map(({ track }) => ({
				trackName: track.name,
				artistName: track.artists[0]
			}));
			ensureQueueBatch({ tracks: batchQueueTracks }).catch((err) =>
				console.error('[Game] Failed to batch queue background tracks:', err)
			);

			// Start polling for background tracks
			// We'll use a separate interval that stops when all are found
			const pollInterval = setInterval(async () => {
				// Filter for tracks that still haven't been resolved
				const pendingTracks = backgroundTracks.filter(({ index }) => !dates.has(index));

				if (pendingTracks.length === 0) {
					clearInterval(pollInterval);
					return;
				}

				const batchCheck = pendingTracks.map(({ track }) => ({
					trackName: track.name,
					artistName: track.artists[0]
				}));

				try {
					const newCachedDates = await getCachedReleaseDatesBatchQuery({ tracks: batchCheck });
					let foundNew = false;

					untrack(() => {
						for (const { index, track } of pendingTracks) {
							const key = `${track.name}|${track.artists[0]}`;
							const date = newCachedDates[key];
							if (date) {
								dates.set(index, date);
								this.applyTrackReleaseDate(index, date);
								foundNew = true;
							}
						}
						if (foundNew) {
							this.releaseDates = new Map(dates);
						}
					});
				} catch (error) {
					console.error('[Game] Error polling for background tracks:', error);
				}
			}, 3000); // Poll every 3 seconds
		}

		this.releaseDatePromises = new Map(promises);
		this.releaseDates = dates;
		this.ensurePlayableTrackRefreshLoop();
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

	private async refreshPlayableTrackAvailability() {
		if (this.tracks.length === 0) {
			this.playableTrackRefreshInterval?.pause();
			return;
		}

		const pendingTracks = this.tracks
			.map((track, index) => ({ track, index }))
			.filter(({ track }) => this.trackNeedsReleaseDate(track));

		if (pendingTracks.length === 0) {
			this.playableTrackRefreshInterval?.pause();
			return;
		}

		const payload = pendingTracks.map(({ track }) => ({
			id: track.id,
			trackName: track.name,
			artistName: track.artists[0]
		}));

		try {
			const result = await refreshPlayableTracks({ tracks: payload });
			const newlyPlayable: Track[] = [];

			for (const { track, index } of pendingTracks) {
				const releaseDate = result.releaseDates?.[track.id];
				if (releaseDate) {
					const updated = this.applyTrackReleaseDate(index, releaseDate);
					if (updated) {
						const updatedTrack = this.tracks[index];
						if (updatedTrack?.audioUrl && updatedTrack.status === 'found') {
							newlyPlayable.push(updatedTrack);
						}
					}
				}
			}

			if (newlyPlayable.length > 0 && this.gameEngine) {
				this.gameEngine.addPlayableTracks(newlyPlayable);
			}

			const stillPending = this.tracks.some((track) => this.trackNeedsReleaseDate(track));
			if (!stillPending) {
				this.playableTrackRefreshInterval?.pause();
			}
		} catch (error) {
			console.error('[Game] Error refreshing playable tracks:', error);
		}
	}

	private ensurePlayableTrackRefreshLoop() {
		const interval = this.playableTrackRefreshInterval;
		if (!interval) return;
		const needsRefresh = this.tracks.some((track) => this.trackNeedsReleaseDate(track));
		if (needsRefresh) {
			interval.resume();
		} else {
			interval.pause();
		}
	}

	private trackNeedsReleaseDate(track: Track) {
		return (
			track.status === 'found' &&
			!!track.audioUrl &&
			!track.firstReleaseDate &&
			track.artists.length > 0
		);
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
