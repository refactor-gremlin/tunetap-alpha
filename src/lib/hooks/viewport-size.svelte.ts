import { MediaQuery } from 'svelte/reactivity';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

class IsMobile extends MediaQuery {
	constructor() {
		super(`max-width: ${MOBILE_BREAKPOINT - 1}px`);
	}
}

class IsTablet extends MediaQuery {
	constructor() {
		super(`(min-width: ${MOBILE_BREAKPOINT}px) and (max-width: ${TABLET_BREAKPOINT - 1}px)`);
	}
}

class IsDesktop extends MediaQuery {
	constructor() {
		super(`min-width: ${TABLET_BREAKPOINT}px`);
	}
}

export class ViewportSizeDetector {
	private isMobile = new IsMobile();
	private isTablet = new IsTablet();
	private isDesktop = new IsDesktop();

	get current(): ViewportSize {
		if (this.isMobile.current) return 'mobile';
		if (this.isTablet.current) return 'tablet';
		return 'desktop';
	}
}
