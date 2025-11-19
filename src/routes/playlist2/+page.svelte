<script lang="ts">
	import { goto } from '$app/navigation';
	import { submitPlaylist, getPlaylistProgress } from './data.remote';
	import type { Track } from '$lib/types';
	import { useInterval } from 'runed';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { Checkbox } from '$lib/components/shadncn-ui/checkbox/index.js';
	import PageHeader from '$lib/components/custom/PageHeader.svelte';

	let playlistUrl = $state('');
	let tracks = $state<Track[] | null>(null);
	let loading = $state(false);
	let progressMessages = $state<string[]>([]);
	let progressCurrent = $state(0);
	let progressTotal = $state(0);
	let progressStatus = $state<string>('');
	let playerCount = $state(2);
	let showPlayerCountSelection = $state(false);
	let showSongName = $state(false);
	let showArtistName = $state(false);

	let progressMessageElement: HTMLDivElement | null = $state(null);

	// Create interval at component level, but don't start it immediately
	const progressInterval = useInterval(200, {
		immediate: false,
		callback: async () => {
			try {
				const progress = await getPlaylistProgress();
				if (progress) {
					// Add new message if it's different from the last one
					if (
						progressMessages.length === 0 ||
						progressMessages[progressMessages.length - 1] !== progress.message
					) {
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
				// Show player count selection
				showPlayerCountSelection = true;
			}
		} catch (error) {
			console.error('Error submitting playlist:', error);
			progressMessages = [...progressMessages, `Error: ${(error as Error).message}`];
		} finally {
			loading = false;
			progressInterval.pause();
		}
	}

	function startGame() {
		if (tracks && playerCount >= 2 && playerCount <= 4) {
			// Store tracks in sessionStorage (can't pass complex objects via navigation state)
			try {
				sessionStorage.setItem('tunetap_tracks', JSON.stringify(tracks));
				sessionStorage.setItem('tunetap_playerCount', playerCount.toString());
				sessionStorage.setItem('tunetap_showSongName', showSongName.toString());
				sessionStorage.setItem('tunetap_showArtistName', showArtistName.toString());
				// Navigate to game2 page
				goto('/game2');
			} catch (error) {
				console.error('Error storing tracks:', error);
				// Fallback: try navigation state with serialized data
				goto('/game2', {
					state: {
						tracksData: JSON.stringify(tracks),
						playerCount,
						showSongName,
						showArtistName
					}
				});
			}
		}
	}
</script>

<PageHeader title="Enter Your Spotify Playlist" />
<div class="playlist-content">
	<p class="subtitle">Paste a public Spotify playlist URL to get started</p>

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
						{progressCurrent} / {progressTotal} tracks ({Math.round(
							(progressCurrent / progressTotal) * 100
						)}%)
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

	{#if showPlayerCountSelection && tracks}
		<Card.Root class="player-selection">
			<Card.Header>
				<Card.Title>Select Number of Players</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="player-count-selection">
					<p class="instruction">Choose how many players will play (2-4 players)</p>
					<div class="player-count-buttons">
						{#each [2, 3, 4] as count}
							<Button
								variant={playerCount === count ? 'default' : 'outline'}
								onclick={() => (playerCount = count)}
							>
								{count}
								{count === 1 ? 'Player' : 'Players'}
							</Button>
						{/each}
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
					<Button size="lg" onclick={startGame} class="start-button">Start Game</Button>
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

	.player-selection {
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
	}

	.display-options {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
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

	.start-button {
		width: 100%;
	}
</style>
