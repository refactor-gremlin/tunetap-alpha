<!--
@component

A standardized error display component for use within svelte:boundary failed snippets.

Usage:
  ```html
  <svelte:boundary onerror={createBoundaryErrorHandler('Context')}>
    {#snippet failed(error, reset)}
      <ErrorState {error} {reset} />
    {/snippet}
    ...
  </svelte:boundary>
  ```
-->
<script lang="ts">
	import { Button } from '$lib/components/shadncn-ui/button/index.js';

	let { error, reset }: { error: unknown; reset: () => void } = $props();

	const errorMessage = $derived(
		error instanceof Error ? error.message : String(error || 'Unknown error')
	);
</script>

<div
	class="error-state rounded-lg border border-dashed border-destructive/50 bg-destructive/10 p-4 text-center"
>
	<p class="mb-2 text-sm font-medium text-destructive">
		{errorMessage}
	</p>
	<Button
		variant="link"
		size="sm"
		onclick={reset}
		class="h-auto p-0 text-xs text-destructive underline hover:no-underline"
	>
		Try again
	</Button>
</div>
