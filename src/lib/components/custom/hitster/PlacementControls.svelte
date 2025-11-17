<script lang="ts">
	import type { Player, PlacementType } from '$lib/types/hitster.js';
	import type { Track } from '$lib/types.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import NumberPickerDrawer from '$lib/components/custom/NumberPicker/NumberPickerDrawer.svelte';

	let {
		currentTrack,
		currentPlayer,
		selectedPlacementType,
		selectedYear = 2000,
		onPlaceTrack,
		onSelectPlacementType,
		onSelectYear
	}: {
		currentTrack: Track | null;
		currentPlayer: Player | null;
		selectedPlacementType: PlacementType | null;
		selectedYear?: number;
		onPlaceTrack: () => void;
		onSelectPlacementType: (type: PlacementType | null) => void;
		onSelectYear: (year: number) => void;
	} = $props();

	let showYearPicker = $state(false);

	function handleYearConfirm(year: number) {
		onSelectYear(year);
		showYearPicker = false;
		onSelectPlacementType('same');
	}
</script>

{#if currentTrack && currentPlayer && currentPlayer.timeline.length > 0}
	<div class="placement-controls">
		<div class="placement-section">
			<p class="instruction">Or place this track in a specific year:</p>
			<div class="placement-options">
				<Button
					variant={selectedPlacementType === 'same' ? 'default' : 'outline'}
					onclick={() => {
						showYearPicker = true;
					}}
				>
					Same Year
				</Button>
			</div>
		</div>
		{#if selectedPlacementType === 'same'}
			<div class="placement-section">
				<div class="preview-info">
					<p class="preview-text">Placing in year: <strong>{selectedYear}</strong></p>
				</div>
				<Button size="lg" onclick={onPlaceTrack} class="confirm-button">
					Confirm Placement
				</Button>
			</div>
		{/if}
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
		gap: 1.5rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border);
	}

	.placement-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
	}

	.instruction {
		margin: 0;
		color: var(--foreground);
		font-size: 1rem;
		font-weight: 500;
	}

	.placement-options {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		width: 100%;
	}

	.preview-info {
		padding: 0.75rem 1rem;
		background-color: var(--muted);
		border-radius: calc(var(--radius) - 2px);
		width: 100%;
	}

	.preview-text {
		margin: 0;
		color: var(--foreground);
		font-size: 0.875rem;
	}

	.confirm-button {
		width: 100%;
		max-width: 300px;
	}

	@media (max-width: 768px) {
		.placement-controls {
			margin-top: 1.5rem;
			padding-top: 1rem;
		}

		.placement-options {
			flex-direction: column;
		}

		.placement-options button {
			width: 100%;
		}

		.confirm-button {
			max-width: 100%;
		}
	}
</style>

