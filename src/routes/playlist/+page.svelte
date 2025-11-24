<script lang="ts">
	import { goto } from '$app/navigation';
	import { submitPlaylist, getPlaylistProgress } from './data.remote';
	import type { Track } from '$lib/types';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { Checkbox } from '$lib/components/shadncn-ui/checkbox/index.js';
	import PageHeader from '$lib/components/custom/PageHeader.svelte';
	import { RECOMMENDED_PLAYABLE_TRACKS, MIN_PARTIAL_START_TRACKS } from '$lib/constants/game';
	import { onDestroy } from 'svelte';
	import { createBoundaryErrorHandler } from '$lib/utils/error-boundary';
	import ErrorState from '$lib/components/custom/common/ErrorState.svelte';

	let playlistUrl = $state('');
	let tracks = $state<Track[] | null>(null);
	let playerCount = $state(2);
	let showPlayerCountSelection = $state(false);
	let showSongName = $state(false);
	let showArtistName = $state(false);
	let allowPartialStart = $state(false);
	let startWarning = $state<string | null>(null);

	const MAX_PROGRESS_RETRIES = 5;

	let jobState = $state<{ jobId: string; playlistUrl: string } | null>(null);
	let submitPromise = $state<ReturnType<typeof submitPlaylist> | null>(null);
	let progressPromise = $state<ReturnType<typeof getPlaylistProgress> | null>(null);
	let latestResult = $state<{ success: boolean; message: string; error?: string } | null>(null);
	let progressError = $state<string | null>(null);
	let progressFetchError = $state<string | null>(null);
	let progressTimer: ReturnType<typeof setTimeout> | null = null;
	let progressRetryCount = $state(0);
	let mounted = true;
	let isSubmitting = $state(false);

	function clearProgressTimer() {
		if (progressTimer) {
			clearTimeout(progressTimer);
			progressTimer = null;
		}
	}

	function refreshProgress() {
		if (!jobState || latestResult) {
			return;
		}
		const remoteQuery = getPlaylistProgress({
			playlistUrl: jobState.playlistUrl,
			jobId: jobState.jobId
		});
		progressPromise = remoteQuery;
		remoteQuery
			.then((result) => {
				if (!mounted) return result;
				progressRetryCount = 0;
				return result;
			})
			.catch((error) => {
				if (!mounted) return null;
				progressRetryCount += 1;
				const errorMessage =
					error && typeof error === 'object' && 'message' in error
						? String((error as { message?: unknown }).message ?? 'Unknown error')
						: String(error ?? 'Unknown error');
				if (progressRetryCount >= MAX_PROGRESS_RETRIES) {
					latestResult = {
						success: false,
						message: 'Failed to fetch progress',
						error: errorMessage
					};
					progressFetchError = errorMessage;
					clearProgressTimer();
					// Re-throw to trigger the outer catch UI when mounted
					if (mounted) {
						return Promise.reject(error);
					}
				}
				return null;
			})
			.finally(() => {
				if (!mounted) return;
				clearProgressTimer();
				if (!latestResult && progressRetryCount < MAX_PROGRESS_RETRIES) {
					progressTimer = setTimeout(() => refreshProgress(), 500);
				}
			});
	}

	const createClientJobId = () => {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	};

	const playableAudioCount = $derived(
		tracks ? tracks.filter((t) => t.status === 'found' && !!t.audioUrl).length : 0
	);
	const meetsRecommendedThreshold = $derived(playableAudioCount >= RECOMMENDED_PLAYABLE_TRACKS);
	const canUsePartialStart = $derived(playableAudioCount >= MIN_PARTIAL_START_TRACKS);
	const canNavigateToGame = $derived(
		meetsRecommendedThreshold || (allowPartialStart && canUsePartialStart)
	);
	const isProcessing = $derived(isSubmitting || Boolean(jobState && latestResult === null));

	function beginPlaylistProcessing() {
		const trimmed = playlistUrl.trim();
		if (!trimmed || isProcessing) return;
		isSubmitting = true;
		const newJobId = createClientJobId();
		jobState = { jobId: newJobId, playlistUrl: trimmed };
		tracks = null;
		showPlayerCountSelection = false;
		startWarning = null;
		progressError = null;
		progressFetchError = null;
		latestResult = null;
		progressRetryCount = 0;
		clearProgressTimer();
		const command = submitPlaylist({ playlistUrl: trimmed, jobId: newJobId });
		submitPromise = command;
		refreshProgress();
		command
			.then((result) => {
				if (!mounted) return result;
				clearProgressTimer();
				isSubmitting = false;
				if (result.success) {
					tracks = result.tracks;
					showPlayerCountSelection = true;
					latestResult = {
						success: true,
						message: `Loaded ${result.tracks.length} tracks`
					};
				} else {
					progressError = result.error ?? 'Failed to process playlist';
					latestResult = {
						success: false,
						message: 'Playlist processing failed',
						error: progressError ?? undefined
					};
				}
				return result;
			})
			.catch((error) => {
				if (!mounted) return;
				clearProgressTimer();
				isSubmitting = false;
				const message =
					error && typeof error === 'object' && 'message' in error
						? String((error as { message?: unknown }).message ?? 'Unknown error')
						: String(error ?? 'Unknown error');
				progressError = message;
				latestResult = {
					success: false,
					message: 'Playlist processing failed',
					error: message
				};
				// Re-throw to trigger the error boundary
				throw error;
			});
	}

	function startGame() {
		const clampedPlayerCount = Math.min(6, Math.max(2, playerCount));
		startWarning = null;
		if (!canNavigateToGame) {
			startWarning = meetsRecommendedThreshold
				? 'Enable partial start to continue.'
				: `Need ${RECOMMENDED_PLAYABLE_TRACKS} playable tracks or turn on partial start (min ${MIN_PARTIAL_START_TRACKS}).`;
			return;
		}
		if (tracks && clampedPlayerCount >= 2 && clampedPlayerCount <= 6) {
			try {
				sessionStorage.setItem('tunetap_tracks', JSON.stringify(tracks));
				sessionStorage.setItem('tunetap_playerCount', clampedPlayerCount.toString());
				sessionStorage.setItem('tunetap_showSongName', showSongName.toString());
				sessionStorage.setItem('tunetap_showArtistName', showArtistName.toString());
				sessionStorage.setItem('tunetap_allowPartialStart', allowPartialStart.toString());
				goto('/game');
			} catch (error) {
				console.error('Error storing tracks:', error);
				goto('/game', {
					state: {
						tracksData: JSON.stringify(tracks),
						playerCount: clampedPlayerCount,
						showSongName,
						showArtistName,
						allowPartialStart
					}
				});
			}
		}
	}

	onDestroy(() => {
		mounted = false;
		clearProgressTimer();
	});
</script>

<PageHeader title="Enter Your Spotify Playlist" />
<div class="playlist-content">
	<p class="subtitle">Paste a public Spotify playlist URL to get started</p>

	<div class="input-group">
		<Input
			type="url"
			bind:value={playlistUrl}
			placeholder="https://open.spotify.com/playlist/..."
			disabled={isProcessing}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					beginPlaylistProcessing();
				}
			}}
		/>
		<Button onclick={beginPlaylistProcessing} disabled={!playlistUrl.trim() || isProcessing}>
			{isProcessing ? 'Processing…' : 'Load Playlist'}
		</Button>
	</div>

	{#if jobState && submitPromise}
		<Card.Root class="progress-container">
			<Card.Header>
				<Card.Title>Processing Playlist</Card.Title>
			</Card.Header>
			<Card.Content>
				<svelte:boundary onerror={createBoundaryErrorHandler('SubmitPlaylist')}>
					{#snippet failed(error, reset)}
						<ErrorState {error} {reset} />
					{/snippet}
					{#await submitPromise}
						<div class="progress-message">
							{#if progressPromise}
								<svelte:boundary onerror={createBoundaryErrorHandler('PlaylistProgress')}>
									{#snippet failed(error, reset)}
										<ErrorState {error} {reset} />
									{/snippet}
									{#await progressPromise}
										<p class="progress-line">Awaiting progress…</p>
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
										{:else}
											<p class="progress-line">Waiting for updates…</p>
										{/if}
									{:catch error}
										{(() => {
											throw error;
										})()}
									{/await}
								</svelte:boundary>
							{:else}
								<p class="progress-line">Waiting for progress updates…</p>
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
	{/if}

	{#if tracks}
		<Card.Root class="tracks-preview">
			<Card.Content>
				<p>Found {tracks.length} tracks</p>
				<p>{playableAudioCount} tracks with audio (playable)</p>
				{#if latestResult?.error}
					<p class="progress-error">{latestResult.error}</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if showPlayerCountSelection && tracks}
		<Card.Root class="player-selection">
			<Card.Header>
				<Card.Title>Select Number of Players</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="player-count-selection">
					<p class="instruction">Local pass-and-play on one device (2-6 players)</p>
					<div class="player-count-buttons">
						{#each [2, 3, 4, 5, 6] as count}
							<Button
								variant={playerCount === count ? 'default' : 'outline'}
								onclick={() => (playerCount = count)}
							>
								{count}
								{count === 1 ? 'Player' : 'Players'}
							</Button>
						{/each}
					</div>
					<div class="playable-summary">
						<p>
							Playable tracks ready: {playableAudioCount} / {RECOMMENDED_PLAYABLE_TRACKS}
						</p>
						{#if canUsePartialStart}
							<label class="partial-start-cta">
								<Checkbox bind:checked={allowPartialStart} />
								<span>
									Allow partial start (min {MIN_PARTIAL_START_TRACKS} tracks). We'll keep loading more
									in the background.
								</span>
							</label>
						{:else}
							<p class="partial-start-note">
								Need at least {MIN_PARTIAL_START_TRACKS} playable tracks to enable partial start.
							</p>
						{/if}
					</div>
					<div class="display-options">
						<p class="instruction">Display Options:</p>
						<div class="checkbox-group">
							<label class="checkbox-label">
								<Checkbox bind:checked={showSongName} />
								<span>Show song name</span>
							</label>
							<label class="checkbox-label">
								<Checkbox bind:checked={showArtistName} />
								<span>Show artist name</span>
							</label>
						</div>
					</div>
					{#if startWarning}
						<p class="start-warning">{startWarning}</p>
					{/if}
					<Button size="lg" onclick={startGame} class="start-button" disabled={!canNavigateToGame}>
						{canNavigateToGame ? 'Go to Player Setup' : 'Waiting for tracks…'}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}
</div>

<style>
	.playlist-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	.playlist-content p {
		margin-bottom: 0;
		text-align: center;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 500px;
	}

	.progress-message {
		font-family: monospace;
		font-size: 0.85rem;
		color: var(--foreground);
		margin-bottom: 1rem;
		max-height: 300px;
		overflow-y: auto;
		background-color: var(--muted);
		padding: 0.75rem;
		border-radius: calc(var(--radius) - 2px);
		border: 1px solid var(--border);
		scroll-behavior: smooth;
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
		margin-bottom: 0.5rem;
	}

	.progress-stats {
		text-align: center;
		font-size: 0.9rem;
		color: var(--muted-foreground);
	}

	.progress-error {
		margin-top: 0.75rem;
		color: var(--destructive);
		font-weight: 600;
		text-align: center;
	}

	.progress-summary {
		text-align: center;
		font-size: 0.95rem;
		color: var(--foreground);
		margin-bottom: 0;
	}

	:global(.player-selection) {
		width: 100%;
		max-width: 500px;
	}

	.player-count-selection {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		align-items: center;
	}

	.instruction {
		text-align: center;
		margin: 0;
		color: var(--foreground);
	}

	.player-count-buttons {
		display: flex;
		gap: 1rem;
		width: 100%;
		justify-content: center;
		flex-wrap: wrap;
	}

	.display-options {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.playable-summary {
		width: 100%;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: calc(var(--radius) - 2px);
		background-color: var(--muted);
		text-align: left;
		color: var(--foreground);
		font-size: 0.9rem;
	}

	.partial-start-cta,
	.partial-start-note {
		display: block;
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted-foreground);
	}

	.partial-start-cta {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.start-warning {
		width: 100%;
		margin: 0.5rem 0 0 0;
		color: hsl(var(--destructive));
		text-align: center;
		font-weight: 500;
	}

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		align-items: flex-start;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
		color: var(--foreground);
	}

	:global(.start-button) {
		width: 100%;
	}
</style>
