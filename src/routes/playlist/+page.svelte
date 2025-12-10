<script lang="ts">
	import { goto } from '$app/navigation';
	import { submitPlaylist, getPlaylistProgress } from './data.remote';
	import type { Track } from '$lib/types';
	import PageHeader from '$lib/components/custom/PageHeader.svelte';
	import {
		PlaylistUrlInput,
		PlaylistProgress,
		GameSetupCard
	} from '$lib/components/custom/tunetap/playlist';

	let playlistUrl = $state('');
	let tracks = $state<Track[] | null>(null);
	let showPlayerCountSelection = $state(false);

	const MAX_PROGRESS_RETRIES = 5;

	let jobState = $state<{ jobId: string; playlistUrl: string } | null>(null);
	let submitPromise = $state<ReturnType<typeof submitPlaylist> | null>(null);
	let progressPromise = $state<ReturnType<typeof getPlaylistProgress> | null>(null);
	let latestResult = $state<{ success: boolean; message: string; error?: string } | null>(null);
	let progressTimer: ReturnType<typeof setTimeout> | null = null;
	let progressRetryCount = $state(0);
	let abortController: AbortController | null = null;
	let isSubmitting = $state(false);

	function isAborted(): boolean {
		return abortController?.signal.aborted ?? false;
	}

	function clearProgressTimer() {
		if (progressTimer) {
			clearTimeout(progressTimer);
			progressTimer = null;
		}
	}

	function refreshProgress() {
		if (!jobState || latestResult || isAborted()) {
			return;
		}
		const remoteQuery = getPlaylistProgress({
			playlistUrl: jobState.playlistUrl,
			jobId: jobState.jobId
		});
		progressPromise = remoteQuery;
		remoteQuery
			.then((result) => {
				if (isAborted()) return result;
				progressRetryCount = 0;
				return result;
			})
			.catch((error) => {
				if (isAborted()) return null;
				progressRetryCount += 1;
				if (progressRetryCount >= MAX_PROGRESS_RETRIES) {
					const errorMessage =
						error && typeof error === 'object' && 'message' in error
							? String((error as { message?: unknown }).message ?? 'Unknown error')
							: String(error ?? 'Unknown error');
					latestResult = {
						success: false,
						message: 'Failed to fetch progress',
						error: errorMessage
					};
					clearProgressTimer();
				}
				return null;
			})
			.finally(() => {
				if (isAborted()) return;
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

	const isProcessing = $derived(isSubmitting || Boolean(jobState && latestResult === null));

	function beginPlaylistProcessing() {
		const trimmed = playlistUrl.trim();
		if (!trimmed || isProcessing) return;

		abortController?.abort();
		abortController = new AbortController();

		isSubmitting = true;
		const newJobId = createClientJobId();
		jobState = { jobId: newJobId, playlistUrl: trimmed };
		tracks = null;
		showPlayerCountSelection = false;
		latestResult = null;
		progressRetryCount = 0;
		clearProgressTimer();

		const command = submitPlaylist({ playlistUrl: trimmed, jobId: newJobId });
		submitPromise = command;
		refreshProgress();

		command
			.then((result) => {
				if (isAborted()) return result;
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
					latestResult = {
						success: false,
						message: 'Playlist processing failed',
						error: result.error ?? 'Failed to process playlist'
					};
				}
				return result;
			})
			.catch((error) => {
				if (isAborted()) return;
				clearProgressTimer();
				isSubmitting = false;
				const message =
					error && typeof error === 'object' && 'message' in error
						? String((error as { message?: unknown }).message ?? 'Unknown error')
						: String(error ?? 'Unknown error');
				latestResult = {
					success: false,
					message: 'Playlist processing failed',
					error: message
				};
				throw error;
			});
	}

	interface GameSettings {
		playerCount: number;
		showSongName: boolean;
		showArtistName: boolean;
		allowPartialStart: boolean;
	}

	function handleStartGame(settings: GameSettings) {
		if (!tracks || settings.playerCount < 2 || settings.playerCount > 6) return;

		try {
			sessionStorage.setItem('tunetap_tracks', JSON.stringify(tracks));
			sessionStorage.setItem('tunetap_playerCount', settings.playerCount.toString());
			sessionStorage.setItem('tunetap_showSongName', settings.showSongName.toString());
			sessionStorage.setItem('tunetap_showArtistName', settings.showArtistName.toString());
			sessionStorage.setItem('tunetap_allowPartialStart', settings.allowPartialStart.toString());
			goto('/game/setup');
		} catch (error) {
			console.error('Error storing tracks:', error);
			goto('/game/setup', {
				state: {
					tracksData: JSON.stringify(tracks),
					...settings
				}
			});
		}
	}

	$effect(() => {
		return () => {
			abortController?.abort();
			clearProgressTimer();
		};
	});
</script>

<PageHeader title="Enter Your Spotify Playlist" />
<div class="playlist-content">
	<p class="subtitle">Paste a public Spotify playlist URL to get started</p>

	<PlaylistUrlInput bind:value={playlistUrl} disabled={isProcessing} onSubmit={beginPlaylistProcessing} />

	{#if jobState && submitPromise}
		<PlaylistProgress {submitPromise} {progressPromise} />
	{/if}

	{#if showPlayerCountSelection && tracks}
		<GameSetupCard {tracks} onStartGame={handleStartGame} />
	{/if}
</div>

<style>
	.playlist-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
	}

	.subtitle {
		margin-bottom: 0;
		text-align: center;
	}
</style>
