import * as Sentry from '@sentry/sveltekit';
import { logger } from '$lib/utils/logger';

/**
 * Formats an unknown error into a string message.
 * Use this in `failed` snippets where error is of type `unknown`.
 */
export function formatError(error: unknown): string {
	if (error && typeof error === 'object' && 'message' in error) {
		const message = (error as { message?: unknown }).message;
		return typeof message === 'string' ? message : 'Unknown error';
	}
	return 'Unknown error';
}

/**
 * Rethrows an error to delegate handling to svelte:boundary's `failed` snippet.
 * Use this in `{:catch}` blocks to unify error handling.
 *
 * @example
 * ```svelte
 * {:catch error}
 *   {rethrow(error)}
 * {/await}
 * ```
 */
export function rethrow(error: unknown): never {
	throw error;
}

/**
 * Creates a standardized error handler for svelte:boundary components.
 *
 * This handler:
 * - Reports errors to Sentry with context tags
 * - Logs errors in development mode
 * - Can be reused across all boundaries for consistent error reporting
 *
 * @param context - Context identifier for the boundary (e.g., 'LadenPage', 'PakkettenTable')
 * @returns Error handler function for use with svelte:boundary onerror prop
 *
 * @example
 * ```svelte
 * <svelte:boundary onerror={createBoundaryErrorHandler('LadenPage')}>
 *   {#snippet failed(error, reset)}
 *     <!-- Error UI -->
 *   {/snippet}
 *   <!-- content -->
 * </svelte:boundary>
 * ```
 */
export function createBoundaryErrorHandler(context: string) {
	return (error: unknown, _reset?: () => void) => {
		// Reset parameter available but not used - error reporting only
		void _reset;

		// Convert unknown error to Error for Sentry
		const errorInstance = error instanceof Error ? error : new Error(String(error));

		// Report to Sentry with context tag
		Sentry.captureException(errorInstance, {
			tags: {
				boundary: context,
				errorBoundary: 'true'
			}
		});

		// Log in development mode
		if (import.meta.env.DEV) {
			logger.error(context, 'svelte:boundary caught error', { error: errorInstance });
		}
	};
}
