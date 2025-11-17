<script lang="ts">
	import type { YearMarker } from '$lib/types/tunetap.js';

	let {
		markers,
		width = 100
	}: {
		markers: YearMarker[];
		width?: number;
	} = $props();
</script>

<div class="timeline-axis-wrapper">
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
</div>

<style>
	.timeline-axis-wrapper {
		position: relative;
		min-width: 100%; /* At least 100% wide, but can expand */
		padding-left: 40px;
		padding-right: 40px;
		box-sizing: border-box;
		/* No overflow set - parent .timeline-wrapper handles scrolling */
	}

	.timeline-axis-container {
		position: relative;
		height: 40px;
		margin-bottom: 0.25rem;
		min-width: 100%; /* Ensure it's at least as wide as wrapper content */
	}

	.timeline-line {
		position: absolute;
		top: 15px;
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
		height: 15px;
		background-color: var(--border);
		margin-bottom: 2px;
	}

	.marker.decade .marker-line {
		height: 20px;
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
		.timeline-axis-wrapper {
			padding-left: 35px;
			padding-right: 35px;
		}

		.timeline-axis-container {
			height: 35px;
			margin-bottom: 0.2rem;
		}

		.timeline-line {
			top: 12px;
		}

		.marker-line {
			height: 12px;
		}

		.marker.decade .marker-line {
			height: 18px;
		}

		.marker-label {
			font-size: 0.625rem;
		}

		.marker.decade .marker-label {
			font-size: 0.75rem;
		}
	}
</style>

