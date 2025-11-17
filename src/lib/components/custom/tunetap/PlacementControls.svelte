<script lang="ts">
	import type { Player } from '$lib/types/tunetap.js';
	import type { Track } from '$lib/types.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import NumberPickerDrawer from '$lib/components/custom/NumberPicker/NumberPickerDrawer.svelte';
	import { Switch } from '$lib/components/shadncn-ui/switch/index.js';

	let {
		currentTrack,
		currentPlayer,
		selectedYear = 2000,
		onSelectYear,
		exactYearGuessEnabled = $bindable(false),
		onPlaceSameYear
	}: {
		currentTrack: Track | null;
		currentPlayer: Player | null;
		selectedYear?: number;
		onSelectYear: (year: number) => void;
		exactYearGuessEnabled?: boolean;
		onPlaceSameYear?: () => void;
	} = $props();

	let showYearPicker = $state(false);

	function handleYearConfirm(year: number) {
		onSelectYear(year);
		showYearPicker = false;
	}
</script>

{#if currentTrack && currentPlayer}
	<div class="placement-controls">
		<div class="challenge-row">
			<div>
				<p class="instruction-title">Exact year challenge</p>
				<p class="instruction-copy">
					+2 points for a perfect guess, 0 points if you're off.
				</p>
			</div>
			<Switch aria-label="Toggle exact year challenge" bind:checked={exactYearGuessEnabled} />
		</div>

		{#if exactYearGuessEnabled}
			<div class="year-row">
				<p class="instruction">Lock in your year guess</p>
				<div class="year-actions">
					<Button variant="outline" onclick={() => (showYearPicker = true)}>
						Set Year ({selectedYear})
					</Button>
					<Button
						variant="default"
						disabled={!onPlaceSameYear}
						onclick={() => onPlaceSameYear?.()}
					>
						Place In {selectedYear}
					</Button>
					<p class="year-hint">Clip the track directly into the year you selected.</p>
				</div>
			</div>
		{:else}
			<p class="quiet-hint">
				Feeling confident? Toggle the challenge to chase double points.
			</p>
		{/if}

		<div class="placement-note">
			<p>
				Switch to the <strong>Timeline</strong> tab to place the track before, after, or in the same year as another card.
			</p>
			{#if currentPlayer.timeline.length === 0}
				<p>Your first track can be placed with the timeline's “Place First Track” prompt.</p>
			{/if}
		</div>
	</div>
{/if}

<NumberPickerDrawer
	bind:open={showYearPicker}
	bind:value={selectedYear}
	min={1900}
	max={2030}
	title="Select Year"
	description="Choose the year this song was released"
	onConfirm={handleYearConfirm}
/>

<style>
	.placement-controls {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.instruction-title {
		margin: 0 0 0.4rem 0;
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.08em;
		color: var(--muted-foreground);
	}

	.instruction-copy {
		margin: 0;
		color: var(--foreground);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.challenge-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--border);
		border-radius: calc(var(--radius) - 2px);
		background-color: color-mix(in oklch, var(--muted) 25%, transparent);
	}

	.year-row {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: flex-start;
	}

	.year-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.year-hint {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted-foreground);
	}

	.quiet-hint {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted-foreground);
	}

	.placement-note {
		padding: 0.75rem 1rem;
		border-radius: calc(var(--radius) - 2px);
		border: 1px dashed var(--border);
		color: var(--muted-foreground);
		font-size: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.instruction {
		margin: 0;
		color: var(--foreground);
		font-size: 1rem;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.challenge-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
