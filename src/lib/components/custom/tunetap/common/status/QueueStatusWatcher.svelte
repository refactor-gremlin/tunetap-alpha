<script lang="ts">
	import { useInterval } from 'runed';

	type QueueStatus = {
		pendingCount: number;
		estimatedTimeRemaining: number;
		timeRemainingString: string;
	};

	let {
		fetchQueueStatus = null,
		onUpdate,
		active = true
	}: {
		fetchQueueStatus?: (() => Promise<QueueStatus>) | null;
		onUpdate?: (status: QueueStatus) => void;
		active?: boolean;
	} = $props();

	let request = $state<Promise<QueueStatus> | null>(null);
	let latestStatus = $state<QueueStatus | null>(null);
	let requestId = 0;

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

	const triggerFetch = () => {
		if (!fetchQueueStatus || !active) {
			request = null;
			return;
		}
		const currentRequestId = ++requestId;
		const fetchPromise = fetchQueueStatus();
		request = fetchPromise.then((status) => {
			if (currentRequestId === requestId) {
				latestStatus = status;
			}
			return status;
		});
	};

	const interval = useInterval(1500, {
		immediate: false,
		callback: () => triggerFetch()
	});

	$effect(() => {
		if (!fetchQueueStatus || !active) {
			interval.pause();
			request = null;
			return;
		}
		triggerFetch();
		interval.resume();
	});

	$effect(() => {
		if (!latestStatus || !active) return;
		onUpdate?.(latestStatus);
	});
</script>

{#if request}
	<svelte:boundary>
		{#await request}
			<span class="sr-only">Checking queue status…</span>
		{:then status}
			<span class="sr-only">Queue pending {status.pendingCount}</span>
		{:catch error}
			<span class="sr-only">Queue status error: {formatError(error)}</span>
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
