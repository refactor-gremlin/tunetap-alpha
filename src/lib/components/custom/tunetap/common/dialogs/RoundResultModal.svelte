<!--
@component

Modal dialog shown after each round to display the placement result (correct/incorrect).
Shows feedback about the track placement and advances to the next turn.

Usage:
  ```html
  <RoundResultModal
    result={roundResult}
    currentPlayer={currentPlayer}
    currentTrack={currentTrack}
    exactYearBonusAwarded={bonus}
    onNextTurn={handleNextTurn}
  />
  ```
-->
<script lang="ts">
	import type { PlacementResult, Player } from '$lib/types/tunetap.js';
	import type { Track } from '$lib/types.js';
	import * as Dialog from '$lib/components/shadncn-ui/dialog/index.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { getReleaseYear } from '$lib/utils/timeline.js';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from 'svelte/motion';

	let {
		result,
		currentPlayer,
		currentTrack,
		onNextTurn,
		exactYearBonusAwarded = null
	}: {
		result: PlacementResult | null;
		currentPlayer: Player | null | undefined;
		currentTrack: Track | null;
		onNextTurn: () => void;
		exactYearBonusAwarded?: number | null;
	} = $props();

	let isModalOpen = $state(true);

	// Re-open the modal when result changes (new round)
	$effect(() => {
		if (result) {
			isModalOpen = true;
		}
	});

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen) {
			isModalOpen = false;
			onNextTurn();
		}
	}

	const trackYear = $derived(currentTrack ? getReleaseYear(currentTrack) : null);
	const isCorrect = $derived(
		exactYearBonusAwarded !== null ? exactYearBonusAwarded > 0 : (result?.correct ?? false)
	);
	const reducedMotion = $derived(prefersReducedMotion.current);
	const modalTransitions = $derived({
		fly: reducedMotion ? { duration: 0, y: 0 } : { y: 20, duration: 300, easing: cubicOut },
		header: reducedMotion ? { duration: 0 } : { duration: 200 },
		body: reducedMotion ? { duration: 0 } : { duration: 250, delay: 75 },
		footer: reducedMotion ? { duration: 0 } : { duration: 250, delay: 150 }
	});
	const modalFadeOutDuration = $derived(reducedMotion ? 0 : 150);
</script>

{#if result}
	<Dialog.Root bind:open={isModalOpen} onOpenChange={handleOpenChange}>
		<Dialog.Content class="round-result-modal">
			<div class="round-result-panel" in:fly={modalTransitions.fly} out:fade={{ duration: modalFadeOutDuration }}>
				<div class="round-result-header" in:fade={modalTransitions.header}>
					<Dialog.Header>
						<Dialog.Title class="result-title {isCorrect ? 'correct' : 'incorrect'}">
							{isCorrect ? '✅ Correct!' : '❌ Incorrect'}
						</Dialog.Title>
					</Dialog.Header>
				</div>
				<div class="round-result" in:fade={modalTransitions.body}>
					{#if currentTrack}
						<!-- Track Info Card -->
						<div class="track-info-card">
							{#if currentTrack.coverImage}
								<img
									src={currentTrack.coverImage}
									alt="{currentTrack.name} cover"
									class="track-cover"
								/>
							{/if}
							<div class="track-details">
								<h3 class="track-name">{currentTrack.name}</h3>
								<p class="track-artist">
									{currentTrack.artists.join(', ')}
								</p>
								{#if trackYear}
									<div class="track-year">
										<span class="year-label">Released:</span>
										<span class="year-value">{trackYear}</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}

					<!-- Result Message -->
					<div class="result-section">
						{#if exactYearBonusAwarded !== null}
							<!-- Exact year guess mode -->
							{#if exactYearBonusAwarded > 0}
								<p class="result-message">Perfect! Exact year guess correct!</p>
								<p class="score-update">+{exactYearBonusAwarded} points</p>
							{:else}
								<p class="result-message">Wrong year guess.</p>
								<p class="score-update">0 points</p>
								{#if currentTrack?.firstReleaseDate}
									<p class="correct-date">
										Correct release date: {currentTrack.firstReleaseDate}
									</p>
								{/if}
							{/if}
						{:else}
							<!-- Timeline placement mode -->
							{#if result.correct}
								<p class="result-message">Great job! The track was placed correctly.</p>
								<p class="score-update">+1 point</p>
							{:else}
								<p class="result-message">The track was not placed in the correct position.</p>
								<p class="score-update">0 points</p>
								{#if currentTrack?.firstReleaseDate}
									<p class="correct-date">
										Correct release date: {currentTrack.firstReleaseDate}
									</p>
								{/if}
							{/if}
						{/if}

						{#if currentPlayer}
							<div class="score-display">
								<p class="score-label">Current Score</p>
								<p class="score-value">{currentPlayer.score}/10</p>
							</div>
						{/if}
					</div>
				</div>
				<Dialog.Footer>
					<div class="round-result-footer" in:fade={modalTransitions.footer}>
						<Button onclick={() => (isModalOpen = false)} size="lg" class="next-button">Next Turn</Button>
					</div>
				</Dialog.Footer>
			</div>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<style>
	:global(.round-result-modal) {
		max-width: 450px;
		z-index: 1100 !important;
	}

	/* Override the overlay z-index to be above #app-shell (z-1000) */
	:global([data-slot="dialog-overlay"]) {
		z-index: 1050 !important;
	}

	.round-result-panel {
		display: flex;
		flex-direction: column;
	}

	.round-result-header {
		margin-bottom: 0.5rem;
	}

	.round-result-footer {
		width: 100%;
	}

	:global(.result-title) {
		font-size: 1.75rem;
		text-align: center;
		margin-bottom: 0;
		font-weight: 600;
	}

	:global(.result-title.correct) {
		color: rgb(34, 197, 94);
	}

	:global(.result-title.incorrect) {
		color: rgb(239, 68, 68);
	}

	.round-result {
		padding: 1.5rem 0;
	}

	.track-info-card {
		display: flex;
		gap: 1rem;
		align-items: center;
		background: var(--muted);
		padding: 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		text-align: left;
	}

	.track-cover {
		width: 80px;
		height: 80px;
		border-radius: 0.375rem;
		object-fit: cover;
		flex-shrink: 0;
	}

	.track-details {
		flex: 1;
		min-width: 0;
	}

	.track-name {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: var(--foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-artist {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin: 0 0 0.5rem 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-year {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.year-label {
		font-size: 0.875rem;
		color: var(--muted-foreground);
	}

	.year-value {
		font-size: 1rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.result-section {
		text-align: center;
	}

	.result-message {
		font-size: 1.125rem;
		margin: 0 0 1rem 0;
		color: var(--foreground);
		font-weight: 500;
	}

	.score-update {
		font-size: 1.75rem;
		font-weight: bold;
		color: var(--primary);
		margin: 0.5rem 0 1rem 0;
	}

	.correct-date {
		color: var(--muted-foreground);
		font-size: 0.875rem;
		margin: 0.75rem 0 0 0;
		padding: 0.5rem;
		background: var(--muted);
		border-radius: 0.25rem;
		display: inline-block;
	}

	.score-display {
		margin-top: 1.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border);
	}

	.score-label {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		margin: 0 0 0.25rem 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.score-value {
		font-size: 1.5rem;
		font-weight: bold;
		color: var(--foreground);
		margin: 0;
	}

	:global(.next-button) {
		width: 100%;
		margin-top: 1rem;
	}
</style>
