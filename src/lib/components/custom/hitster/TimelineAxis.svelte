<script lang="ts">
	import type { YearMarker } from '$lib/types/hitster.js';

	let {
		markers,
		width = 100
	}: {
		markers: YearMarker[];
		width?: number;
	} = $props();
</script>

<div class="timeline-axis-container" style="width: {width}%">
	<div class="timeline-line"></div>
	<div class="markers-container">
		{#each markers as marker}
			<div
				class="marker"
				class:decade={marker.isDecade}
				style="left: {marker.position}%"
			>
				<div class="marker-line"></div>
				<div class="marker-label">{marker.year}</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.timeline-axis-container {
		position: relative;
		height: 60px;
		margin-bottom: 1rem;
	}

	.timeline-line {
		position: absolute;
		top: 20px;
		left: 0;
		right: 0;
		height: 2px;
		background-color: var(--border);
	}

	.markers-container {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.marker {
		position: absolute;
		top: 0;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.marker-line {
		width: 2px;
		height: 20px;
		background-color: var(--border);
		margin-bottom: 4px;
	}

	.marker.decade .marker-line {
		height: 30px;
		background-color: var(--foreground);
		width: 3px;
	}

	.marker-label {
		font-size: 0.75rem;
		color: var(--muted-foreground);
		white-space: nowrap;
		font-weight: 500;
	}

	.marker.decade .marker-label {
		font-weight: 700;
		color: var(--foreground);
		font-size: 0.875rem;
	}

	@media (max-width: 768px) {
		.timeline-axis-container {
			height: 50px;
		}

		.marker-label {
			font-size: 0.625rem;
		}

		.marker.decade .marker-label {
			font-size: 0.75rem;
		}
	}
</style>

