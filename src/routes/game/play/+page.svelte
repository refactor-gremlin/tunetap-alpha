<!--
@component

Game Play Page - Main gameplay screen with timeline and track placement.

This page displays:
- Current player info and turn progress
- The current track on the vinyl stage
- Scrollable timeline with placement gaps
- Needle indicator for drop position
- Round result modal after placement
- Turn handoff modal for multiplayer
-->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { useGamePageContext } from '$lib/game/GamePage.state.svelte.js';
	import { ViewportSizeDetector } from '$lib/hooks/viewport-size.svelte.js';

	// Components
	import Needle from '$lib/components/custom/tunetap/common/needle/Needle.svelte';
	import TimelineReel from '$lib/components/custom/tunetap/common/timeline/TimelineReel.svelte';
	import Stage from '$lib/components/custom/tunetap/common/stage/Stage.svelte';
	import UnifiedGameHeader from '$lib/components/custom/tunetap/common/header/UnifiedGameHeader.svelte';
	import RoundResultModal from '$lib/components/custom/tunetap/common/dialogs/RoundResultModal.svelte';
	import TurnHandoff from '$lib/components/custom/tunetap/common/dialogs/TurnHandoff.svelte';

	import { getQueueStatus, fetchFirstReleaseDate } from '../musicbrainz.remote';

	const ctx = useGamePageContext();

	// Viewport detection
	const viewportDetector = new ViewportSizeDetector();
	const viewportSize = $derived(viewportDetector.current);

	// Dynamic styles based on viewport
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

	// Queue status handler
	type QueueStatus = {
		pendingCount: number;
		estimatedTimeRemaining: number;
		timeRemainingString: string;
	};

	function handleQueueStatusUpdate(status: QueueStatus) {
		ctx.queueSize = status.pendingCount;
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
		if (payload.date) {
			const updated = ctx.applyReleaseDateById(payload.trackId, payload.date);
			if (!updated) return;
			const located = ctx.getTrackById(payload.trackId);
			if (located?.track.audioUrl && located.track.status === 'found' && ctx.gameEngine) {
				ctx.gameEngine.addPlayableTracks([located.track]);
			}
		}
	}

	// Derived values from game engine
	const gameStatus = $derived(ctx.gameEngine?.gameStatus ?? 'setup');
	const currentPlayer = $derived(ctx.gameEngine?.currentPlayer);
	const players = $derived(ctx.gameEngine?.players ?? []);
	const currentPlayerIndex = $derived(ctx.gameEngine?.currentPlayerIndex ?? 0);
	const turnNumber = $derived(ctx.gameEngine?.turnNumber ?? 1);
	const totalTurns = $derived(ctx.gameEngine?.totalTurns ?? 0);
	const currentTrack = $derived(ctx.gameEngine?.currentTrack ?? null);
	const roundResult = $derived(ctx.gameEngine?.roundResult ?? null);

	// Calculate next player for handoff - needs to be computed when showHandoff changes
	const nextPlayerIndex = $derived.by(() => {
		const engine = ctx.gameEngine;
		if (!engine || engine.players.length === 0) return 0;
		return (engine.currentPlayerIndex + 1) % engine.players.length;
	});
	const nextPlayer = $derived.by(() => {
		const engine = ctx.gameEngine;
		if (!engine || engine.players.length === 0) return undefined;
		return engine.players[nextPlayerIndex];
	});

	const timelineItems = $derived(
		ctx.gameEngine
			? ctx.gameEngine.buildTimelineItems(currentPlayer)
			: [{ type: 'gap' as const, gapIndex: 0 }]
	);

	// Debug: track showHandoff state changes
	$effect(() => {
		const showHandoff = ctx.showHandoff;
		const nextPlayerName = nextPlayer?.name ?? 'undefined';
		console.log(`[PlayPage] Handoff state: showHandoff=${showHandoff}, nextPlayer=${nextPlayerName}, gameStatus=${gameStatus}`);
	});

	// Navigate to results when game ends
	$effect(() => {
		if (gameStatus === 'gameEnd') {
			ctx.saveToSession(true);
			goto('/game/results');
		}
	});

	// Redirect to setup if game hasn't started
	$effect(() => {
		if (ctx.hasInitialized && gameStatus === 'setup') {
			goto('/game/setup');
		}
	});
</script>

<div
	id="app-shell"
	class:mobile={viewportSize === 'mobile'}
	class:tablet={viewportSize === 'tablet'}
	class:desktop={viewportSize === 'desktop'}
>
	{#if currentPlayer !== undefined}
		<div class="game-header-wrapper">
			<UnifiedGameHeader
				{currentPlayer}
				{players}
				{currentPlayerIndex}
				{turnNumber}
				{totalTurns}
				{currentTrack}
				isPlaying={ctx.isPlaying}
				onPlay={() => ctx.playTrack()}
				onStop={() => ctx.stopTrack()}
				queueStatusFetcher={getQueueStatus}
				onQueueStatusUpdate={handleQueueStatusUpdate}
			/>
		</div>
	{/if}

	<div style={stageStyles}>
		<Stage
			{currentTrack}
			isPlaying={ctx.isPlaying}
			showSongName={ctx.showSongName}
			showArtistName={ctx.showArtistName}
			showReleaseDates={ctx.showReleaseDates}
			blurred={ctx.blurred}
			onRevealClick={() => ctx.handleRevealClick()}
			onPlayClick={() => ctx.playTrack()}
			onStopClick={() => ctx.stopTrack()}
		/>
	</div>

	<div class="timeline-needle-zone">
		<div style={reelStyles}>
			<TimelineReel
				bind:timelineReel={ctx.timelineReel}
				{timelineItems}
				canScrollLeft={ctx.canScrollLeft}
				canScrollRight={ctx.canScrollRight}
				showSongName={ctx.showSongName}
				showArtistName={ctx.showArtistName}
				showReleaseDates={ctx.showReleaseDates}
				onScrollLeft={() => ctx.scrollTimelineLeft()}
				onScrollRight={() => ctx.scrollTimelineRight()}
				fetchReleaseDate={fetchFirstReleaseDate}
				onReleaseDateResolved={handleSingleReleaseResolved}
			/>
		</div>

		<div
			class="timeline-needle-overlay"
			bind:this={ctx.needleOverlayEl}
			style={`--needle-horizontal-offset: ${ctx.needleSpring.current}px; ${needleStyles}`}
		>
			<Needle
				showDropButton={ctx.showDropButton}
				activeGapIndex={ctx.activeGapIndex}
				activeCardIndex={ctx.activeCardIndex}
				{gameStatus}
				onPlaceFromGap={(gapIndex) => ctx.placeTrackFromGap(gapIndex)}
				onPlaceSameYear={(cardIndex) => ctx.placeTrackSameYear(cardIndex)}
			/>
		</div>
	</div>
</div>

{#if gameStatus === 'roundEnd' && roundResult && currentPlayer && !ctx.showHandoff}
	<RoundResultModal
		result={roundResult}
		{currentPlayer}
		{currentTrack}
		exactYearBonusAwarded={ctx.exactYearBonusAwarded}
		onNextTurn={() => ctx.nextTurn()}
	/>
{/if}

{#if ctx.showHandoff && nextPlayer}
	<TurnHandoff
		{nextPlayer}
		turnNumber={turnNumber + 1}
		onReady={() => ctx.completeNextTurn()}
	/>
{/if}

<style>
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

