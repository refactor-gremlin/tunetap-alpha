<script lang="ts">
	import type { Track } from '$lib/types';
	import type { Player, PlacementResult, GameStatus, PlacementType } from '$lib/types/tunetap.js';
	import { page } from '$app/stores';
	import {
		fetchFirstReleaseDate,
		getQueueSize,
		getCachedReleaseDatesBatchQuery
	} from './musicbrainz.remote';
	import { untrack, onMount, tick } from 'svelte';
	import { useInterval, useEventListener } from 'runed';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import PageHeader from '$lib/components/custom/PageHeader.svelte';
	import { goto } from '$app/navigation';
	import { getReleaseYear } from '$lib/utils/timeline.js';
	import { Switch } from '$lib/components/shadncn-ui/switch/index.js';
	import { ViewportSizeDetector } from '$lib/hooks/viewport-size.svelte.js';
	import { TuneTapGame } from '$lib/game/TuneTapGame.svelte.js';

	// Import common components
	import Needle from '$lib/components/custom/tunetap/common/needle/Needle.svelte';
	import TimelineReel from '$lib/components/custom/tunetap/common/timeline/TimelineReel.svelte';
	import Stage from '$lib/components/custom/tunetap/common/stage/Stage.svelte';
	import UnifiedGameHeader from '$lib/components/custom/tunetap/common/header/UnifiedGameHeader.svelte';
	import PlayerSetup from '$lib/components/custom/tunetap/common/controls/PlayerSetup.svelte';
	import RoundResultModal from '$lib/components/custom/tunetap/common/dialogs/RoundResultModal.svelte';
	import GameEndScreen from '$lib/components/custom/tunetap/common/dialogs/GameEndScreen.svelte';

	// Component view maps
	const MobileView = {
		Header: UnifiedGameHeader,
		PlayerSetup: PlayerSetup,
		RoundResultModal: RoundResultModal,
		GameEndScreen: GameEndScreen
	};

	const TabletView = {
		Header: UnifiedGameHeader,
		PlayerSetup: PlayerSetup,
		RoundResultModal: RoundResultModal,
		GameEndScreen: GameEndScreen
	};

	const DesktopView = {
		Header: UnifiedGameHeader,
		PlayerSetup: PlayerSetup,
		RoundResultModal: RoundResultModal,
		GameEndScreen: GameEndScreen
	};

	// Viewport detection
	const viewportDetector = new ViewportSizeDetector();
	const viewportSize = $derived(viewportDetector.current);

	// Determine active view based on viewport
	const ActiveView = $derived(
		viewportSize === 'mobile' ? MobileView : viewportSize === 'tablet' ? TabletView : DesktopView
	);

	// Define dynamic styles for common components
	const reelStyles = $derived(() => {
		if (viewportSize === 'mobile') {
			return '--timeline-card-width: 140px; --timeline-gap-width: 100px; --timeline-card-padding: 0.75rem;';
		}
		if (viewportSize === 'tablet') {
			return '--timeline-card-width: 160px; --timeline-gap-width: 110px; --timeline-card-padding: 0.875rem;';
		}
		return '--timeline-card-width: 180px; --timeline-gap-width: 120px; --timeline-card-padding: 1rem;';
	});

	const needleStyles = $derived(() => {
		if (viewportSize === 'mobile') {
			return '--needle-height: 60px; --needle-width: 4px; --needle-indicator-height: 40px; --needle-button-top: -60px;';
		}
		if (viewportSize === 'tablet') {
			return '--needle-height: 70px; --needle-width: 4px; --needle-indicator-height: 45px; --needle-button-top: -65px;';
		}
		return '--needle-height: 80px; --needle-width: 5px; --needle-indicator-height: 50px; --needle-button-top: -70px;';
	});

	const stageStyles = $derived(() => {
		if (viewportSize === 'mobile') {
			return '--stage-gap: 1.5rem; --stage-padding: 1rem; --vinyl-size: 160px; --vinyl-border-width: 8px; --vinyl-center-size: 30px; --track-title-size: 1.5rem; --track-artist-size: 1.125rem; --track-placeholder-size: 1.25rem; --track-year-size: 1rem;';
		}
		if (viewportSize === 'tablet') {
			return '--stage-gap: 1.75rem; --stage-padding: 1.5rem; --vinyl-size: 180px; --vinyl-border-width: 8px; --vinyl-center-size: 35px; --track-title-size: 1.625rem; --track-artist-size: 1.25rem; --track-placeholder-size: 1.25rem; --track-year-size: 1rem;';
		}
		return '--stage-gap: 2rem; --stage-padding: 2rem; --vinyl-size: 200px; --vinyl-border-width: 10px; --vinyl-center-size: 40px; --track-title-size: 1.875rem; --track-artist-size: 1.375rem; --track-placeholder-size: 1.5rem; --track-year-size: 1.125rem;';
	});

	// Get tracks from navigation state
	let tracks = $state<Track[]>([]);
	let playerCount = $state(2);
	let hasInitialized = $state(false);
	let releaseDatePromises = $state<Map<number, Promise<string | undefined>>>(new Map());
	let releaseDates = $state<Map<number, string | undefined>>(new Map());
	let queueSize = $state(0);

	// Game engine
	let gameEngine = $state<TuneTapGame | null>(null);

	// UI state
	let showReleaseDates = $state(false);
	let selectedPlacementType = $state<PlacementType | null>(null);
	let selectedTrackIndex = $state<number | null>(null);
	let selectedYear = $state<number>(2000);
	let playerNames = $state<string[]>([]);
	let showSongName = $state(false);
	let showArtistName = $state(false);
	let exactYearBonusAwarded = $state<number | null>(null);

	// Audio
	let audioElement: HTMLAudioElement | null = $state(null);
	let isPlaying = $state(false);
	let isPaused = $state(true);

	// Needle Drop Layout State
	let timelineReel: HTMLDivElement | null = $state(null);
	let needleOverlayEl: HTMLDivElement | null = $state(null);
	let needleHorizontalOffset = $state(0);
	let activeGapIndex = $state<number | null>(null);
	let activeCardIndex = $state<number | null>(null);
	let showDropButton = $state(false);
	let blurred = $state(true);
	let previousActiveElement: HTMLElement | null = $state(null);

	// Timeline Navigation State
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	const queueSizeInterval = useInterval(1000, {
		callback: async () => {
			try {
				const size = await getQueueSize();
				queueSize = size;
			} catch (error) {
				console.error('[Game] Error fetching queue size:', error);
			}
		}
	});

	// Initialize tracks from sessionStorage or page state (only once)
	onMount(() => {
		if (hasInitialized) return;

		let loadedTracks: Track[] | null = null;
		let loadedPlayerCount = 2;

		// Try to load from sessionStorage first
		try {
			const tracksData = sessionStorage.getItem('tunetap_tracks');
			const playerCountData = sessionStorage.getItem('tunetap_playerCount');
			const showSongNameData = sessionStorage.getItem('tunetap_showSongName');
			const showArtistNameData = sessionStorage.getItem('tunetap_showArtistName');

			if (tracksData) {
				loadedTracks = JSON.parse(tracksData) as Track[];
				sessionStorage.removeItem('tunetap_tracks');
			}

			if (playerCountData) {
				loadedPlayerCount = parseInt(playerCountData, 10);
				sessionStorage.removeItem('tunetap_playerCount');
			}

			if (showSongNameData) {
				showSongName = showSongNameData === 'true';
				sessionStorage.removeItem('tunetap_showSongName');
			}

			if (showArtistNameData) {
				showArtistName = showArtistNameData === 'true';
				sessionStorage.removeItem('tunetap_showArtistName');
			}
		} catch (error) {
			console.error('[Game] Error loading from sessionStorage:', error);
		}

		// Fallback to page state if sessionStorage didn't work
		if (!loadedTracks) {
			const pageState = $page.state as {
				tracks?: Track[];
				tracksData?: string;
				playerCount?: number;
				showSongName?: boolean;
				showArtistName?: boolean;
			};
			if (pageState?.tracks) {
				loadedTracks = pageState.tracks;
			} else if (pageState?.tracksData) {
				try {
					loadedTracks = JSON.parse(pageState.tracksData) as Track[];
				} catch (error) {
					console.error('[Game] Error parsing tracksData:', error);
				}
			}
			if (pageState?.playerCount) {
				loadedPlayerCount = pageState.playerCount;
			}
			if (pageState?.showSongName !== undefined) {
				showSongName = pageState.showSongName;
			}
			if (pageState?.showArtistName !== undefined) {
				showArtistName = pageState.showArtistName;
			}
		}

		if (loadedTracks && loadedTracks.length > 0) {
			hasInitialized = true;
			tracks = loadedTracks;
			playerCount = loadedPlayerCount;
			playerNames = Array(playerCount)
				.fill('')
				.map((_, i) => `Player ${i + 1}`);

			// Initialize release date fetching
			const promises = new Map<number, Promise<string | undefined>>();
			const dates = new Map<number, string | undefined>();

			async function initializeTracks() {
				const tracksToCheck = loadedTracks!
					.map((track, index) => ({ index, track }))
					.filter(({ track }) => !track.firstReleaseDate && track.artists.length > 0);

				let cachedDates: Record<string, string | null> = {};

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

								if (cachedDate !== undefined && cachedDate !== null) {
									const date = cachedDate;
									dates.set(index, date);
									tracks = tracks.map((t, idx) =>
										idx === index ? { ...t, firstReleaseDate: date } : t
									);
								}
							}
							releaseDates = new Map(dates);
						});
					} catch (error) {
						console.error('[Game] Error in batch cache check:', error);
					}
				}

				loadedTracks!.forEach((track, index) => {
					if (track.firstReleaseDate) {
						dates.set(index, track.firstReleaseDate);
					}
				});

				const tracksToFetch: Array<{ index: number; track: Track }> = [];
				for (const { index, track } of tracksToCheck) {
					const key = `${track.name}|${track.artists[0]}`;
					const cachedDate = cachedDates[key];

					if (cachedDate === null || cachedDate === undefined) {
						tracksToFetch.push({ index, track });
					}
				}

				for (const { index, track } of tracksToFetch) {
					const artistName = track.artists[0];
					const promise = fetchFirstReleaseDate({ trackName: track.name, artistName }).then(
						(date) => {
							untrack(() => {
								dates.set(index, date);
								releaseDates = new Map(dates);
								if (date) {
									tracks = tracks.map((t, idx) =>
										idx === index ? { ...t, firstReleaseDate: date } : t
									);
								}
							});
							return date;
						}
					);
					promises.set(index, promise);
				}

				releaseDatePromises = new Map(promises);
				releaseDates = dates;
			}

			initializeTracks();
		}

		// Initialize scroll state
		updateScrollState();
	});

	// Keyboard navigation for timeline
	useEventListener(
		() => window,
		'keydown',
		(event: KeyboardEvent) => {
			// Only handle arrow keys when game is playing
			if (!gameEngine || gameEngine.gameStatus !== 'playing') return;

			// Don't handle if user is typing in an input
			if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
				return;
			}

			if (event.key === 'ArrowLeft' && canScrollLeft) {
				event.preventDefault();
				scrollTimelineLeft();
			} else if (event.key === 'ArrowRight' && canScrollRight) {
				event.preventDefault();
				scrollTimelineRight();
			}
		}
	);

	// Handle scroll event - updates scroll state and detects needle collision
	function handleScroll() {
		if (!timelineReel) return;
		updateScrollState();
		detectNeedleCollision();
	}

	// Update scroll state when timeline scrolls
	useEventListener(() => timelineReel, 'scroll', handleScroll);

	// Update scroll state when timeline items change
	$effect(() => {
		if (timelineItems.length > 0 && timelineReel) {
			tick().then(() => {
				updateScrollState();
				// Also detect needle collision when timeline items change
				if (gameEngine?.gameStatus === 'playing') {
					detectNeedleCollision();
				}
			});
		}
	});

	// Keep the needle centered over the actual reel viewport
	$effect(() => {
		if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
		if (!timelineReel || !needleOverlayEl) return;

		const updateNeedleOffset = () => {
			const reelRect = timelineReel?.getBoundingClientRect();
			const overlayRect = needleOverlayEl?.getBoundingClientRect();
			if (!reelRect || !overlayRect) return;
			needleHorizontalOffset =
				reelRect.left + reelRect.width / 2 - (overlayRect.left + overlayRect.width / 2);
		};

		updateNeedleOffset();
		const resizeObserver = new ResizeObserver(() => updateNeedleOffset());
		resizeObserver.observe(timelineReel);
		resizeObserver.observe(needleOverlayEl);
		window.addEventListener('resize', updateNeedleOffset);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateNeedleOffset);
		};
	});

	// Filter tracks that have release dates and audio
	const playableTracks = $derived(
		tracks.filter((t) => t.firstReleaseDate && t.audioUrl && t.status === 'found')
	);

	// Initialize game
	function initializeGame() {
		// Always create a fresh instance
		gameEngine = new TuneTapGame();
		gameEngine.initializeGame(playableTracks, playerNames);

		// Reset UI state
		selectedPlacementType = null;
		selectedTrackIndex = null;
		showReleaseDates = false;
		exactYearBonusAwarded = null;
		blurred = true;
		stopTrack();
	}

	// Play audio
	async function playTrack() {
		if (!audioElement) return;
		// Optional: Load ensures the new src is ready if you just switched tracks
		audioElement.load();
		try {
			await audioElement.play();
			isPlaying = true;
			isPaused = false;
		} catch (error) {
			console.error('[Game] Error playing audio:', error);
		}
	}

	function stopTrack() {
		if (audioElement) {
			isPaused = true;
			isPlaying = false;
		}
	}

	// Place track from gap selection
	function placeTrackFromGap(gapIndex: number) {
		if (!gameEngine) return;
		gameEngine.placeTrackFromGap(gapIndex);
		showReleaseDates = true;
		exactYearBonusAwarded = null;
	}

	// Place track in same year as card selection
	function placeTrackSameYear(cardIndex: number) {
		if (!gameEngine) return;
		gameEngine.placeTrackSameYear(cardIndex);
		showReleaseDates = true;
		exactYearBonusAwarded = null;
	}

	function nextTurn() {
		if (!gameEngine) return;
		gameEngine.nextTurn();
		blurred = true;
		stopTrack();
	}

	function endGame() {
		if (!gameEngine) return;
		gameEngine.endGame();
		showReleaseDates = true;
		stopTrack();
	}

	function restartGame() {
		goto('/playlist2');
	}

	function handleRevealClick() {
		blurred = false;
	}

	// Detect needle collision - moved from RAF loop to scroll event
	function detectNeedleCollision() {
		if (!timelineReel || !gameEngine || gameEngine.gameStatus !== 'playing') {
			showDropButton = false;
			activeGapIndex = null;
			activeCardIndex = null;
			return;
		}

		const centerX = window.innerWidth / 2;
		const children = Array.from(timelineReel.children) as HTMLElement[];
		let closestChild: HTMLElement | null = null;
		let minDistance = Infinity;
		let closestIndex = -1;

		children.forEach((child, index) => {
			const rect = child.getBoundingClientRect();
			const childCenterX = rect.left + rect.width / 2;
			const distance = Math.abs(centerX - childCenterX);

			if (distance < minDistance) {
				minDistance = distance;
				closestChild = child;
				closestIndex = index;
			}
		});

		// Optimize opacity updates: only update previous active element and new active element
		if (previousActiveElement && previousActiveElement.classList.contains('timeline-card')) {
			previousActiveElement.style.opacity = '0.5';
		}

		const closestElement: HTMLElement | null = closestChild;
		if (closestElement) {
			const element = closestElement as HTMLElement;
			if (element.classList.contains('timeline-card')) {
				element.style.opacity = '1';
				previousActiveElement = element;
			} else if (previousActiveElement) {
				previousActiveElement.style.opacity = '0.5';
				previousActiveElement = null;
			}

			// Check if closest is a gap or a card
			if (element.classList.contains('timeline-gap')) {
				const gapIndex = parseInt(element.dataset?.gapIndex || '0', 10);
				activeGapIndex = gapIndex;
				activeCardIndex = null;
				showDropButton = true;

				// Activate gap marker - only update the active one
				children.forEach((child) => {
					if (child.classList.contains('timeline-gap')) {
						child.classList.toggle('active', child === element);
					}
				});
			} else if (element.classList.contains('timeline-card')) {
				const cardIndex = parseInt(element.dataset?.index || '-1', 10);
				if (cardIndex >= 0) {
					activeCardIndex = cardIndex;
					activeGapIndex = null;
					showDropButton = true;
				} else {
					activeCardIndex = null;
					activeGapIndex = null;
					showDropButton = false;
				}

				// Deactivate all gaps
				children.forEach((child) => {
					if (child.classList.contains('timeline-gap')) {
						child.classList.remove('active');
					}
				});
			} else {
				activeGapIndex = null;
				activeCardIndex = null;
				showDropButton = false;

				// Deactivate all gaps
				children.forEach((child) => {
					if (child.classList.contains('timeline-gap')) {
						child.classList.remove('active');
					}
				});
			}
		} else {
			activeGapIndex = null;
			activeCardIndex = null;
			showDropButton = false;

			// Deactivate all gaps
			children.forEach((child) => {
				if (child.classList.contains('timeline-gap')) {
					child.classList.remove('active');
				}
			});
		}
	}

	// Timeline Navigation Functions
	function updateScrollState() {
		if (!timelineReel) {
			canScrollLeft = false;
			canScrollRight = false;
			return;
		}

		const { scrollLeft, scrollWidth, clientWidth } = timelineReel;
		canScrollLeft = scrollLeft > 0;
		canScrollRight = scrollLeft < scrollWidth - clientWidth - 1; // -1 for floating point precision
	}

	function scrollTimelineLeft() {
		if (!timelineReel) return;
		const scrollDistance = 150; // Card width (140px) + margins
		timelineReel.scrollBy({ left: -scrollDistance, behavior: 'smooth' });
	}

	function scrollTimelineRight() {
		if (!timelineReel) return;
		const scrollDistance = 150; // Card width (140px) + margins
		timelineReel.scrollBy({ left: scrollDistance, behavior: 'smooth' });
	}

	// Derived values from game engine
	const currentPlayer = $derived(gameEngine?.currentPlayer);
	const winner = $derived(gameEngine?.winner);
	const totalTurns = $derived(gameEngine?.totalTurns ?? 0);
	const tracksPlaced = $derived(gameEngine?.tracksPlaced ?? 0);
	const tracksRemaining = $derived(gameEngine?.tracksRemaining ?? 0);
	const gameStatus = $derived(gameEngine?.gameStatus ?? 'setup');
	const roundResult = $derived(gameEngine?.roundResult ?? null);
	const currentTrack = $derived(gameEngine?.currentTrack ?? null);
	const players = $derived(gameEngine?.players ?? []);
	const currentPlayerIndex = $derived(gameEngine?.currentPlayerIndex ?? 0);
	const turnNumber = $derived(gameEngine?.turnNumber ?? 1);

	// Build timeline items (cards and gaps), grouping tracks by year
	const timelineItems = $derived(
		gameEngine
			? gameEngine.buildTimelineItems(currentPlayer)
			: [{ type: 'gap' as const, gapIndex: 0 }]
	);
</script>

{#if tracks.length === 0}
	<div class="no-tracks-container">
		<Card.Root class="no-tracks">
			<Card.Content>
				<p>No tracks available. Please go back and load a playlist.</p>
				<Button variant="link" href="/playlist2">Back to Playlist Input</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else if gameStatus === 'setup'}
	<div class="setup-container">
		<ActiveView.PlayerSetup
			{playerNames}
			playableTracksCount={playableTracks.length}
			onStartGame={initializeGame}
		/>
	</div>
{:else if gameStatus === 'gameEnd'}
	<div class="game-end-container">
		<ActiveView.GameEndScreen {players} {winner} onRestart={restartGame} />
	</div>
{:else}
	<!-- Needle Drop Layout -->
	<div
		id="app-shell"
		class:mobile={viewportSize === 'mobile'}
		class:tablet={viewportSize === 'tablet'}
		class:desktop={viewportSize === 'desktop'}
	>
		<!-- Audio element -->
		<audio
			bind:this={audioElement}
			bind:paused={isPaused}
			src={currentTrack?.audioUrl}
			onended={() => {
				isPlaying = false;
				isPaused = true;
			}}
		></audio>

		<!-- Header (Z-index 4) -->
		{#if currentPlayer !== undefined}
			<div class="game-header-wrapper">
				<ActiveView.Header
					{currentPlayer}
					{players}
					{currentPlayerIndex}
					{turnNumber}
					{totalTurns}
					{currentTrack}
					{isPlaying}
					onPlay={playTrack}
					onStop={stopTrack}
				/>
			</div>
		{/if}

		<!-- Zone A: The Stage (Top 40%) -->
		<Stage
			{currentTrack}
			{isPlaying}
			{showSongName}
			{showArtistName}
			{showReleaseDates}
			{blurred}
			onRevealClick={handleRevealClick}
			style={stageStyles}
		/>

		<div class="timeline-needle-zone">
			<!-- Zone C: The Timeline Reel (Bottom Flex) -->
			<TimelineReel
				bind:timelineReel
				{timelineItems}
				{canScrollLeft}
				{canScrollRight}
				{showSongName}
				{showArtistName}
				{showReleaseDates}
				onScrollLeft={scrollTimelineLeft}
				onScrollRight={scrollTimelineRight}
				style={reelStyles}
			/>

			<div
				class="timeline-needle-overlay"
				bind:this={needleOverlayEl}
				style={`--needle-horizontal-offset: ${needleHorizontalOffset}px; ${needleStyles}`}
			>
				<!-- Zone B: The Needle (Middle Anchor) -->
				<Needle
					{showDropButton}
					{activeGapIndex}
					{activeCardIndex}
					{gameStatus}
					onPlaceFromGap={placeTrackFromGap}
					onPlaceSameYear={placeTrackSameYear}
				/>
			</div>
		</div>
	</div>

	<!-- Round result modal (Z-index 5) -->
	{#if gameStatus === 'roundEnd' && roundResult && currentPlayer}
		<ActiveView.RoundResultModal
			result={roundResult}
			{currentPlayer}
			{currentTrack}
			{exactYearBonusAwarded}
			onNextTurn={nextTurn}
		/>
	{/if}
{/if}

<style>
	:global(.no-tracks) {
		max-width: 600px;
		margin: 2rem auto;
	}

	.no-tracks-container,
	.setup-container,
	.game-end-container {
		min-height: 100vh;
		padding: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 1;
	}

	/* Override PageContainer padding for this page */
	:global(body) {
		overflow: hidden;
	}

	:global(.content-layer) {
		padding: 0 !important;
		overflow: hidden !important;
	}

	/* #app-shell: Fixed Viewport Container */
	#app-shell {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100vw;
		margin: 0 auto;
		overflow: hidden;
		background: var(--background);
		position: fixed;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
	}

	#app-shell.mobile {
		max-width: 430px;
	}

	#app-shell.tablet {
		max-width: 768px;
	}

	#app-shell.desktop {
		max-width: 1200px;
	}

	.game-header-wrapper {
		position: relative;
		z-index: 4;
		flex-shrink: 0;
		padding: 0.5rem 1rem;
		background: var(--background);
	}

	.game-header-wrapper :global(.unified-header) {
		margin-bottom: 0;
	}

	.timeline-needle-zone {
		--needle-overlay-height: 120px;
		flex: 1;
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		padding-top: var(--needle-overlay-height);
	}

	.timeline-needle-zone > :global(.zone-c-timeline-wrapper) {
		flex: 1;
	}

	.timeline-needle-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: var(--needle-overlay-height);
		pointer-events: none;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.timeline-needle-overlay :global(.zone-b-needle) {
		pointer-events: none;
	}

	.timeline-needle-overlay :global(.drop-button-wrapper) {
		pointer-events: auto;
	}

	@media (max-width: 430px) {
		#app-shell {
			max-width: 100vw;
		}
	}
</style>
