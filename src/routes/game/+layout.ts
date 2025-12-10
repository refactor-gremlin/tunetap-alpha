import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { hasValidSession, hasLegacySession } from '$lib/game/GameSession.store';
import type { LayoutLoad } from './$types';

// Disable SSR for game routes - the game is entirely client-side
export const ssr = false;

export const load: LayoutLoad = ({ url }) => {
	// Only run session checks on the client
	if (!browser) {
		return { hasSession: false };
	}

	const isSetupRoute = url.pathname === '/game/setup';
	const hasSession = hasValidSession();
	const hasLegacy = hasLegacySession();

	// Allow access to setup route without session (that's where new games start)
	if (isSetupRoute) {
		return { hasSession, hasLegacy };
	}

	// For other game routes, require a valid session
	if (!hasSession && !hasLegacy) {
		redirect(303, '/playlist');
	}

	return { hasSession, hasLegacy };
};

