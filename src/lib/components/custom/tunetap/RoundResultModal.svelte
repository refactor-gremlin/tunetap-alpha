<script lang="ts">
	import type { PlacementResult, Player } from '$lib/types/tunetap.js';
	import type { Track } from '$lib/types.js';
	import * as Dialog from '$lib/components/shadncn-ui/dialog/index.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

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
</script>

{#if result}
	<Dialog.Root open={true}>
		<Dialog.Content class="round-result-modal">
			<Dialog.Header>
				<Dialog.Title class="result-title {
					exactYearBonusAwarded !== null
						? (exactYearBonusAwarded > 0 ? 'correct' : 'incorrect')
						: (result.correct ? 'correct' : 'incorrect')
				}">
					{exactYearBonusAwarded !== null
						? (exactYearBonusAwarded > 0 ? '✅ Correct!' : '❌ Incorrect')
						: (result.correct ? '✅ Correct!' : '❌ Incorrect')}
				</Dialog.Title>
			</Dialog.Header>
			<div class="round-result">
				{#if exactYearBonusAwarded !== null}
					<!-- Exact year guess mode -->
					{#if exactYearBonusAwarded > 0}
						<p class="result-message">Perfect! Exact year guess correct!</p>
						<p class="score-update">+{exactYearBonusAwarded} points</p>
					{:else}
						<p class="result-message">Wrong year guess.</p>
						<p class="score-update">0 points</p>
					{/if}
					{#if currentPlayer}
						<p class="score-update">Score: {currentPlayer.score}/10</p>
					{/if}
					{#if currentTrack}
						<p class="correct-date">Correct release date: {currentTrack.firstReleaseDate}</p>
					{/if}
				{:else}
					<!-- Timeline placement mode -->
					{#if result.correct}
						<p class="result-message">Great job! The track was placed correctly.</p>
						<p class="score-update">+1 point</p>
						{#if currentPlayer}
							<p class="score-update">Score: {currentPlayer.score}/10</p>
						{/if}
					{:else}
						<p class="result-message">The track was not placed in the correct position.</p>
						<p class="score-update">0 points</p>
						{#if currentTrack}
							<p class="correct-date">Correct release date: {currentTrack.firstReleaseDate}</p>
						{/if}
					{/if}
				{/if}
			</div>
			<Dialog.Footer>
				<Button onclick={onNextTurn} size="lg" class="next-button">
					Next Turn
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}

<style>
	.round-result-modal {
		max-width: 400px;
	}

	.result-title {
		font-size: 1.5rem;
		text-align: center;
		margin-bottom: 0;
	}

	.result-title.correct {
		color: rgb(34, 197, 94);
	}

	.result-title.incorrect {
		color: rgb(239, 68, 68);
	}

	.round-result {
		text-align: center;
		padding: 1rem 0;
	}

	.result-message {
		font-size: 1.125rem;
		margin: 0 0 1rem 0;
		color: var(--foreground);
	}

	.score-update {
		font-size: 1.5rem;
		font-weight: bold;
		color: var(--primary);
		margin: 0.5rem 0 0 0;
	}

	.correct-date {
		color: var(--muted-foreground);
		font-size: 0.875rem;
		margin: 0.5rem 0 0 0;
	}

	.bonus-message {
		margin: 0.5rem 0 0 0;
		font-size: 0.95rem;
		color: var(--muted-foreground);
	}

	.next-button {
		width: 100%;
		margin-top: 1rem;
	}
</style>
