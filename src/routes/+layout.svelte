<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import PageContainer from '$lib/components/custom/PageContainer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{@html `
		<script>
			const isBrowser = typeof localStorage !== 'undefined';
			const getThemePreference = () => {
				if (isBrowser && localStorage.getItem('theme')) {
					return localStorage.getItem('theme');
				}
				return window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark' : 'light';
			};
			const isDark = getThemePreference() === 'dark';
			document.documentElement.classList[isDark ? 'add' : 'remove']('dark');
			if (isBrowser) {
				const observer = new MutationObserver(() => {
					const isDark = document.documentElement.classList.contains('dark');
					localStorage.setItem('theme', isDark ? 'dark' : 'light');
				});
				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ['class']
				});
			}
		</script>
	`}
</svelte:head>

<PageContainer>
	<ModeWatcher />
	{@render children()}
</PageContainer>
