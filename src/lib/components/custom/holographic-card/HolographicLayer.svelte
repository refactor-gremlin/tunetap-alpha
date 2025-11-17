<script lang="ts">
	import { getContext } from 'svelte';
	import type { Spring } from 'svelte/motion';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { readable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { prefersReducedMotion } from 'svelte/motion';
	import { holographic } from './holographicstate.svelte';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/**
		 * The depth of the layer in 3D space (positive values move it forward).
		 * @default 0
		 */
		depth?: number;
		/**
		 * Additional CSS classes for the layer.
		 */
		class?: string;
		/**
		 * The content to render inside the layer.
		 */
		children?: any;
		/**
		 * If true, applies a holographic shine effect directly to the text.
		 * @default false
		 */
		shine?: boolean;
		/**
		 * If true, applies a holographic shine effect to the background of the layer.
		 * @default false
		 */
		shineBackground?: boolean;
		/**
		 * An array of color strings to define the shine palette.
		 */
		shinePalette?: string[];
		/**
		 * If true, the shine effect will have a subtle idle animation.
		 * @default false
		 */
		idleShimmer?: boolean;
	}

	let {
		depth = 0,
		shine = false,
		shineBackground = false,
		shinePalette,
		idleShimmer = false,
		class: className,
		children,
		...restProps
	}: Props = $props();

	// --- NEW: Idle animation logic encapsulated within the layer ---
	let idleTime = readable(0, (set) => {
		if (!idleShimmer || !browser || prefersReducedMotion.current || !holographic.enabled) {
			set(0);
			return () => {};
		}

		let frameId: number;
		const loop = (time: number) => {
			set(time / 5000); // Control animation speed
			frameId = requestAnimationFrame(loop);
		};
		frameId = requestAnimationFrame(loop);

		return () => cancelAnimationFrame(frameId);
	});

	// Retrieve the shared spring from the parent card
	const hologramSpring: Spring<{ x: number; y: number; rotation: number; intensity: number }> =
		getContext('holographic-spring');

	// --- NEW: A derived state that blends idle and interactive effects ---
	let shineState = $derived.by(() => {
		const interactive = hologramSpring.current;
		const time = $idleTime * 2; // Speed up the animation slightly

		// More complex, organic wave-like motion for the idle shimmer
		const idleX = 50 + Math.sin(time * 0.9) * 20 + Math.cos(time * 0.4) * 10;
		const idleY = 50 + Math.cos(time * 1.2) * 20 + Math.sin(time * 0.6) * 10;
		const idleRotation = Math.sin(time * 0.7) * 15 + Math.cos(time * 0.3) * 5;

		// When not interacting, use the idle animation. Otherwise, use the interactive state.
		// This creates a smooth handoff.
		if (interactive.intensity > 0.01) { // Use a small threshold to avoid jitter
			return interactive;
		}
		return {
			x: idleX,
			y: idleY,
			rotation: idleRotation
		};
	});

	// A more vibrant palette for the text shine effect
	const activeShinePalette =
		shinePalette || ['#84fab0', '#8fd3f4', '#a18cd1', '#fbc2eb', '#84fab0'];

	// Create the 3D transform for this layer
	let layerTransform = $derived(holographic.enabled ? `translateZ(${depth}px)` : 'none');

	// --- Shine Effect Logic ---
	let shineStyle = $derived(
		holographic.enabled && (shine || shineBackground)
			? `background-image: linear-gradient(${
					shineState.rotation
				}deg, ${activeShinePalette.join(
					', '
				)}); background-position: ${shineState.x}% ${
					shineState.y
				}%; background-size: 200% 200%;`
			: ''
	);

	let shineClasses = $derived(holographic.enabled && shine ? 'bg-clip-text text-transparent' : '');
</script>

<div
	class={cn('relative', className, shineClasses)}
	style="{layerTransform}; {shineStyle}"
	{...restProps}
>
	<!-- The actual content of the layer -->
	{@render children()}
</div> 