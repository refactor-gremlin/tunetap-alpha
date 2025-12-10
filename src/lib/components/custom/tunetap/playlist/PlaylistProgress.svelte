<!--
@component

Displays playlist processing progress with status messages and progress bar.

Usage:
  ```html
  <PlaylistProgress {submitPromise} {progressPromise} />
  ```
-->
<script lang="ts">
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { createBoundaryErrorHandler } from '$lib/utils/error-boundary';
	import ErrorState from '$lib/components/custom/common/ErrorState.svelte';
	import type { Track } from '$lib/types';

	interface SubmitResult {
		success: boolean;
		tracks: Track[];
		error?: string;
	}

	interface ProgressResult {
		message: string;
		current: number;
		total: number;
	}

	interface Props {
		submitPromise: Promise<SubmitResult>;
		progressPromise: Promise<ProgressResult | null> | null;
	}

	let { submitPromise, progressPromise }: Props = $props();

	let lastProgress = $state<ProgressResult | null>(null);

	$effect(() => {
		if (progressPromise) {
			progressPromise.then((result) => {
				if (result) lastProgress = result;
			}).catch(() => {});
		}
	});
</script>

<Card.Root class="progress-container">
	<Card.Header>
		<Card.Title>Processing Playlist</Card.Title>
	</Card.Header>
	<Card.Content>
		<svelte:boundary onerror={createBoundaryErrorHandler('PlaylistProgress')}>
			{#snippet failed(error, reset)}
				<ErrorState {error} {reset} />
			{/snippet}
			{#await submitPromise}
				<div class="progress-message">
					{#if progressPromise}
						<svelte:boundary onerror={createBoundaryErrorHandler('ProgressPoll')}>
							{#snippet failed(error, reset)}
								<ErrorState {error} {reset} />
							{/snippet}
							{#await progressPromise}
								{#if lastProgress}
									<div class="progress-line">{lastProgress.message}</div>
									{#if lastProgress.total > 0}
										<div class="progress-bar-container">
											<Progress value={(lastProgress.current / lastProgress.total) * 100} />
										</div>
										<div class="progress-stats">
											{lastProgress.current} / {lastProgress.total} tracks ({Math.round(
												(lastProgress.current / lastProgress.total) * 100
											)}%)
										</div>
									{/if}
								{:else}
									<p class="progress-line">Starting...</p>
								{/if}
							{:then progress}
								{#if progress}
									<div class="progress-line">{progress.message}</div>
									{#if progress.total > 0}
										<div class="progress-bar-container">
											<Progress value={(progress.current / progress.total) * 100} />
										</div>
										<div class="progress-stats">
											{progress.current} / {progress.total} tracks ({Math.round(
												(progress.current / progress.total) * 100
											)}%)
										</div>
									{/if}
								{:else if lastProgress}
									<div class="progress-line">{lastProgress.message}</div>
									{#if lastProgress.total > 0}
										<div class="progress-bar-container">
											<Progress value={(lastProgress.current / lastProgress.total) * 100} />
										</div>
										<div class="progress-stats">
											{lastProgress.current} / {lastProgress.total} tracks ({Math.round(
												(lastProgress.current / lastProgress.total) * 100
											)}%)
										</div>
									{/if}
								{:else}
									<p class="progress-line">Waiting for updates…</p>
								{/if}
							{:catch}
								{#if lastProgress}
									<div class="progress-line">{lastProgress.message}</div>
								{:else}
									<p class="progress-line">Processing…</p>
								{/if}
							{/await}
						</svelte:boundary>
					{:else}
						<p class="progress-line">Initializing…</p>
					{/if}
				</div>
			{:then result}
				<p class="progress-summary">
					{#if result.success}
						Playlist ready! Found {result.tracks.length} tracks.
					{:else}
						Failed to process playlist.
					{/if}
				</p>
			{:catch error}
				{(() => {
					throw error;
				})()}
			{/await}
		</svelte:boundary>
	</Card.Content>
</Card.Root>

<style>
	:global(.progress-container) {
		width: 100%;
		max-width: 500px;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.progress-message {
		font-family: monospace;
		font-size: 0.85rem;
		color: var(--foreground);
		min-height: 80px;
		background-color: var(--muted);
		padding: 0.75rem;
		border-radius: calc(var(--radius) - 2px);
		border: 1px solid var(--border);
	}

	.progress-line {
		margin-bottom: 0.25rem;
		word-break: break-word;
	}

	.progress-line:last-child {
		margin-bottom: 0;
	}

	.progress-bar-container {
		width: 100%;
		margin: 0.5rem 0;
	}

	.progress-stats {
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted-foreground);
	}

	.progress-summary {
		text-align: center;
		font-size: 0.95rem;
		color: var(--foreground);
		margin-bottom: 0;
	}
</style>
