<script lang="ts">
	import type { Track } from '$lib/types';

	type FetchReleaseDateFn = ((args: {
		trackName: string;
		artistName: string;
		priority?: 'high' | 'low';
	}) => Promise<string | undefined>) | null;

	type ReleaseResolutionPayload = { trackId: string; date?: string; error?: unknown };

	let {
		track,
		fetchReleaseDate = null,
		onResolved
	}: {
		track: Track;
	fetchReleaseDate?: FetchReleaseDateFn;
	onResolved?: (payload: ReleaseResolutionPayload) => void;
	} = $props();

	let request = $state<Promise<string | undefined> | null>(null);
	let hasRequested = $state(false);
	let lastTrackId = $state<string | null>(null);
	let resolvedPayload = $state<ReleaseResolutionPayload | null>(null);
	let lastNotifiedTrackId = $state<string | null>(null);

	const formatError = (error: unknown) => {
		if (error && typeof error === 'object' && 'message' in error) {
			const message = (error as { message?: unknown }).message;
			if (typeof message === 'string') return message;
			if (message != null) return String(message);
		}
		if (typeof error === 'string') return error;
		if (error == null) return 'Unknown error';
		return String(error);
	};

	$effect(() => {
		const currentTrackId = track?.id ?? null;
		if (currentTrackId !== lastTrackId) {
			lastTrackId = currentTrackId;
			hasRequested = false;
			request = null;
			resolvedPayload = null;
		}

		if (
			!fetchReleaseDate ||
			hasRequested ||
			!track?.name ||
			!track?.artists?.length ||
			track.firstReleaseDate
		) {
			return;
		}

		hasRequested = true;
		let cancelled = false;
		const artistName = track.artists[0];
		const pendingRequest = fetchReleaseDate({
			trackName: track.name,
			artistName,
			priority: 'high'
		});

		request = pendingRequest;

		pendingRequest
			.then((date) => {
				if (!cancelled && currentTrackId) {
					resolvedPayload = { trackId: currentTrackId, date };
				}
			})
			.catch((error) => {
				if (!cancelled && currentTrackId) {
					resolvedPayload = { trackId: currentTrackId, error };
					throw error;
				}
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!resolvedPayload) return;
		if (resolvedPayload.trackId === lastNotifiedTrackId) return;
		lastNotifiedTrackId = resolvedPayload.trackId;
		onResolved?.(resolvedPayload);
	});
</script>

{#if request}
	<svelte:boundary>
		{#await request}
			<span class="sr-only">Looking up release date…</span>
		{:then date}
		<span class="sr-only">
			{#if date}
				Release date found.
			{:else}
				Release date lookup completed with no date found.
			{/if}
		</span>
		{:catch error}
			<span class="sr-only">Release lookup failed: {formatError(error)}</span>
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
