<script lang="ts">
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';
	import { Checkbox } from '$lib/components/shadncn-ui/checkbox/index.js';
	import { onMount } from 'svelte';
	import { getQueueSize, getQueueStatus } from '$lib/game/GamePage.state.svelte.js';

	let {
		playerNames,
		playableTracksCount,
		totalTracksCount,
		onStartGame
	}: {
		playerNames: string[];
		playableTracksCount: number;
		totalTracksCount?: number;
		onStartGame: () => void;
	} = $props();

	let queueSize = $state(0);
	let isLoading = $state(true);
	let tracksWithReleaseDates = $state(0);
	let progressPercentage = $state(0);
	let allowPartialStart = $state(false);
	let estimatedTimeRemaining = $state(0);
	let timeRemainingString = $state('');

	// Start condition: Need at least 10 playable tracks.
	// Partial start is allowed if we have at least 5 tracks.
	const canStartGame = $derived(
		playableTracksCount >= 10 || (allowPartialStart && playableTracksCount >= 5)
	);

	// Check if we are still waiting for the high-priority batch (first 20 tracks)
	// We consider "urgent loading" active if we have fewer than 20 tracks ready
	// AND there are still items in the queue.
	const isUrgentLoading = $derived(playableTracksCount < 20 && queueSize > 0);

	// Calculate loading progress
	$effect(() => {
		if (totalTracksCount && totalTracksCount > 0) {
			// Use playableTracksCount as the source of truth for success
			// This decouples us from queueSize for the "progress" bar
			tracksWithReleaseDates = playableTracksCount;
			progressPercentage = Math.round((tracksWithReleaseDates / totalTracksCount) * 100);
			
			// Loading state depends on whether we have reached our "urgent" threshold
			isLoading = isUrgentLoading;
		} else {
			isLoading = false;
		}
	});

	onMount(() => {
		// Initial queue status check
		const fetchStatus = async () => {
			try {
				const status = await getQueueStatus();
				queueSize = status.pendingCount;
				estimatedTimeRemaining = status.estimatedTimeRemaining;
				timeRemainingString = status.timeRemainingString;
			} catch (error) {
				console.error('Error fetching queue status:', error);
			}
		};

		// Initial fetch
		fetchStatus();

		// Set up polling for queue updates
		const interval = setInterval(fetchStatus, 1000);

		return () => clearInterval(interval);
	});
</script>

<Card.Root class="setup-card">
	<Card.Header>
		<Card.Title>Player Setup</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="setup-content">
			<p class="local-hint">Single-device local multiplayer. Pass the device between players each turn.</p>
			<p>Enter names for each player:</p>
			<div class="player-inputs" class:multi-column={playerNames.length > 3}>
				{#each playerNames as name, index}
					<Input
						bind:value={playerNames[index]}
						placeholder={`Player ${index + 1} name`}
						class="player-input"
					/>
				{/each}
			</div>
			
			<!-- Track status section -->
			<div class="track-status">
				<p class="tracks-info">
					{playableTracksCount} playable tracks available
					{#if totalTracksCount}
						({playableTracksCount} of {totalTracksCount} total tracks)
					{/if}
				</p>
				
				{#if isLoading && totalTracksCount}
					<div class="loading-status">
						<p class="loading-text">
							Fetching release dates: {tracksWithReleaseDates}/{totalTracksCount} complete
						</p>
						<Progress value={progressPercentage} class="progress-bar" />
						<p class="queue-info">
							{queueSize} tracks remaining in queue
							{#if queueSize > 0}
								(~{timeRemainingString} remaining)
							{/if}
						</p>
					</div>
				{:else if queueSize > 0 && totalTracksCount && tracksWithReleaseDates >= 20}
					<div class="complete-status">
						<p class="complete-text">
							✓ Ready to start ({tracksWithReleaseDates} tracks ready)
						</p>
						<p class="queue-info-subtle">
							Background processing active: {queueSize} tracks in low priority queue.
						</p>
					</div>
				{:else if queueSize === 0 && totalTracksCount && tracksWithReleaseDates < totalTracksCount}
					<div class="complete-status">
						<p class="complete-text">
							✓ Release date fetching complete
						</p>
					</div>
				{/if}
			</div>
			
			<!-- Start button with better feedback -->
			<div class="start-section">
				{#if !canStartGame && playableTracksCount > 0}
					<div class="start-requirements">
						<p class="requirement-text">
							Need at least {Math.max(10, totalTracksCount ? Math.floor(totalTracksCount * 0.8) : 10)} tracks to start
						</p>
						{#if isLoading}
							<p class="loading-hint">
								Please wait for release dates to finish loading...
							</p>
						{/if}
						
						<!-- Option for partial start -->
						{#if playableTracksCount >= 5 && playableTracksCount < 10}
							<div class="partial-start-option">
								<label class="partial-start-label">
									<Checkbox bind:checked={allowPartialStart} />
									<span>Start with available tracks ({playableTracksCount})</span>
								</label>
								<p class="partial-start-hint">
									Note: More tracks may load during gameplay
								</p>
							</div>
						{/if}
					</div>
				{:else if playableTracksCount === 0}
					<div class="no-tracks-warning">
						<p class="warning-text">
							⚠️ No playable tracks found. Please try a different playlist.
						</p>
					</div>
				{/if}
				
				<Button
					size="lg"
					onclick={onStartGame}
					disabled={!canStartGame || (isLoading && !allowPartialStart)}
					class="start-button"
				>
					{#if isLoading && !allowPartialStart}
						Loading...
					{:else if !canStartGame}
						Not Enough Tracks
					{:else if allowPartialStart && isLoading}
						Start with {playableTracksCount} tracks
					{:else}
						Start Game
					{/if}
				</Button>
				<p class="pass-device-hint">Tap start, then follow on-screen prompts to hand the device to each player.</p>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<style>
	.setup-card {
		max-width: 600px;
		margin: 2rem auto;
	}

	.local-hint {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted-foreground);
	}

	.setup-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.player-inputs {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.player-inputs.multi-column {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.player-input {
		width: 100%;
	}

	.track-status {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background-color: var(--muted);
		border-radius: calc(var(--radius) - 2px);
	}

	.tracks-info {
		text-align: center;
		color: var(--muted-foreground);
		margin: 0;
		font-weight: 500;
	}

	.loading-status {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.loading-text {
		margin: 0;
		font-size: 0.875rem;
		color: var(--foreground);
		text-align: center;
	}

	.progress-bar {
		width: 100%;
	}

	.queue-info {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted-foreground);
		text-align: center;
	}

	.complete-status {
		text-align: center;
		padding: 0.5rem;
	}

	.complete-text {
		margin: 0;
		color: var(--primary);
		font-weight: 500;
	}

	.queue-info-subtle {
		margin: 0.25rem 0 0 0;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.start-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.start-requirements {
		text-align: center;
		padding: 1rem;
		background-color: var(--muted);
		border-radius: calc(var(--radius) - 2px);
	}

	.requirement-text {
		margin: 0;
		color: var(--foreground);
		font-weight: 500;
	}

	.loading-hint {
		margin: 0.5rem 0 0 0;
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	.no-tracks-warning {
		text-align: center;
		padding: 1rem;
		background-color: hsl(var(--destructive) / 0.1);
		border: 1px solid hsl(var(--destructive) / 0.2);
		border-radius: calc(var(--radius) - 2px);
	}

	.warning-text {
		margin: 0;
		color: hsl(var(--destructive));
		font-weight: 500;
	}

	.start-button {
		width: 100%;
	}

	.pass-device-hint {
		margin: 0;
		text-align: center;
		font-size: 0.85rem;
		color: var(--muted-foreground);
	}

	.partial-start-option {
		margin-top: 1rem;
		padding: 1rem;
		background-color: hsl(var(--primary) / 0.05);
		border: 1px solid hsl(var(--primary) / 0.2);
		border-radius: calc(var(--radius) - 2px);
	}

	.partial-start-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
		font-weight: 500;
		color: var(--foreground);
	}

	.partial-start-hint {
		margin: 0.5rem 0 0 0;
		font-size: 0.75rem;
		color: var(--muted-foreground);
		font-style: italic;
	}
</style>
