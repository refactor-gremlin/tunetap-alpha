<script lang="ts">
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';
	import * as Card from '$lib/components/shadncn-ui/card/index.js';

	let {
		playerNames,
		playableTracksCount,
		onStartGame
	}: {
		playerNames: string[];
		playableTracksCount: number;
		onStartGame: () => void;
	} = $props();
</script>

<Card.Root class="setup-card">
	<Card.Header>
		<Card.Title>Player Setup</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="setup-content">
			<p>Enter names for each player:</p>
			<div class="player-inputs">
				{#each playerNames as name, index}
					<Input
						bind:value={playerNames[index]}
						placeholder={`Player ${index + 1} name`}
						class="player-input"
					/>
				{/each}
			</div>
			<p class="tracks-info">
				{playableTracksCount} playable tracks available
			</p>
			<Button
				size="lg"
				onclick={onStartGame}
				disabled={playableTracksCount < 10}
				class="start-button"
			>
				Start Game
			</Button>
		</div>
	</Card.Content>
</Card.Root>

<style>
	.setup-card {
		max-width: 600px;
		margin: 2rem auto;
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

	.player-input {
		width: 100%;
	}

	.tracks-info {
		text-align: center;
		color: var(--muted-foreground);
		margin: 0;
	}

	.start-button {
		width: 100%;
	}
</style>
