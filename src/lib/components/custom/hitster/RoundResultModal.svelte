<script lang="ts">
	import type { PlacementResult, Player } from '$lib/types/hitster.js';
	import type { Track } from '$lib/types.js';
	import * as Dialog from '$lib/components/shadncn-ui/dialog/index.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

	let {
		result,
		currentPlayer,
		currentTrack,
		onNextTurn
	}: {
		result: PlacementResult | null;
		currentPlayer: Player | null | undefined;
		currentTrack: Track | null;
		onNextTurn: () => void;
	} = $props();
</script>

{#if result}
	<Dialog.Root open={true}>
		<Dialog.Content class="round-result-modal">
			<Dialog.Header>
				<Dialog.Title class="result-title {result.correct ? 'correct' : 'incorrect'}">
					{result.correct ? '✅ Correct!' : '❌ Incorrect'}
				</Dialog.Title>
			</Dialog.Header>
			<div class="round-result">
				{#if result.correct}
					<p class="result-message">Great job! The track was placed correctly.</p>
					{#if currentPlayer}
						<p class="score-update">Score: {currentPlayer.score}/10</p>
					{/if}
				{:else}
					<p class="result-message">The track was not placed in the correct position.</p>
					{#if currentTrack}
						<p class="correct-date">Correct release date: {currentTrack.firstReleaseDate}</p>
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

	.next-button {
		width: 100%;
		margin-top: 1rem;
	}
</style>

