<script lang="ts">
	import DarkModeToggle from './DarkModeToggle.svelte';

	let {
		title = undefined,
		rightActions,
		class: className = ''
	}: {
		title?: string;
		rightActions?: import('svelte').Snippet;
		class?: string;
	} = $props();
</script>

<header class="page-header {className}">
	<div class="header-left">
		<DarkModeToggle />
	</div>
	{#if title}
		<h1 class="page-title">{title}</h1>
	{/if}
	{#if rightActions}
		<div class="header-right">
			{@render rightActions()}
		</div>
	{/if}
</header>

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		position: relative;
		min-height: 3rem;
	}

	.header-left {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		align-items: center;
		z-index: 10;
	}

	.page-title {
		font-size: 2.5rem;
		margin: 0;
		text-align: center;
		flex: 1;
		font-weight: 600;
	}

	.header-right {
		position: absolute;
		top: 0;
		right: 0;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		z-index: 10;
	}
</style>
