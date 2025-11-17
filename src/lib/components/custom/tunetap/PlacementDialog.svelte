<script lang="ts">
	import type { Track } from '$lib/types.js';
	import type { PlacementType } from '$lib/types/tunetap.js';
	import * as Dialog from '$lib/components/shadncn-ui/dialog/index.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { getReleaseYear } from '$lib/utils/timeline.js';

	let {
		open = $bindable(false),
		currentTrack,
		referenceTrack,
		selectedPlacementType = $bindable(null as PlacementType | null),
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		currentTrack: Track | null;
		referenceTrack: Track | null;
		selectedPlacementType?: PlacementType | null;
		onConfirm: (placementType: PlacementType) => void;
		onCancel: () => void;
	} = $props();

	function handleConfirm() {
		if (selectedPlacementType) {
			onConfirm(selectedPlacementType);
		}
	}

	function handlePlacementSelect(type: PlacementType) {
		selectedPlacementType = type;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && selectedPlacementType) {
			event.preventDefault();
			handleConfirm();
		}
	}

	const referenceTrackYear = $derived(
		referenceTrack ? getReleaseYear(referenceTrack) : null
	);

	// Track if dialog was closed via cancel/confirm buttons to avoid double-calling onCancel
	let closedViaButton = $state(false);
	let previousOpen = $state(open);

	// Watch for dialog close and call onCancel if closed via X button
	$effect(() => {
		// If dialog was open and is now closed, and wasn't closed via button
		if (previousOpen && !open && !closedViaButton) {
			// Dialog was closed (likely via X button), clean up state
			onCancel();
		}
		// Update previous state
		previousOpen = open;
		// Reset flag when dialog opens
		if (open) {
			closedViaButton = false;
		}
	});

	function handleCancel() {
		closedViaButton = true;
		onCancel();
	}

	function handleConfirmInternal() {
		closedViaButton = true;
		handleConfirm();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="placement-dialog" onkeydown={handleKeydown}>
		<Dialog.Header>
			<Dialog.Title>Place Track</Dialog.Title>
			<Dialog.Description>
				Choose where to place the current track relative to the selected reference track.
			</Dialog.Description>
		</Dialog.Header>

		<div class="dialog-content">
			<!-- Current Track Display -->
			{#if currentTrack}
				<div class="track-section">
					<p class="section-label">Current Track</p>
					<div class="track-display current-track-hidden">
						<div class="track-image-placeholder">🎵</div>
						<div class="track-details">
							<strong class="track-name">Hidden Track</strong>
							<div class="track-artist">Listen to place correctly</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Reference Track Display -->
			{#if referenceTrack}
				<div class="track-section">
					<p class="section-label">Reference Track</p>
					<div class="track-display">
						{#if referenceTrack.coverImage}
							<img
								src={referenceTrack.coverImage}
								alt={`${referenceTrack.name} album cover`}
								class="track-image"
							/>
						{:else}
							<div class="track-image-placeholder">🎵</div>
						{/if}
						<div class="track-details">
							<strong class="track-name">{referenceTrack.name}</strong>
							<div class="track-artist">{referenceTrack.artists.join(', ')}</div>
							{#if referenceTrackYear}
								<div class="track-year">{referenceTrackYear}</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Placement Options -->
			<div class="placement-section">
				<p class="section-label">Placement Options</p>
				<div class="placement-buttons">
					<Button
						variant={selectedPlacementType === 'before' ? 'default' : 'outline'}
						size="lg"
						class="placement-button"
						onclick={() => handlePlacementSelect('before')}
					>
						Before
					</Button>
					<Button
						variant={selectedPlacementType === 'same' ? 'default' : 'outline'}
						size="lg"
						class="placement-button"
						onclick={() => handlePlacementSelect('same')}
					>
						Same Year
					</Button>
					<Button
						variant={selectedPlacementType === 'after' ? 'default' : 'outline'}
						size="lg"
						class="placement-button"
						onclick={() => handlePlacementSelect('after')}
					>
						After
					</Button>
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleCancel}>
				Cancel
			</Button>
			<Button onclick={handleConfirmInternal} disabled={!selectedPlacementType}>
				Place Track
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.placement-dialog {
		max-width: 500px;
		width: 100%;
		overflow-x: hidden;
	}

	.dialog-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem 0;
		overflow-x: hidden;
		width: 100%;
	}

	.track-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-label {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted-foreground);
	}

	.track-display {
		display: flex;
		gap: 1rem;
		align-items: center;
		padding: 1rem;
		border-radius: calc(var(--radius) - 2px);
		background-color: color-mix(in oklch, var(--muted) 20%, transparent);
		border: 1px solid var(--border);
		overflow: hidden;
		width: 100%;
		min-width: 0;
	}

	.track-image {
		width: 64px;
		height: 64px;
		border-radius: calc(var(--radius) - 4px);
		object-fit: cover;
		flex-shrink: 0;
	}

	.track-image-placeholder {
		width: 64px;
		height: 64px;
		border-radius: calc(var(--radius) - 4px);
		background-color: color-mix(in oklch, var(--muted) 50%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.track-details {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.track-name {
		font-size: 1rem;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-artist {
		font-size: 0.875rem;
		color: var(--muted-foreground);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.track-year {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		font-weight: 500;
	}

	.current-track-hidden {
		opacity: 0.7;
	}

	.placement-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.placement-buttons {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		width: 100%;
		min-width: 0;
	}

	.placement-button {
		flex: 1;
		min-width: 120px;
	}

	@media (max-width: 640px) {
		.placement-dialog {
			max-width: calc(100% - 2rem);
			width: calc(100% - 2rem);
		}

		.track-display {
			flex-direction: column;
			text-align: center;
		}

		.track-details {
			align-items: center;
		}

		.placement-buttons {
			flex-direction: column;
		}

		.placement-button {
			width: 100%;
		}
	}
</style>

