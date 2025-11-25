import { sentrySvelteKit } from '@sentry/sveltekit';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: 'jens-5f',
				project: 'javascript-sveltekit'
			}
		}),
		tailwindcss(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			includeAssets: ['robots.txt'],
			manifest: {
				name: 'TuneTap',
				short_name: 'TuneTap',
				description: 'Arrange playlist tracks chronologically in a competitive music trivia game.',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#09090b',
				theme_color: '#09090b',
				icons: [
					{
						src: '/tunetap-icon.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
						purpose: 'any'
					},
					{
						src: '/tunetap-icon.svg',
						sizes: '512x512',
						type: 'image/svg+xml',
						purpose: 'maskable'
					}
				]
			},
			devOptions: {
				enabled: !isProd,
				suppressWarnings: !isProd
			}
		}),
		sveltekit(),
		devtoolsJson()
	],
	server: {
		watch: {
			ignored: ['**/prisma/**']
		}
	},
	ssr: {
		external: ['@prisma/client', '.prisma/client'],
		noExternal: []
	}
});