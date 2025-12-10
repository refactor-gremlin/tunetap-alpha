<!--
@component

URL input field with load button for entering Spotify playlist URLs.

Usage:
  ```html
  <PlaylistUrlInput
    bind:value={playlistUrl}
    disabled={isProcessing}
    onSubmit={handleSubmit}
  />
  ```
-->
<script lang="ts">
	import { Button } from '$lib/components/shadncn-ui/button/index.js';
	import { Input } from '$lib/components/shadncn-ui/input/index.js';

	interface Props {
		value: string;
		disabled?: boolean;
		onSubmit: () => void;
	}

	let { value = $bindable(), disabled = false, onSubmit }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && value.trim() && !disabled) {
			onSubmit();
		}
	}
</script>

<div class="input-group">
	<Input
		type="url"
		bind:value
		placeholder="https://open.spotify.com/playlist/..."
		{disabled}
		onkeydown={handleKeydown}
	/>
	<Button onclick={onSubmit} disabled={!value.trim() || disabled}>
		{disabled ? 'Processing…' : 'Load Playlist'}
	</Button>
</div>

<style>
	.input-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 500px;
	}
</style>
