<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Track } from '$lib/types';

	import { ViewportSizeDetector } from '$lib/hooks/viewport-size.svelte.js';
	import { GamePageState } from '$lib/game/GamePage.state.svelte.js';

	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';

	// Import common components
	import Needle from '$lib/components/custom/tunetap/common/needle/Needle.svelte';
	import TimelineReel from '$lib/components/custom/tunetap/common/timeline/TimelineReel.svelte';
	import Stage from '$lib/components/custom/tunetap/common/stage/Stage.svelte';
	import UnifiedGameHeader from '$lib/components/custom/tunetap/common/header/UnifiedGameHeader.svelte';
	import PlayerSetup from '$lib/components/custom/tunetap/common/controls/PlayerSetup.svelte';
	import RoundResultModal from '$lib/components/custom/tunetap/common/dialogs/RoundResultModal.svelte';
	import GameEndScreen from '$lib/components/custom/tunetap/common/dialogs/GameEndScreen.svelte';
	import PlayableRefreshStatus from '$lib/components/custom/tunetap/common/status/PlayableRefreshStatus.svelte';
	import QueueStatusWatcher from '$lib/components/custom/tunetap/common/status/QueueStatusWatcher.svelte';
	import { buildTrackArtistKey } from '$lib/utils/release-key';
	import {
		getQueueStatus,
		fetchFirstReleaseDate,
		getCachedReleaseDatesBatchQuery,
		ensureQueueBatch,
		refreshPlayableTracks
	} from './musicbrainz.remote';
	import { createBoundaryErrorHandler, formatError, rethrow } from '$lib/utils/error-boundary';

	// Component view maps
	const MobileView = {
		Header: UnifiedGameHeader,
		PlayerSetup: PlayerSetup,
		RoundResultModal: RoundResultModal,
		GameEndScreen: GameEndScreen
	};
	const TabletView = { ...MobileView };
	const DesktopView = { ...MobileView };

	// Viewport detection
	const viewportDetector = new ViewportSizeDetector();
	const viewportSize = $derived(viewportDetector.current);
	const ActiveView = $derived(
		viewportSize === 'mobile' ? MobileView : viewportSize === 'tablet' ? TabletView : DesktopView
	);

	// Define dynamic styles for common components
	const reelStyles = $derived(
		viewportSize === 'mobile'
			? '--timeline-card-width: 140px; --timeline-gap-width: 100px; --timeline-card-padding: 0.75rem;'
			: viewportSize === 'tablet'
				? '--timeline-card-width: 160px; --timeline-gap-width: 110px; --timeline-card-padding: 0.875rem;'
				: '--timeline-card-width: 180px; --timeline-gap-width: 120px; --timeline-card-padding: 1rem;'
	);
	const needleStyles = $derived(
		viewportSize === 'mobile'
			? '--needle-height: 60px; --needle-width: 4px; --needle-indicator-height: 40px; --needle-button-top: -60px;'
			: viewportSize === 'tablet'
				? '--needle-height: 70px; --needle-width: 4px; --needle-indicator-height: 45px; --needle-button-top: -65px;'
				: '--needle-height: 80px; --needle-width: 5px; --needle-indicator-height: 50px; --needle-button-top: -70px;'
	);
	const stageStyles = $derived(
		viewportSize === 'mobile'
			? '--stage-gap: 1.5rem; --stage-padding: 1rem; --vinyl-size: 160px; --vinyl-border-width: 8px; --vinyl-center-size: 30px; --track-title-size: 1.5rem; --track-artist-size: 1.125rem; --track-placeholder-size: 1.25rem; --track-year-size: 1rem;'
			: viewportSize === 'tablet'
				? '--stage-gap: 1.75rem; --stage-padding: 1.5rem; --vinyl-size: 180px; --vinyl-border-width: 8px; --vinyl-center-size: 35px; --track-title-size: 1.625rem; --track-artist-size: 1.25rem; --track-placeholder-size: 1.25rem; --track-year-size: 1rem;'
				: '--stage-gap: 2rem; --stage-padding: 2rem; --vinyl-size: 200px; --vinyl-border-width: 10px; --vinyl-center-size: 40px; --track-title-size: 1.875rem; --track-artist-size: 1.375rem; --track-placeholder-size: 1.5rem; --track-year-size: 1.125rem;'
	);

	// Create page state
	const pageState = new GamePageState();

	type QueueStatus = {
		pendingCount: number;
		estimatedTimeRemaining: number;
		timeRemainingString: string;
	};

	const pendingReleaseEntries = $derived(pageState.getTracksNeedingReleaseDates());
	const pendingRefreshPayload = $derived(
		pendingReleaseEntries
			.filter(({ track }) => track.artists.length > 0)
			.map(({ track }) => ({
				id: track.id,
				trackName: track.name,
				artistName: track.artists[0]
			}))
	);

	let cacheHydrationPromise = $state<ReturnType<typeof getCachedReleaseDatesBatchQuery> | null>(
		null
	);
	let hasHydratedCache = false;

	function applyReleaseDateAndNotify(trackId: string, date?: string) {
		if (!date) return;
		const updated = pageState.applyReleaseDateById(trackId, date);
		if (!updated) return;
		const located = pageState.getTrackById(trackId);
		if (located?.track.audioUrl && located.track.status === 'found' && pageState.gameEngine) {
			pageState.gameEngine.addPlayableTracks([located.track]);
		}
	}

	function handleSingleReleaseResolved(payload: {
		trackId: string;
		date?: string;
		error?: unknown;
	}) {
		if (payload.error) {
			console.warn('Release date fetch failed', payload.trackId, payload.error);
			return;
		}
		applyReleaseDateAndNotify(payload.trackId, payload.date);
	}

	function handleReleaseDateBatch(releaseDates: Record<string, string>) {
		const entries = Object.entries(releaseDates);
		console.log(`[Game] handleReleaseDateBatch called with ${entries.length} dates`);
		for (const [trackId, date] of entries) {
			applyReleaseDateAndNotify(trackId, date);
		}
	}

	function handleQueueStatusUpdate(status: QueueStatus) {
		pageState.queueSize = status.pendingCount;
	}

	function hydrateCache(entries = pendingReleaseEntries) {
		if (hasHydratedCache || cacheHydrationPromise) return;
		const withArtists = entries.filter(({ track }) => track.artists.length > 0);
		if (withArtists.length === 0) return;
		const keyMap = new Map<string, string>();
		const payload = withArtists.map(({ track }) => {
			const key = buildTrackArtistKey(track.name, track.artists[0]);
			keyMap.set(key, track.id);
			return { trackName: track.name, artistName: track.artists[0] };
		});
		const promise = getCachedReleaseDatesBatchQuery({ tracks: payload });
		cacheHydrationPromise = promise;
		promise
			.then((result) => {
				for (const [key, date] of Object.entries(result)) {
					if (!date) continue;
					const trackId = keyMap.get(key);
					if (trackId) {
						applyReleaseDateAndNotify(trackId, date);
					}
				}
				hasHydratedCache = true;
			})
			.catch((error) => {
				console.error('[Game] Error hydrating release cache:', error);
			})
			.finally(() => {
				cacheHydrationPromise = null;
			});
	}

	$effect(() => {
		if (!pageState.hasInitialized) return;
		const pending = pendingReleaseEntries;
		if (pending.length === 0) {
			hasHydratedCache = false;
			cacheHydrationPromise = null;
			return;
		}
		if (!hasHydratedCache && !cacheHydrationPromise) {
			hydrateCache(pending);
		}
	});

	$effect(() => {
		if (pageState.hasInitialized) return;
		pageState.init(page);
	});

	// Derived values from game engine
	const gameStatus = $derived(pageState.gameEngine?.gameStatus ?? 'setup');
	const currentPlayer = $derived(pageState.gameEngine?.currentPlayer);
	const winner = $derived(pageState.gameEngine?.winner);
	const totalTurns = $derived(pageState.gameEngine?.totalTurns ?? 0);
	const tracksPlaced = $derived(pageState.gameEngine?.tracksPlaced ?? 0);
	const tracksRemaining = $derived(pageState.gameEngine?.tracksRemaining ?? 0);
	const roundResult = $derived(pageState.gameEngine?.roundResult ?? null);
	const currentTrack = $derived(pageState.gameEngine?.currentTrack ?? null);
	const players = $derived(pageState.gameEngine?.players ?? []);
	const currentPlayerIndex = $derived(pageState.gameEngine?.currentPlayerIndex ?? 0);
	const turnNumber = $derived(pageState.gameEngine?.turnNumber ?? 1);
	const playableTracksCount = $derived(pageState.playableTracks.length);

	const timelineItems = $derived(
		pageState.gameEngine
			? pageState.gameEngine.buildTimelineItems(currentPlayer)
			: [{ type: 'gap' as const, gapIndex: 0 }]
	);
</script>

{#if pageState.tracks.length === 0}
	<div class="no-tracks-container">
		<Card.Root class="no-tracks">
			<Card.Header>
				<Card.Title>No Tracks Loaded</Card.Title>
			</Card.Header>
			<Card.Content>
				<p>Could not find any playable tracks. Please go back and load a different playlist.</p>
				<Button variant="link" href="/playlist">Back to Playlist Input</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else if gameStatus === 'setup'}
	<div class="setup-container">
		<ActiveView.PlayerSetup
			playerNames={pageState.playerNames}
			{playableTracksCount}
			totalTracksCount={pageState.tracks.length}
			defaultAllowPartialStart={pageState.allowPartialStartPreference}
			onStartGame={() => pageState.initializeGame()}
		/>
	</div>
{:else if gameStatus === 'gameEnd'}
	<div class="game-end-container">
		<ActiveView.GameEndScreen {players} {winner} onRestart={() => pageState.restartGame()} />
	</div>
{:else if gameStatus === 'waiting'}
	<div class="waiting-container">
		<Card.Root class="waiting-card">
			<Card.Header>
				<Card.Title>Waiting for more tracks…</Card.Title>
			</Card.Header>
			<Card.Content>
				<p>We're still fetching release dates to continue the game.</p>
				<p>
					Queue size: {pageState.queueSize} pending
				</p>
				<p class="waiting-hint">
					Keep the tab open; new tracks will appear automatically once ready.
				</p>
				<Button variant="outline" onclick={() => goto('/playlist')}>Load different playlist</Button>
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<div
		id="app-shell"
		class:mobile={viewportSize === 'mobile'}
		class:tablet={viewportSize === 'tablet'}
		class:desktop={viewportSize === 'desktop'}
	>
		<audio
			bind:this={pageState.audioElement}
			bind:paused={pageState.isPaused}
			src={currentTrack?.audioUrl}
			onended={() => {
				pageState.isPlaying = false;
				pageState.isPaused = true;
			}}
		></audio>

		{#if currentPlayer !== undefined}
			<div class="game-header-wrapper">
				<ActiveView.Header
					{currentPlayer}
					{players}
					{currentPlayerIndex}
					{turnNumber}
					{totalTurns}
					{currentTrack}
					isPlaying={pageState.isPlaying}
					onPlay={() => pageState.playTrack()}
					onStop={() => pageState.stopTrack()}
					queueStatusFetcher={getQueueStatus}
					onQueueStatusUpdate={handleQueueStatusUpdate}
				/>
			</div>
		{/if}

		<div style={stageStyles}>
			<Stage
				{currentTrack}
				isPlaying={pageState.isPlaying}
				showSongName={pageState.showSongName}
				showArtistName={pageState.showArtistName}
				showReleaseDates={pageState.showReleaseDates}
				blurred={pageState.blurred}
				onRevealClick={() => pageState.handleRevealClick()}
			/>
		</div>

		<div class="timeline-needle-zone">
			<div style={reelStyles}>
				<TimelineReel
					bind:timelineReel={pageState.timelineReel}
					{timelineItems}
					canScrollLeft={pageState.canScrollLeft}
					canScrollRight={pageState.canScrollRight}
					showSongName={pageState.showSongName}
					showArtistName={pageState.showArtistName}
					showReleaseDates={pageState.showReleaseDates}
					onScrollLeft={() => pageState.scrollTimelineLeft()}
					onScrollRight={() => pageState.scrollTimelineRight()}
					fetchReleaseDate={fetchFirstReleaseDate}
					onReleaseDateResolved={handleSingleReleaseResolved}
				/>
			</div>

			<div
				class="timeline-needle-overlay"
				bind:this={pageState.needleOverlayEl}
				style={`--needle-horizontal-offset: ${pageState.needleHorizontalOffset}px; ${needleStyles}`}
			>
				<Needle
					showDropButton={pageState.showDropButton}
					activeGapIndex={pageState.activeGapIndex}
					activeCardIndex={pageState.activeCardIndex}
					{gameStatus}
					onPlaceFromGap={(gapIndex) => pageState.placeTrackFromGap(gapIndex)}
					onPlaceSameYear={(cardIndex) => pageState.placeTrackSameYear(cardIndex)}
				/>
			</div>
		</div>
	</div>

	{#if gameStatus === 'roundEnd' && roundResult && currentPlayer}
		<ActiveView.RoundResultModal
			result={roundResult}
			{currentPlayer}
			{currentTrack}
			exactYearBonusAwarded={pageState.exactYearBonusAwarded}
			onNextTurn={() => pageState.nextTurn()}
		/>
	{/if}
{/if}

{#if cacheHydrationPromise}
	<svelte:boundary onerror={createBoundaryErrorHandler('GameCacheHydration')}>
		{#snippet failed(error, reset)}
			<span class="sr-only">Cache error: {formatError(error)}</span>
		{/snippet}
		{#await cacheHydrationPromise}
			<span class="sr-only">Hydrating release cache…</span>
		{:then}
			<span class="sr-only">Release cache hydrated.</span>
		{:catch error}
			{rethrow(error)}
		{/await}
	</svelte:boundary>
{/if}

<PlayableRefreshStatus
	pendingTracks={pendingRefreshPayload}
	{refreshPlayableTracks}
	{ensureQueueBatch}
	onReleaseBatch={handleReleaseDateBatch}
/>

<QueueStatusWatcher
	fetchQueueStatus={getQueueStatus}
	onUpdate={handleQueueStatusUpdate}
	active={gameStatus === 'waiting'}
/>

<style>
	:global(.no-tracks) {
		max-width: 600px;
		margin: 2rem auto;
		text-align: center;
	}

	.no-tracks-container,
	.setup-container,
	.game-end-container,
	.waiting-container {
		min-height: 100vh;
		padding: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 1;
	}

	:global(.waiting-card) {
		max-width: 520px;
		text-align: center;
	}

	.waiting-hint {
		margin: 1rem 0;
		color: var(--muted-foreground);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	:global(body) {
		overflow: hidden;
	}

	:global(.content-layer) {
		padding: 0 !important;
		overflow: hidden !important;
	}

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
