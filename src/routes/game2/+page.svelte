<script lang="ts">
	import type { Track } from '$lib/types';
	import type { Player, PlacementResult, GameStatus, PlacementType } from '$lib/types/tunetap.js';
	import { page } from '$app/stores';
	import { fetchFirstReleaseDate, getQueueSize, getCachedReleaseDatesBatchQuery } from './musicbrainz.remote';
	import { untrack, onMount } from 'svelte';
	import { useInterval } from 'runed';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import PageHeader from '$lib/components/custom/PageHeader.svelte';
	import { goto } from '$app/navigation';
	import { getReleaseYear } from '$lib/utils/timeline.js';
	import { Switch } from '$lib/components/shadncn-ui/switch/index.js';
	import * as Tabs from '$lib/components/shadncn-ui/tabs/index.js';

	// Import components
	import UnifiedGameHeader from '$lib/components/custom/tunetap/UnifiedGameHeader.svelte';
	import CurrentTrackCard from '$lib/components/custom/tunetap/CurrentTrackCard.svelte';
	import AllPlayersTimelines from '$lib/components/custom/tunetap/AllPlayersTimelines.svelte';
	import PlacementControls from '$lib/components/custom/tunetap/PlacementControls.svelte';
	import PlacementDialog from '$lib/components/custom/tunetap/PlacementDialog.svelte';
	import RoundResultModal from '$lib/components/custom/tunetap/RoundResultModal.svelte';
	import GameEndScreen from '$lib/components/custom/tunetap/GameEndScreen.svelte';
	import PlayerSetup from '$lib/components/custom/tunetap/PlayerSetup.svelte';

	// Get tracks from navigation state
	let tracks = $state<Track[]>([]);
	let playerCount = $state(2);
	let hasInitialized = $state(false);
	let releaseDatePromises = $state<Map<number, Promise<string | undefined>>>(new Map());
	let releaseDates = $state<Map<number, string | undefined>>(new Map());
	let queueSize = $state(0);

	// Game state
	let players = $state<Player[]>([]);
	let currentPlayerIndex = $state(0);
	let currentTrack = $state<Track | null>(null);
	let availableTracks = $state<Track[]>([]);
	let gameStatus = $state<GameStatus>('setup');
	let roundResult = $state<PlacementResult | null>(null);
	let showReleaseDates = $state(false);
	let selectedPlacementType = $state<PlacementType | null>(null);
	let selectedTrackIndex = $state<number | null>(null);
	let selectedYear = $state<number>(2000);
	let playerNames = $state<string[]>([]);
	let turnNumber = $state(1);
	let showPlacementDialog = $state(false);
	let selectedReferenceTrackIndex = $state<number | null>(null);
	let dialogPlacementType = $state<PlacementType | null>(null);
	let showSongName = $state(false);
	let showArtistName = $state(false);
	let activeView = $state<'track' | 'timeline'>('track');
	let exactYearGuessEnabled = $state(false);
	let exactYearBonusAwarded = $state<number | null>(null);

	// Audio
	let audioElement: HTMLAudioElement | null = $state(null);
	let isPlaying = $state(false);

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
				// Clear sessionStorage after reading
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
			playerNames = Array(playerCount).fill('').map((_, i) => `Player ${i + 1}`);

				// Initialize release date fetching (same logic as game route)
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
						const promise = fetchFirstReleaseDate({ trackName: track.name, artistName }).then((date) => {
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
						});
						promises.set(index, promise);
					}

					releaseDatePromises = new Map(promises);
					releaseDates = dates;
				}

				initializeTracks();
			}
	});

	// Filter tracks that have release dates and audio
	const playableTracks = $derived(
		tracks.filter((t) => t.firstReleaseDate && t.audioUrl && t.status === 'found')
	);

	// Helper function to place a track for a specific player (for auto-placement)
	function placeTrackForPlayer(playerIndex: number, track: Track, placementType: PlacementType = 'before', referenceIndex: number | null = null, year?: number) {
		const player = players[playerIndex];
		const result = validatePlacement(playerIndex, track, placementType, referenceIndex, year);
		
		// Insert track at correct position
		const insertIndex = result.correctPosition >= 0 ? result.correctPosition : player.timeline.length;
		player.timeline.splice(insertIndex, 0, track);
		
		// Update score (always use timeline placement mode for auto-placement)
		if (result.correct) {
			player.score += 1;
		} else {
			player.score = 0;
		}
		
		return result;
	}

	// Initialize game
	function initializeGame() {
		// Filter and shuffle tracks
		const shuffled = [...playableTracks].sort(() => Math.random() - 0.5);
		availableTracks = shuffled;

		// Initialize players
		players = playerNames.map((name) => ({
			name,
			score: 0,
			timeline: []
		}));

		// Automatically place first track for all players
		for (let i = 0; i < players.length; i++) {
			if (availableTracks.length === 0) break;
			
			const track = availableTracks[0];
			placeTrackForPlayer(i, track, 'before', null);
			availableTracks = availableTracks.slice(1);
		}

		gameStatus = 'playing';
		currentPlayerIndex = 0;
		turnNumber = 1;
		selectRandomTrack();
	}

	// Select random track for current turn
	function selectRandomTrack() {
		if (availableTracks.length === 0) {
			// No more tracks, end game
			endGame();
			return;
		}

		const randomIndex = Math.floor(Math.random() * availableTracks.length);
		currentTrack = availableTracks[randomIndex];
		selectedPlacementType = null;
		selectedTrackIndex = null;
		roundResult = null;
		showReleaseDates = false;
		exactYearBonusAwarded = null;
		stopTrack();
		activeView = 'track';
	}

	// Play audio
	function playTrack() {
		if (!currentTrack?.audioUrl) return;

		if (audioElement) {
			audioElement.pause();
		}

		audioElement = new Audio(currentTrack.audioUrl);
		audioElement.play().then(() => {
			isPlaying = true;
		}).catch((error) => {
			console.error('[Game] Error playing audio:', error);
		});

		audioElement.addEventListener('ended', () => {
			isPlaying = false;
		});
	}

	function stopTrack() {
		if (audioElement) {
			audioElement.pause();
			audioElement = null;
			isPlaying = false;
		}
	}

	// Validate placement
	function validatePlacement(playerIndex: number, track: Track, placementType: PlacementType, referenceIndex: number | null, year?: number): PlacementResult {
		const player = players[playerIndex];
		const trackYear = getReleaseYear(track);
		if (!trackYear) {
			return { correct: false, correctPosition: -1 };
		}

		// Create timeline with new track inserted
		const newTimeline = [...player.timeline];
		let insertIndex = 0;

		if (placementType === 'before') {
			if (referenceIndex !== null) {
				insertIndex = referenceIndex;
			} else {
				// Before timeline start - find correct position
				insertIndex = newTimeline.findIndex((t) => {
					const tYear = getReleaseYear(t);
					return tYear !== null && tYear >= trackYear;
				});
				if (insertIndex === -1) insertIndex = newTimeline.length;
			}
		} else if (placementType === 'after') {
			if (referenceIndex !== null) {
				insertIndex = referenceIndex + 1;
			} else {
				// After timeline end - find correct position
				insertIndex = newTimeline.findIndex((t) => {
					const tYear = getReleaseYear(t);
					return tYear !== null && tYear > trackYear;
				});
				if (insertIndex === -1) insertIndex = newTimeline.length;
			}
		} else if (placementType === 'same' && year !== undefined) {
			// Find position where year matches
			insertIndex = newTimeline.findIndex((t) => {
				const tYear = getReleaseYear(t);
				return tYear !== null && tYear > year;
			});
			if (insertIndex === -1) insertIndex = newTimeline.length;
		} else {
			// First track - find correct position
			insertIndex = newTimeline.findIndex((t) => {
				const tYear = getReleaseYear(t);
				return tYear !== null && tYear >= trackYear;
			});
			if (insertIndex === -1) insertIndex = newTimeline.length;
		}

		newTimeline.splice(insertIndex, 0, track);

		// Check if timeline is in correct order
		let correct = true;
		for (let i = 0; i < newTimeline.length - 1; i++) {
			const year1 = getReleaseYear(newTimeline[i]);
			const year2 = getReleaseYear(newTimeline[i + 1]);
			if (year1 === null || year2 === null || year1 > year2) {
				correct = false;
				break;
			}
		}

		return { correct, correctPosition: insertIndex };
	}

	// Place track
	function placeTrack() {
		if (!currentTrack || selectedPlacementType === null) return;

		const player = players[currentPlayerIndex];
		let referenceIndex: number | null = null;

		if (selectedPlacementType === 'before' || selectedPlacementType === 'after') {
			// If no track selected, it means before/after timeline start/end
			if (selectedTrackIndex !== null) {
				referenceIndex = selectedTrackIndex;
			}
		}

		const result = validatePlacement(
			currentPlayerIndex,
			currentTrack,
			selectedPlacementType,
			referenceIndex,
			selectedPlacementType === 'same' ? selectedYear : undefined
		);

		// Insert track at correct position
		const insertIndex = result.correctPosition >= 0 ? result.correctPosition : player.timeline.length;
		player.timeline.splice(insertIndex, 0, currentTrack);

		// Update score based on guess mode
		const trackYear = getReleaseYear(currentTrack);
		let bonusAwarded: number | null = null;
		const isExactYearGuess = exactYearGuessEnabled && selectedPlacementType === 'same';

		if (isExactYearGuess && trackYear !== null) {
			// Exact year guess mode: 2 points if correct year, 0 points if wrong
			if (selectedYear === trackYear) {
				player.score += 2;
				bonusAwarded = 2;
			} else {
				player.score = 0;
				bonusAwarded = 0;
			}
		} else {
			// Timeline placement mode: 1 point if correct order, 0 points if wrong
			if (result.correct) {
				player.score += 1;
			} else {
				player.score = 0;
			}
		}

		// Remove track from available tracks
		availableTracks = availableTracks.filter((t) => t !== currentTrack);

		roundResult = result;
		exactYearBonusAwarded = isExactYearGuess ? bonusAwarded : null;
		showReleaseDates = true;
		gameStatus = 'roundEnd';
		activeView = 'track';

		// Check win condition
		if (player.score >= 10) {
			setTimeout(() => {
				endGame();
			}, 2000);
		}
	}

	function nextTurn() {
		if (gameStatus === 'roundEnd') {
			currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
			turnNumber++;
			selectRandomTrack();
			gameStatus = 'playing';
		}
	}

	function endGame() {
		gameStatus = 'gameEnd';
		showReleaseDates = true;
		stopTrack();
	}

	function restartGame() {
		goto('/playlist2');
	}

	function handleTrackClick(index: number) {
		if (!currentTrack || showReleaseDates) return;
		selectedReferenceTrackIndex = index;
		dialogPlacementType = null;
		showPlacementDialog = true;
	}

	function confirmPlacement(placementType: PlacementType) {
		if (!currentTrack || selectedReferenceTrackIndex === null) return;
		
		selectedPlacementType = placementType;
		selectedTrackIndex = selectedReferenceTrackIndex;
		showPlacementDialog = false;
		placeTrack();
		
		// Reset selection state
		selectedReferenceTrackIndex = null;
		dialogPlacementType = null;
	}

	function cancelPlacement() {
		showPlacementDialog = false;
		selectedReferenceTrackIndex = null;
		dialogPlacementType = null;
	}

	function handlePlaceFirstTrack() {
		// Place first track without confirmation (no reference track)
		selectedPlacementType = 'before';
		selectedTrackIndex = null;
		placeTrack();
	}

	function handleSelectYear(year: number) {
		selectedYear = year;
	}

	function handlePlaceSameYearFromControls() {
		if (!currentTrack) return;
		selectedPlacementType = 'same';
		selectedTrackIndex = null;
		placeTrack();
	}

	function handlePlaceSameYear(index: number) {
		if (!currentPlayer || index >= currentPlayer.timeline.length) return;
		const referenceTrack = currentPlayer.timeline[index];
		const referenceYear = getReleaseYear(referenceTrack);
		if (referenceYear === null) return;
		
		selectedYear = referenceYear;
		selectedPlacementType = 'same';
		selectedTrackIndex = index;
		placeTrack();
	}

	const currentPlayer = $derived(players[currentPlayerIndex]);
	const winner = $derived(players.find((p) => p.score >= 10));
	const totalTurns = $derived(Math.ceil((availableTracks.length + (players.reduce((sum, p) => sum + p.timeline.length, 0))) / players.length));
	const tracksPlaced = $derived(players.reduce((sum, p) => sum + p.timeline.length, 0));
	const tracksRemaining = $derived(availableTracks.length);
	
	const referenceTrack = $derived(
		currentPlayer && selectedReferenceTrackIndex !== null && selectedReferenceTrackIndex < currentPlayer.timeline.length
			? currentPlayer.timeline[selectedReferenceTrackIndex]
			: null
	);

	// First round is now automatically applied for all players in initializeGame()
	// No need for auto-placement effect anymore
</script>

<PageHeader title="TuneTap Game" />

{#if tracks.length === 0}
	<Card.Root class="no-tracks">
		<Card.Content>
			<p>No tracks available. Please go back and load a playlist.</p>
			<Button variant="link" href="/playlist2">Back to Playlist Input</Button>
		</Card.Content>
	</Card.Root>
{:else if gameStatus === 'setup'}
	<PlayerSetup
		{playerNames}
		playableTracksCount={playableTracks.length}
		onStartGame={initializeGame}
	/>
{:else if gameStatus === 'gameEnd'}
	<GameEndScreen {players} {winner} onRestart={restartGame} />

	<!-- Show all timelines with release dates -->
	<div class="all-timelines-end">
		<AllPlayersTimelines
			{players}
			currentPlayerIndex={0}
			showReleaseDates={true}
		/>
	</div>
{:else}
	<!-- Game playing state -->
	<div class="game-shell">
		<div class="game-header-stack">
			{#if currentPlayer !== undefined}
				<UnifiedGameHeader
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
			{/if}

			<div class="status-strip">
				<div class="status-chip">
					<span>Tracks Left</span>
					<strong>{tracksRemaining}</strong>
				</div>
				<div class="status-chip">
					<span>Placed</span>
					<strong>{tracksPlaced}</strong>
				</div>
				<div class="status-chip">
					<span>Queue</span>
					<strong>{queueSize}</strong>
				</div>
				<div class="status-chip toggles">
					<label>
						<span>Song</span>
						<Switch aria-label="Toggle song name visibility" bind:checked={showSongName} />
					</label>
					<label>
						<span>Artist</span>
						<Switch aria-label="Toggle artist visibility" bind:checked={showArtistName} />
					</label>
				</div>
			</div>
		</div>

			<Tabs.Root bind:value={activeView} class="game-tabs">
				<Tabs.List class="game-tabs-list">
					<Tabs.Trigger value="track">Track</Tabs.Trigger>
					<Tabs.Trigger value="timeline" disabled={currentPlayer === undefined}>
						Timeline
					</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="track" class="game-tab-panel">
					<Card.Root class="stage-card">
						<Card.Header class="stage-card-header">
							<div>
								<Card.Title>Current Challenge</Card.Title>
								<Card.Description>
									Keep your streak alive with precise placements.
								</Card.Description>
							</div>
							<div class="stage-meta">
								<div>
									<span class="pill-label">Current Player</span>
									<strong>{currentPlayer?.name ?? '—'}</strong>
								</div>
								<div>
									<span class="pill-label">Turn</span>
									<strong>{turnNumber}/{totalTurns}</strong>
								</div>
							</div>
						</Card.Header>
				<Card.Content class="stage-card-content">
					<CurrentTrackCard
						track={currentTrack}
						{showSongName}
						{showArtistName}
						revealed={showReleaseDates}
					/>

							{#if gameStatus === 'playing' && currentTrack && currentPlayer}
								<div class="stage-divider"></div>
								<PlacementControls
									{currentTrack}
									{currentPlayer}
									{selectedYear}
									onSelectYear={handleSelectYear}
									bind:exactYearGuessEnabled
									onPlaceSameYear={handlePlaceSameYearFromControls}
								/>
							{:else}
								<p class="stage-hint">
									Finish the current round to continue placing tracks.
								</p>
							{/if}
						</Card.Content>
					</Card.Root>
				</Tabs.Content>

				<Tabs.Content value="timeline" class="game-tab-panel timeline-panel">
					{#if currentPlayer !== undefined}
						<AllPlayersTimelines
							{players}
							{currentPlayerIndex}
							{showReleaseDates}
							selectedTrackIndex={selectedReferenceTrackIndex}
							{showSongName}
							{showArtistName}
							onTrackClick={handleTrackClick}
							onPlaceFirstTrack={handlePlaceFirstTrack}
						/>
					{:else}
						<p class="timeline-placeholder">Timeline will appear once the game starts.</p>
					{/if}
				</Tabs.Content>
			</Tabs.Root>

		<!-- Placement dialog -->
		{#if currentTrack && referenceTrack}
			<PlacementDialog
				bind:open={showPlacementDialog}
				{currentTrack}
				referenceTrack={referenceTrack}
				bind:selectedPlacementType={dialogPlacementType}
				onConfirm={confirmPlacement}
				onCancel={cancelPlacement}
			/>
		{/if}

		<!-- Round result modal -->
		{#if gameStatus === 'roundEnd' && roundResult && currentPlayer}
			<RoundResultModal
				result={roundResult}
				currentPlayer={currentPlayer}
				{currentTrack}
				exactYearBonusAwarded={exactYearBonusAwarded}
				onNextTurn={nextTurn}
			/>
		{/if}
	</div>
{/if}

<style>
	:global(.no-tracks) {
		max-width: 600px;
		margin: 2rem auto;
	}

	.all-timelines-end {
		margin-top: 2rem;
	}

	.game-shell {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		margin-top: 1.5rem;
	}

	.game-header-stack {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.status-strip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem 0;
	}

	.status-chip {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0.5rem 0.75rem;
		border-radius: calc(var(--radius) - 4px);
		border: 1px solid var(--border);
		background-color: color-mix(in oklch, var(--muted) 18%, transparent);
		font-size: 0.85rem;
	}

	.status-chip strong {
		font-size: 1.25rem;
		font-weight: 600;
	}

	.status-chip.toggles {
		flex-direction: row;
		gap: 1rem;
		align-items: center;
	}

	.status-chip.toggles label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
	}

	.pill-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted-foreground);
	}

	:global(.stage-card) {
		height: fit-content;
	}

	:global(.stage-card-header) {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
	}

	.stage-meta {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
	}

	.stage-meta div {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stage-meta strong {
		font-size: 1.25rem;
	}

	:global(.stage-card-content) {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.stage-divider {
		width: 100%;
		height: 1px;
		background-color: var(--border);
	}

	.stage-hint {
		margin: 0;
		color: var(--muted-foreground);
		font-size: 0.9rem;
		text-align: center;
	}

	:global(.game-tabs) {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	:global(.game-tabs-list) {
		width: 100%;
	}

	:global(.game-tab-panel) {
		width: 100%;
	}

	:global(.timeline-panel) {
		padding: 1rem 1.25rem;
		border-radius: calc(var(--radius) - 2px);
		border: 1px solid var(--border);
		background-color: color-mix(in oklch, var(--muted) 18%, transparent);
	}

	:global(.timeline-placeholder) {
		margin: 0;
		color: var(--muted-foreground);
		text-align: center;
		padding: 2rem 0;
	}

	@media (max-width: 768px) {
		.stage-meta {
			width: 100%;
			justify-content: space-between;
		}

		.status-chip {
			flex: 1 1 calc(50% - 0.5rem);
		}

		.status-chip.toggles {
			flex-direction: column;
			align-items: flex-start;
		}

		.status-chip.toggles label {
			width: 100%;
			justify-content: space-between;
		}
	}
</style>
