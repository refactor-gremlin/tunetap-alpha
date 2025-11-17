<script lang="ts">
	import type { Track } from '$lib/types.js';
	import * as Dialog from '$lib/components/shadncn-ui/dialog/index.js';
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

	let {
		open = $bindable(false),
		currentTrack,
		referenceTrack,
		placementType,
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		currentTrack: Track | null;
		referenceTrack: Track | null;
		placementType: 'before' | 'after';
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="placement-confirmation-dialog">
		<Dialog.Header>
			<Dialog.Title>Confirm Placement</Dialog.Title>
		</Dialog.Header>
		<div class="confirmation-content">
			{#if currentTrack && referenceTrack}
				<p class="confirmation-message">
					Are you sure you want to place
					<strong class="track-name">"{currentTrack.name}"</strong>
					{placementType === 'before' ? 'before' : 'after'}
					<strong class="track-name">"{referenceTrack.name}"</strong>?
				</p>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={onCancel}>
				Cancel
			</Button>
			<Button onclick={onConfirm}>
				Confirm
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.placement-confirmation-dialog {
		max-width: 450px;
	}

	.confirmation-content {
		padding: 1rem 0;
	}

	.confirmation-message {
		margin: 0;
		font-size: 1rem;
		color: var(--foreground);
		line-height: 1.6;
		text-align: center;
	}

	.track-name {
		color: var(--primary);
		font-weight: 600;
	}
</style>

