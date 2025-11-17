<script lang="ts">
	import { goto } from '$app/navigation';
	import { submitPlaylist, getPlaylistProgress } from './data.remote';
	import type { Track } from '$lib/types';
	import { useInterval } from 'runed';

	let playlistUrl = $state('');
	let tracks = $state<Track[] | null>(null);
	let loading = $state(false);
	let progressMessages = $state<string[]>([]);
	let progressCurrent = $state(0);
	let progressTotal = $state(0);
	let progressStatus = $state<string>('');

	let progressMessageElement: HTMLDivElement | null = $state(null);
	
	// Create interval at component level, but don't start it immediately
	const progressInterval = useInterval(200, {
		immediate: false,
		callback: async () => {
			try {
				const progress = await getPlaylistProgress();
				if (progress) {
					// Add new message if it's different from the last one
					if (progressMessages.length === 0 || progressMessages[progressMessages.length - 1] !== progress.message) {
						progressMessages = [...progressMessages, progress.message];
						// Keep only last 50 messages to prevent memory issues
						if (progressMessages.length > 50) {
							progressMessages = progressMessages.slice(-50);
						}
					}
					progressCurrent = progress.current;
					progressTotal = progress.total;
					progressStatus = progress.status;
				}
			} catch (error) {
				// Ignore polling errors
			}
		}
	});

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if (progressMessageElement && progressMessages.length > 0) {
			progressMessageElement.scrollTop = progressMessageElement.scrollHeight;
		}
	});

	async function handleSubmit() {
		if (!playlistUrl.trim()) {
			return;
		}

		loading = true;
		progressMessages = [`Processing playlist: ${playlistUrl}`];
		progressCurrent = 0;
		progressTotal = 0;
		progressStatus = '';

		// Start polling for progress
		progressInterval.resume();

		try {
			const result = await submitPlaylist({ playlistUrl });
			if (result.success) {
				tracks = result.tracks;
				// Navigate to game page with tracks
				goto('/game', {
					state: { tracks: result.tracks }
				});
			}
		} catch (error) {
			console.error('Error submitting playlist:', error);
			progressMessages = [...progressMessages, `Error: ${(error as Error).message}`];
		} finally {
			loading = false;
			progressInterval.pause();
		}
	}
</script>

<div class="playlist-page">
	<h1>Enter Your Spotify Playlist</h1>
	<p>Paste a public Spotify playlist URL to get started</p>

	<div class="input-group">
		<input
			type="url"
			bind:value={playlistUrl}
			placeholder="https://open.spotify.com/playlist/..."
			disabled={loading}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					handleSubmit();
				}
			}}
		/>
		<button onclick={handleSubmit} disabled={loading || !playlistUrl.trim()}>
			{loading ? 'Loading...' : 'Load Playlist'}
		</button>
	</div>

	{#if loading && progressMessages.length > 0}
		<div class="progress-container">
			<div class="progress-header">
				<h3>Processing Playlist</h3>
			</div>
			<div class="progress-message" bind:this={progressMessageElement}>
				{#each progressMessages as message}
					<div class="progress-line">{message}</div>
				{/each}
			</div>
			{#if progressTotal > 0}
				<div class="progress-bar-container">
					<div class="progress-bar" style="width: {(progressCurrent / progressTotal) * 100}%"></div>
				</div>
				<div class="progress-stats">
					{progressCurrent} / {progressTotal} tracks ({Math.round((progressCurrent / progressTotal) * 100)}%)
				</div>
			{/if}
		</div>
	{/if}

	{#if tracks && !loading}
		<div class="tracks-preview">
			<p>Found {tracks.length} tracks</p>
			<p>{tracks.filter((t: Track) => t.status === 'found').length} tracks with audio</p>
		</div>
	{/if}
</div>

<style>
	.playlist-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
	}

	p {
		margin-bottom: 2rem;
		color: #666;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 500px;
	}

	input {
		padding: 0.75rem;
		font-size: 1rem;
		border: 2px solid #ddd;
		border-radius: 0.5rem;
	}

	input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	button {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		background-color: #1db954;
		color: white;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	button:hover:not(:disabled) {
		background-color: #1ed760;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.tracks-preview {
		margin-top: 2rem;
		text-align: center;
	}

	.progress-container {
		margin-top: 2rem;
		padding: 1.5rem;
		background-color: #f5f5f5;
		border-radius: 0.5rem;
		width: 100%;
		max-width: 600px;
	}

	.progress-header h3 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
	}

	.progress-message {
		font-family: monospace;
		font-size: 0.85rem;
		color: #333;
		margin-bottom: 1rem;
		max-height: 300px;
		overflow-y: auto;
		background-color: white;
		padding: 0.75rem;
		border-radius: 0.25rem;
		border: 1px solid #ddd;
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
		height: 24px;
		background-color: #e0e0e0;
		border-radius: 12px;
		overflow: hidden;
		margin-bottom: 0.5rem;
	}

	.progress-bar {
		height: 100%;
		background-color: #1db954;
		transition: width 0.2s ease;
	}

	.progress-stats {
		text-align: center;
		font-size: 0.9rem;
		color: #666;
	}
</style>

