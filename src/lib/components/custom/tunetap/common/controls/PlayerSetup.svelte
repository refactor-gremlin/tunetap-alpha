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
	let isLoading = $state(true);
	let tracksWithReleaseDates = $state(0);
	let progressPercentage = $state(0);
	let allowPartialStart = $state(defaultAllowPartialStart);
	let timeRemainingString = $state('');
	let hasHydratedPartialPref = $state(false);

	$effect(() => {
		if (!hasHydratedPartialPref) {
			allowPartialStart = defaultAllowPartialStart;
			hasHydratedPartialPref = true;
		}
	});

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
		isLoading = isUrgentLoading;
	});

onMount(() => {
	const fetchStatus = async () => {
		try {
			const status = await getQueueStatus();
			queueSize = status.pendingCount;
			timeRemainingString = status.timeRemainingString;
		} catch (error) {
			console.error('Error fetching queue status:', error);
		}
	};

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
					{playableTracksCount} playable tracks ready
					<span class="tracks-info-sub">Goal: {RECOMMENDED_PLAYABLE_TRACKS}</span>
					{#if totalTracksCount}
						<span class="tracks-info-sub">
							({playableTracksCount} of {totalTracksCount} playlist tracks)
						</span>
					{/if}
				</p>

				{#if isLoading}
					<div class="loading-status">
						<p class="loading-text">
							Fetching release dates: {tracksWithReleaseDates}/{RECOMMENDED_PLAYABLE_TRACKS} complete
						</p>
						<Progress value={progressPercentage} class="progress-bar" />
						<p class="queue-info">
							{queueSize} tracks waiting in queue
							{#if queueSize > 0}
								(~{timeRemainingString} remaining)
							{/if}
						</p>
					</div>
				{:else if queueSize > 0 && tracksWithReleaseDates >= RECOMMENDED_PLAYABLE_TRACKS}
					<div class="complete-status">
						<p class="complete-text">
							✓ Ready to start ({tracksWithReleaseDates} tracks ready)
						</p>
						<p class="queue-info-subtle">
							Background processing active: {queueSize} tracks in low priority queue.
						</p>
					</div>
				{:else if queueSize === 0 && !hasRecommendedTracks}
					<div class="complete-status">
						<p class="complete-text">All release dates processed for now</p>
						<p class="queue-info-subtle">We'll keep checking for new data automatically.</p>
					</div>
				{/if}

				<p class="recommended-hint">
					Recommended: {RECOMMENDED_PLAYABLE_TRACKS} playable tracks for a full-length game.
					{#if !hasRecommendedTracks}
						We can start early and keep loading in the background.
					{/if}
				</p>
			</div>
			
			<div class="start-section">
				{#if !canStartGame && playableTracksCount > 0}
					<div class="start-requirements">
						<p class="requirement-text">
							Need at least {RECOMMENDED_PLAYABLE_TRACKS} playable tracks for the full experience
						</p>
						{#if isLoading}
							<p class="loading-hint">Please wait for release dates to finish loading...</p>
						{/if}

						{#if canOfferPartialStart}
							<div class="partial-start-option">
								<label class="partial-start-label">
									<Checkbox bind:checked={allowPartialStart} />
									<span>
										Allow partial start with {playableTracksCount} tracks
										(<strong>min {MIN_PARTIAL_START_TRACKS}</strong>)
									</span>
								</label>
								<p class="partial-start-hint">We'll keep loading more tracks while you play.</p>
							</div>
						{/if}
					</div>
				{:else if playableTracksCount === 0}
					<div class="no-tracks-warning">
						<p class="warning-text">⚠️ No playable tracks found. Please try a different playlist.</p>
					</div>
				{/if}

				<Button
					size="lg"
					onclick={onStartGame}
					disabled={!canStartGame || (!hasRecommendedTracks && !allowPartialStart)}
					class="start-button"
				>
					{#if !hasRecommendedTracks && !allowPartialStart}
						Waiting for more tracks...
					{:else if !canStartGame}
						Not Enough Tracks
					{:else if allowPartialStart && !hasRecommendedTracks}
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

	.tracks-info-sub {
		display: block;
		font-size: 0.8rem;
		color: var(--muted-foreground);
		font-weight: 400;
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

	:global(.progress-bar) {
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

	.recommended-hint {
		margin: 0.5rem 0 0 0;
		font-size: 0.85rem;
		text-align: center;
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

	:global(.start-button) {
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
