import { sentrySvelteKit } from "@sentry/sveltekit";
import tailwindcss from '@tailwindcss/vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sentrySvelteKit({
        sourceMapsUploadOptions: {
            org: "jens-5f",
            project: "javascript-sveltekit"
        }
    }), tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		watch: {
			ignored: ['**/prisma/**']
		}
	},
	ssr: {
		noExternal: []
	}
});