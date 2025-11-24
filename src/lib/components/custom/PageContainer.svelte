<!--
@component

A flexible page container component with animated gradient background and responsive layout.
Provides consistent spacing and layout for all pages.

Usage:
  ```html
  <PageContainer>
    <div class="content">
      <h1>Welcome</h1>
      <p>Your page content here</p>
    </div>
  </PageContainer>
  ```
-->
<script lang="ts">
	import AnimatedGradient from './AnimatedGradient.svelte';

	let {
		class: className = '',
		children,
		maxWidth = true
	} = $props<{
		class?: string;
		children: import('svelte').Snippet;
		maxWidth?: boolean;
	}>();
	let mouseX = $state(50);
	let mouseY = $state(50);
	let containerElement: HTMLDivElement | null = $state(null);

	function handleMouseMove(event: MouseEvent) {
		mouseX = (event.clientX / window.innerWidth) * 100;
		mouseY = (event.clientY / window.innerHeight) * 100;
	}
</script>

<div
	class="page-container {className}"
	bind:this={containerElement}
	onmousemove={handleMouseMove}
	role="presentation"
>
	<AnimatedGradient {mouseX} {mouseY} />
	<div class="content-layer" class:max-width={maxWidth}>
		{@render children()}
	</div>
</div>

<style>
	.page-container {
		position: relative;
		width: 100%;
		max-width: 100vw;
		overflow-x: hidden;
		height: 100vh;
		overflow-y: hidden;
		display: flex;
		flex-direction: column;
	}

	.content-layer {
		position: relative;
		z-index: 1;
		padding: 2rem;
		width: 100%;
		box-sizing: border-box;
		flex: 1 1 0;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		max-height: 100%;
	}

	.content-layer.max-width {
		max-width: 1200px;
		margin: 0 auto;
	}
</style>
