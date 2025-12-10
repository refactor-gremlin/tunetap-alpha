<!--
@component

Player setup screen displayed before the game starts. Allows players to enter their names
and shows the loading progress for playable tracks. Supports partial start with fewer tracks.

Usage:
  ```html
  <PlayerSetup
    playerNames={playerNames}
    playableTracksCount={playableCount}
    totalTracksCount={totalCount}
    onStartGame={handleStartGame}
    defaultAllowPartialStart={false}
  />
  ```
-->
<script lang="ts">
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { Progress } from '$lib/components/shadncn-ui/progress/index.js';
	import { Checkbox } from '$lib/components/shadncn-ui/checkbox/index.js';
	import { getQueueStatus } from '../../../../../../routes/game/musicbrainz.remote';
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
	let progressPercentage = $state(0);
	let allowPartialStart = $state(defaultAllowPartialStart);
	let timeRemainingString = $state('');
	let hasInitialQueueCheck = $state(false);

	const hasRecommendedTracks = $derived(playableTracksCount >= RECOMMENDED_PLAYABLE_TRACKS);
	const hasMinimumTracks = $derived(playableTracksCount >= MIN_PARTIAL_START_TRACKS);
	const canOfferPartialStart = $derived(hasMinimumTracks && !hasRecommendedTracks);
	const canStartGame = $derived(hasRecommendedTracks || (allowPartialStart && hasMinimumTracks));
	const isUrgentLoading = $derived(!hasRecommendedTracks && queueSize > 0);

	$effect(() => {
		progressPercentage = Math.min(
			100,
			Math.round((playableTracksCount / RECOMMENDED_PLAYABLE_TRACKS) * 100)
		);
		if (hasInitialQueueCheck) {
			isLoading = isUrgentLoading;
		}
	});

	$effect(() => {
		const fetchStatus = async () => {
			try {
				const status = await getQueueStatus({});
				queueSize = status.pendingCount;
				timeRemainingString = status.timeRemainingString;
				if (!hasInitialQueueCheck) {
					hasInitialQueueCheck = true;
				}
			} catch (error) {
				console.error('Error fetching queue status:', error);
				if (!hasInitialQueueCheck) {
					hasInitialQueueCheck = true;
				}
			}
		};

		fetchStatus();
		const interval = setInterval(fetchStatus, 1000);
		return () => clearInterval(interval);
	});

	function getButtonText(): string {
		if (playableTracksCount === 0) return 'Waiting for tracks...';
		if (playableTracksCount < MIN_PARTIAL_START_TRACKS)
			return `Need ${MIN_PARTIAL_START_TRACKS}+ tracks to start`;
		if (hasRecommendedTracks) return 'Start Game';
		if (allowPartialStart) return `Start with ${playableTracksCount} tracks`;
		return 'Enable early start below';
	}
</script>

<Card.Root class="setup-card">
	<Card.Header>
		<Card.Title>Player Setup</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="setup-content">
			<p class="local-hint">
				Single-device local multiplayer. Pass the device between players each turn.
			</p>
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
				<div class="tracks-header">
					<span class="tracks-count">{playableTracksCount}</span>
					<span class="tracks-label">tracks ready to play</span>
				</div>

				{#if isLoading && queueSize > 0}
					<div class="loading-status">
						<Progress value={progressPercentage} class="progress-bar" />
						<p class="queue-info">
							Loading {queueSize} more
							{#if timeRemainingString}
								(~{timeRemainingString})
							{/if}
						</p>
					</div>
				{:else if hasRecommendedTracks}
					<p class="ready-text">✓ Ready to play!</p>
				{:else if queueSize === 0 && hasInitialQueueCheck}
					<p class="queue-info-subtle">All release dates loaded</p>
				{/if}
			</div>

			<div class="start-section">
				{#if playableTracksCount === 0}
					<div class="no-tracks-warning">
						<p class="warning-text">⚠️ No playable tracks found yet</p>
						<p class="warning-hint">Tracks need both audio and a release date</p>
					</div>
				{:else if canOfferPartialStart}
					<div class="partial-start-option" class:enabled={allowPartialStart}>
						<label class="partial-start-label">
							<Checkbox bind:checked={allowPartialStart} />
							<span>Start now with {playableTracksCount} tracks</span>
						</label>
						<p class="partial-start-hint">
							{#if queueSize > 0}
								More tracks will load in the background while you play.
							{:else}
								You can wait for more tracks or start playing now.
							{/if}
						</p>
					</div>
				{/if}

				<Button size="lg" onclick={onStartGame} disabled={!canStartGame} class="start-button">
					{getButtonText()}
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

	.tracks-header {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.5rem;
	}

	.tracks-count {
		font-size: 2rem;
		font-weight: 700;
		color: var(--primary);
		line-height: 1;
	}

	.tracks-label {
		font-size: 0.9rem;
		color: var(--muted-foreground);
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

	.warning-hint {
		margin: 0.25rem 0 0 0;
		font-size: 0.75rem;
		color: hsl(var(--destructive) / 0.8);
	}

	:global(.start-button) {
		width: 100%;
	}

	.partial-start-option {
		padding: 1rem;
		background-color: hsl(var(--primary) / 0.05);
		border: 2px solid hsl(var(--primary) / 0.3);
		border-radius: calc(var(--radius) - 2px);
		transition: border-color 0.15s ease, background-color 0.15s ease;
	}

	.partial-start-option.enabled {
		background-color: hsl(var(--primary) / 0.1);
		border-color: hsl(var(--primary) / 0.5);
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
