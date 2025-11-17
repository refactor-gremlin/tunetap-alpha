<script lang="ts">
	import { goto } from '$app/navigation';
	import { submitPlaylist, getPlaylistProgress } from './data.remote';
	import type { Track } from '$lib/types';
	import { useInterval } from 'runed';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import DarkModeToggle from '$lib/components/custom/DarkModeToggle.svelte';

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
	<div class="header-left">
		<DarkModeToggle />
	</div>
	<h1>Enter Your Spotify Playlist</h1>
	<p>Paste a public Spotify playlist URL to get started</p>

	<div class="input-group">
		<Input
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
		<Button onclick={handleSubmit} disabled={loading || !playlistUrl.trim()}>
			{loading ? 'Loading...' : 'Load Playlist'}
		</Button>
	</div>

	{#if loading && progressMessages.length > 0}
		<Card.Root class="progress-container">
			<Card.Header>
				<Card.Title>Processing Playlist</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="progress-message" bind:this={progressMessageElement}>
					{#each progressMessages as message}
						<div class="progress-line">{message}</div>
					{/each}
				</div>
				{#if progressTotal > 0}
					<div class="progress-bar-container">
						<Progress value={(progressCurrent / progressTotal) * 100} />
					</div>
					<div class="progress-stats">
						{progressCurrent} / {progressTotal} tracks ({Math.round((progressCurrent / progressTotal) * 100)}%)
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	{#if tracks && !loading}
		<Card.Root class="tracks-preview">
			<Card.Content>
				<p>Found {tracks.length} tracks</p>
				<p>{tracks.filter((t: Track) => t.status === 'found').length} tracks with audio</p>
			</Card.Content>
		</Card.Root>
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
		position: relative;
	}

	.header-left {
		position: absolute;
		top: 2rem;
		left: 2rem;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
	}

	p {
		margin-bottom: 2rem;
		color: var(--muted-foreground);
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
</style>

