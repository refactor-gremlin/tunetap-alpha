<!--
@component

Game setup card for selecting player count, display options, and starting the game.

Usage:
  ```html
  <GameSetupCard {tracks} onStartGame={handleStart} />
  ```
-->
<script lang="ts">
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';
	import { Checkbox } from '$lib/components/shadncn-ui/checkbox/index.js';
	import { RECOMMENDED_PLAYABLE_TRACKS, MIN_PARTIAL_START_TRACKS } from '$lib/constants/game';
	import { hasAudioSource } from '$lib/utils/track';
	import type { Track } from '$lib/types';

	interface GameSettings {
		playerCount: number;
		showSongName: boolean;
		showArtistName: boolean;
		allowPartialStart: boolean;
	}

	interface Props {
		tracks: Track[];
		onStartGame: (settings: GameSettings) => void;
	}

	let { tracks, onStartGame }: Props = $props();

	let playerCount = $state(2);
	let showSongName = $state(false);
	let showArtistName = $state(false);
	let allowPartialStart = $state(false);
	let startWarning = $state<string | null>(null);

	const playableAudioCount = $derived(tracks.filter(hasAudioSource).length);
	const meetsRecommendedThreshold = $derived(playableAudioCount >= RECOMMENDED_PLAYABLE_TRACKS);
	const canUsePartialStart = $derived(playableAudioCount >= MIN_PARTIAL_START_TRACKS);
	const canNavigateToGame = $derived(
		meetsRecommendedThreshold || (allowPartialStart && canUsePartialStart)
	);

	function handleStartGame() {
		startWarning = null;
		if (!canNavigateToGame) {
			startWarning = meetsRecommendedThreshold
				? 'Enable partial start to continue.'
				: `Need ${RECOMMENDED_PLAYABLE_TRACKS} playable tracks or turn on partial start (min ${MIN_PARTIAL_START_TRACKS}).`;
			return;
		}
		const clampedPlayerCount = Math.min(6, Math.max(2, playerCount));
		onStartGame({
			playerCount: clampedPlayerCount,
			showSongName,
			showArtistName,
			allowPartialStart
		});
	}
</script>

<Card.Root class="game-setup-card">
	<Card.Header>
		<Card.Title>Select Number of Players</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="setup-content">
			<p class="instruction">Local pass-and-play on one device (2-6 players)</p>
			<div class="player-count-buttons">
				{#each [2, 3, 4, 5, 6] as count}
					<Button
						variant={playerCount === count ? 'default' : 'outline'}
						onclick={() => (playerCount = count)}
					>
						{count} Players
					</Button>
				{/each}
			</div>

			<div class="playable-summary">
				<p>
					Playable tracks ready: {playableAudioCount} / {RECOMMENDED_PLAYABLE_TRACKS}
				</p>
				{#if canUsePartialStart}
					<label class="partial-start-option">
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

			<Button size="lg" onclick={handleStartGame} class="start-button" disabled={!canNavigateToGame}>
				{canNavigateToGame ? 'Go to Player Setup' : 'Waiting for tracks…'}
			</Button>
		</div>
	</Card.Content>
</Card.Root>

<style>
	:global(.game-setup-card) {
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

	.setup-content {
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

	.playable-summary p {
		margin: 0;
	}

	.partial-start-option {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted-foreground);
		cursor: pointer;
	}

	.partial-start-note {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		color: var(--muted-foreground);
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

	.start-warning {
		width: 100%;
		margin: 0;
		color: hsl(var(--destructive));
		text-align: center;
		font-weight: 500;
	}

	:global(.start-button) {
		width: 100%;
	}
</style>
