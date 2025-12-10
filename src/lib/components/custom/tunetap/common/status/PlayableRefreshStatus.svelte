<!--
@component

Background component that periodically refreshes the playable status of pending tracks.
Fetches release dates and notifies when tracks become playable.

Usage:
  ```html
  <PlayableRefreshStatus
    pendingTracks={pendingTracks}
    refreshPlayableTracks={refreshPlayableTracks}
    ensureQueueBatch={ensureQueueBatch}
    onReleaseBatch={handleReleaseBatch}
  />
  ```
-->
<script lang="ts">
	import { useInterval } from 'runed';
	import { formatError, rethrow } from '$lib/utils/error-boundary';

	type PendingTrackPayload = {
		id: string;
		trackName: string;
		artistName: string;
	};

	type RefreshResult = {
		releaseDates: Record<string, string>;
		readyTrackIds: string[];
		playableCount: number;
	};

	let {
		pendingTracks = [],
		refreshPlayableTracks = null,
		ensureQueueBatch = null,
		onReleaseBatch
	}: {
		pendingTracks?: PendingTrackPayload[];
		refreshPlayableTracks?: ((args: { tracks: PendingTrackPayload[] }) => Promise<RefreshResult>) | null;
		ensureQueueBatch?: ((args: {
			tracks: { trackName: string; artistName: string }[];
		}) => Promise<{ success: boolean }>) | null;
		onReleaseBatch?: (releaseDates: Record<string, string>) => void;
	} = $props();

	let refreshPromise = $state<Promise<RefreshResult> | null>(null);
	let ensurePromise = $state<Promise<{ success: boolean }> | null>(null);
	let ensuredTrackIds = $state<Set<string>>(new Set());
	let lastRefreshResult = $state<RefreshResult | null>(null);

	const refreshInterval = useInterval(4000, {
		immediate: true,
		callback: () => {
			if (refreshPlayableTracks && pendingTracks.length > 0) {
				const promise = refreshPlayableTracks({ tracks: pendingTracks });
				refreshPromise = promise;
				promise
					.then((result) => {
						lastRefreshResult = result;
					})
					.catch(() => {
						// Error handled by template
					});
			}
		}
	});

	// Handle refresh result via $effect (proper side effect handling)
	$effect(() => {
		if (lastRefreshResult && onReleaseBatch) {
			const count = Object.keys(lastRefreshResult.releaseDates).length;
			if (count > 0) {
				onReleaseBatch(lastRefreshResult.releaseDates);
			}
			lastRefreshResult = null;
		}
	});

	function ensureBackgroundTracks() {
		if (!ensureQueueBatch || pendingTracks.length <= 20 || ensurePromise) {
			return;
		}
		const backlog = pendingTracks
			.slice(20)
			.filter((track) => !ensuredTrackIds.has(track.id));
		if (backlog.length === 0) return;
		const ensureCall = ensureQueueBatch({
			tracks: backlog.map(({ trackName, artistName }) => ({ trackName, artistName }))
		});
		const ensureChain = ensureCall
			.then((result) => {
				if (result.success) {
					const updatedSet = new Set(ensuredTrackIds);
					backlog.forEach((track) => updatedSet.add(track.id));
					ensuredTrackIds = updatedSet;
				}
				return result;
			})
			.finally(() => {
				if (ensurePromise === ensureChain) {
					ensurePromise = null;
				}
			});
		ensurePromise = ensureChain;
	}

	// Pause/resume interval based on pending tracks
	$effect(() => {
		if (pendingTracks.length === 0 || !refreshPlayableTracks) {
			refreshInterval.pause();
		} else {
			refreshInterval.resume();
		}
	});

	// Clean up ensuredTrackIds when pendingTracks changes
	$effect(() => {
		const pendingIds = new Set(pendingTracks.map((track) => track.id));
		const filtered = new Set(
			Array.from(ensuredTrackIds).filter((trackId) => pendingIds.has(trackId))
		);
		if (filtered.size !== ensuredTrackIds.size) {
			ensuredTrackIds = filtered;
		}
	});

	$effect(() => {
		ensureBackgroundTracks();
	});
</script>

{#if refreshPromise}
	<svelte:boundary>
		{#snippet failed(error, reset)}
			<span class="sr-only">Refresh error: {formatError(error)}</span>
		{/snippet}
		{#await refreshPromise then}
			<span class="sr-only">Refresh complete.</span>
		{:catch error}
			{rethrow(error)}
		{/await}
	</svelte:boundary>
{/if}

{#if ensurePromise}
	<svelte:boundary>
		{#snippet failed(error, reset)}
			<span class="sr-only">Queue ensure error: {formatError(error)}</span>
		{/snippet}
		{#await ensurePromise then}
			<span class="sr-only">Background queue updated.</span>
		{:catch error}
			{rethrow(error)}
		{/await}
	</svelte:boundary>
{/if}

<style>
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
</style>
