<script lang="ts">
	import { useInterval } from 'runed';

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
	let refreshInFlight = $state(false);

	const refreshInterval = useInterval(4000, {
		immediate: false,
		callback: () => runRefresh()
	});

	function runRefresh() {
		if (!refreshPlayableTracks || pendingTracks.length === 0) {
			refreshPromise = null;
			refreshInFlight = false;
			return;
		}
		if (refreshInFlight) {
			return;
		}
		refreshInFlight = true;
		const pendingRefresh = refreshPlayableTracks({ tracks: pendingTracks });
		refreshPromise = pendingRefresh;
		pendingRefresh.finally(() => {
			refreshInFlight = false;
		});
	}

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

	$effect(() => {
		if (!refreshPlayableTracks || pendingTracks.length === 0) {
			refreshInterval.pause();
			refreshPromise = null;
			return;
		}
		runRefresh();
		refreshInterval.resume();
	});

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

{#if ensurePromise}
	<svelte:boundary>
		{#await ensurePromise}
			<span class="sr-only">Queueing additional tracks…</span>
		{:then}
			<span class="sr-only">Background queue updated.</span>
		{:catch error}
			<span class="sr-only">Queue ensure error: {error.message}</span>
		{/await}
	</svelte:boundary>
{/if}

{#if refreshPromise}
	<svelte:boundary>
		{#await refreshPromise}
			<span class="sr-only">Refreshing playable tracks…</span>
		{:then result}
			{@const _apply = (onReleaseBatch?.(result.releaseDates), null)}
		{:catch error}
			<span class="sr-only">Refresh failed: {error.message}</span>
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
