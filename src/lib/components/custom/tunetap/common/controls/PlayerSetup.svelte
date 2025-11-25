<script lang="ts">
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';
	import { Checkbox } from '$lib/components/shadncn-ui/checkbox/index.js';
	import { onMount } from 'svelte';
	import { getQueueStatus } from '$lib/game/GamePage.state.svelte.js';
	import { RECOMMENDED_PLAYABLE_TRACKS, MIN_PARTIAL_START_TRACKS } from '$lib/constants/game';

	let {
		playerNames,
		playableTracksCount,
		totalTracksCount = 0,
		onStartGame,
		defaultAllowPartialStart = false
	}: {
		playerNames: string[];
		playableTracksCount: number;
		totalTracksCount?: number;
		onStartGame: () => void;
		defaultAllowPartialStart?: boolean;
	} = $props();

	let queueSize = $state(0);
	let isLoading = $state(false);
	let tracksWithReleaseDates = $state(0);
	let progressPercentage = $state(0);
	let allowPartialStart = $state(defaultAllowPartialStart);
	let timeRemainingString = $state('');
	let hasInitialQueueCheck = $state(false);

	const hasRecommendedTracks = $derived(playableTracksCount >= RECOMMENDED_PLAYABLE_TRACKS);
	const canOfferPartialStart = $derived(
		playableTracksCount >= MIN_PARTIAL_START_TRACKS && !hasRecommendedTracks
	);
	const canStartGame = $derived(
		hasRecommendedTracks || (allowPartialStart && playableTracksCount >= MIN_PARTIAL_START_TRACKS)
	);
	const isUrgentLoading = $derived(!hasRecommendedTracks && queueSize > 0);

	$effect(() => {
		tracksWithReleaseDates = playableTracksCount;
		progressPercentage = Math.min(
			100,
			Math.round((playableTracksCount / RECOMMENDED_PLAYABLE_TRACKS) * 100)
		);
		// Only show loading after we've done initial queue check and confirmed there's work pending
		if (hasInitialQueueCheck) {
			isLoading = isUrgentLoading;
		}
	});

onMount(() => {
	const fetchStatus = async () => {
		try {
			const status = await getQueueStatus();
			queueSize = status.pendingCount;
			timeRemainingString = status.timeRemainingString;
			if (!hasInitialQueueCheck) {
				hasInitialQueueCheck = true;
			}
		} catch (error) {
			console.error('Error fetching queue status:', error);
			// Still mark as checked even on error to avoid stuck state
			if (!hasInitialQueueCheck) {
				hasInitialQueueCheck = true;
			}
		}
	};

	// Fetch immediately on mount
	fetchStatus();
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
			
			<div class="track-status">
				<p class="tracks-info">
					<strong>{playableTracksCount}</strong> / {RECOMMENDED_PLAYABLE_TRACKS} playable tracks
					{#if totalTracksCount && totalTracksCount !== playableTracksCount}
						<span class="tracks-info-sub">({totalTracksCount} total in playlist)</span>
					{/if}
				</p>

				{#if isLoading}
					<div class="loading-status">
						<Progress value={progressPercentage} class="progress-bar" />
						<p class="queue-info">
							{queueSize} tracks in queue
							{#if queueSize > 0 && timeRemainingString}
								(~{timeRemainingString} remaining)
							{/if}
						</p>
					</div>
				{:else if hasRecommendedTracks}
					<p class="ready-text">✓ Ready to play!</p>
				{:else if queueSize === 0}
					<p class="queue-info-subtle">All available release dates loaded.</p>
				{/if}
			</div>
			
			<div class="start-section">
				{#if playableTracksCount === 0}
					<div class="no-tracks-warning">
						<p class="warning-text">⚠️ No playable tracks found yet.</p>
					</div>
				{:else if canOfferPartialStart}
					<div class="partial-start-option">
						<label class="partial-start-label">
							<Checkbox bind:checked={allowPartialStart} />
							<span>Start early with {playableTracksCount} tracks</span>
						</label>
						<p class="partial-start-hint">More tracks will load while you play.</p>
					</div>
				{/if}

				<Button
					size="lg"
					onclick={onStartGame}
					disabled={!canStartGame}
					class="start-button"
				>
					{#if playableTracksCount === 0}
						Waiting for tracks...
					{:else if !canStartGame}
						Need {MIN_PARTIAL_START_TRACKS}+ tracks to start
					{:else}
						Start Game
					{/if}
				</Button>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<style>
	:global(.setup-card) {
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

	:global(.player-input) {
		width: 100%;
	}

	.track-status {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background-color: var(--muted);
		border-radius: calc(var(--radius) - 2px);
		text-align: center;
	}

	.tracks-info {
		color: var(--foreground);
		margin: 0;
	}

	.tracks-info-sub {
		display: block;
		font-size: 0.8rem;
		color: var(--muted-foreground);
		font-weight: 400;
		margin-top: 0.25rem;
	}

	.loading-status {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	:global(.progress-bar) {
		width: 100%;
	}

	.queue-info {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.queue-info-subtle {
		margin: 0;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}

	.ready-text {
		margin: 0;
		color: var(--primary);
		font-weight: 500;
	}

	.start-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	:global(.start-button) {
		width: 100%;
	}

	.partial-start-option {
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
	}
</style>
