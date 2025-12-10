<!--
@component

Game Layout - Provides shared state and infrastructure for all game routes.

This layout:
- Initializes and provides GamePageState via context
- Loads/deserializes session state from sessionStorage
- Renders a global waiting overlay when fetching release dates
- Includes shared audio element and background status watchers
- Handles cache hydration for release dates
-->

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { createGamePageContext } from '$lib/game/GamePage.state.svelte.js';
	import {
		loadSession,
		migrateLegacySession,
		hasLegacySession
	} from '$lib/game/GameSession.store';

	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import PlayableRefreshStatus from '$lib/components/custom/tunetap/common/status/PlayableRefreshStatus.svelte';
	import QueueStatusWatcher from '$lib/components/custom/tunetap/common/status/QueueStatusWatcher.svelte';
	import { buildTrackArtistKey } from '$lib/utils/release-key';
	import {
		getQueueStatus,
		getCachedReleaseDatesBatchQuery,
		ensureQueueBatch,
		refreshPlayableTracks
	} from './musicbrainz.remote';
	import { createBoundaryErrorHandler, formatError, rethrow } from '$lib/utils/error-boundary';

	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';

	interface Props {
		data: LayoutData;
		children: Snippet;
	}

	let { data, children }: Props = $props();

	// Create and provide game page context
	const ctx = createGamePageContext();

	// Load session from sessionStorage or migrate legacy session
	$effect(() => {
		if (ctx.hasInitialized) return;

		// Try loading existing session
		const session = loadSession();
		if (session) {
			ctx.deserialize(session);
			ctx.enableSessionPersistence();
			return;
		}

		// Try migrating legacy session (from old format)
		if (hasLegacySession()) {
			const legacyData = migrateLegacySession();
			if (legacyData && legacyData.tracks && legacyData.tracks.length > 0) {
				ctx.hydrateData({
					tracks: legacyData.tracks,
					playerCount: legacyData.playerCount ?? 2,
					showSongName: legacyData.showSongName,
					showArtistName: legacyData.showArtistName,
					allowPartialStart: legacyData.allowPartialStart
				});
				ctx.enableSessionPersistence();
			}
		}
	});

	// Redirect to appropriate route based on game status
	$effect(() => {
		if (!ctx.hasInitialized) return;

		const gameStatus = ctx.gameEngine?.gameStatus ?? 'setup';
		const currentPath = page.url.pathname;

		// Route based on game status
		if (gameStatus === 'setup' && currentPath !== '/game/setup') {
			goto('/game/setup');
		} else if (gameStatus === 'gameEnd' && currentPath !== '/game/results') {
			goto('/game/results');
		} else if (
			(gameStatus === 'playing' || gameStatus === 'roundEnd') &&
			currentPath !== '/game/play'
		) {
			goto('/game/play');
		}
	});

	// Queue status type
	type QueueStatus = {
		pendingCount: number;
		estimatedTimeRemaining: number;
		timeRemainingString: string;
	};

	// Release date handling
	const pendingReleaseEntries = $derived(ctx.getTracksNeedingReleaseDates());
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
		const updated = ctx.applyReleaseDateById(trackId, date);
		if (!updated) return;
		const located = ctx.getTrackById(trackId);
		if (located?.track.audioUrl && located.track.status === 'found' && ctx.gameEngine) {
			ctx.gameEngine.addPlayableTracks([located.track]);
		}
	}

	function handleReleaseDateBatch(releaseDates: Record<string, string>) {
		const entries = Object.entries(releaseDates);
		for (const [trackId, date] of entries) {
			applyReleaseDateAndNotify(trackId, date);
		}
	}

	function handleQueueStatusUpdate(status: QueueStatus) {
		ctx.queueSize = status.pendingCount;
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
				console.error('[GameLayout] Error hydrating release cache:', error);
			})
			.finally(() => {
				cacheHydrationPromise = null;
			});
	}

	$effect(() => {
		if (!ctx.hasInitialized) return;
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

	// Derived state for waiting overlay
	const gameStatus = $derived(ctx.gameEngine?.gameStatus ?? 'setup');
	const showWaitingOverlay = $derived(gameStatus === 'waiting');
	const currentTrack = $derived(ctx.gameEngine?.currentTrack ?? null);
</script>

<!-- Shared audio element -->
<audio
	bind:this={ctx.audioElement}
	bind:paused={ctx.isPaused}
	src={currentTrack?.audioUrl}
	onended={() => {
		ctx.isPlaying = false;
		ctx.isPaused = true;
	}}
></audio>

<!-- Waiting overlay (appears on top of any route when waiting for tracks) -->
{#if showWaitingOverlay}
	<div class="waiting-overlay">
		<div class="waiting-content">
			<div class="loading-vinyl-animation">
				<div class="vinyl-disc">
					<div class="vinyl-grooves"></div>
					<div class="vinyl-label">🎵</div>
				</div>
			</div>
			<h2 class="waiting-title">Loading more tracks...</h2>
			<p class="waiting-subtitle">Fetching release dates from MusicBrainz</p>
			<div class="queue-progress">
				<div class="queue-count">{ctx.queueSize}</div>
				<div class="queue-label">tracks in queue</div>
			</div>
			<p class="waiting-hint">Keep this tab open — new tracks will appear automatically!</p>
			<Button variant="outline" onclick={() => goto('/playlist')}>Try a different playlist</Button>
		</div>
	</div>
{/if}

<!-- Route content -->
{@render children()}

<!-- Cache hydration (invisible, for async loading) -->
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

<!-- Background status watchers -->
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
	.waiting-overlay {
		position: fixed;
		inset: 0;
		z-index: 9999;
		background: var(--background);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.waiting-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 1.5rem;
		max-width: 400px;
	}

	.loading-vinyl-animation {
		width: 120px;
		height: 120px;
	}

	.vinyl-disc {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%);
		border: 8px solid #2a2a2a;
		position: relative;
		animation: spin-vinyl 3s linear infinite;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.vinyl-grooves {
		position: absolute;
		inset: 10px;
		border-radius: 50%;
		background: repeating-radial-gradient(
			circle at center,
			transparent 0px,
			transparent 2px,
			rgba(255, 255, 255, 0.05) 2px,
			rgba(255, 255, 255, 0.05) 4px
		);
	}

	.vinyl-label {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--primary);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		z-index: 1;
	}

	@keyframes spin-vinyl {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.waiting-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--foreground);
		margin: 0;
	}

	.waiting-subtitle {
		font-size: 1rem;
		color: var(--muted-foreground);
		margin: 0;
	}

	.queue-progress {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 2rem;
		background: var(--muted);
		border-radius: var(--radius);
	}

	.queue-count {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--primary);
		line-height: 1;
	}

	.queue-label {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	.waiting-hint {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin: 0;
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
</style>

