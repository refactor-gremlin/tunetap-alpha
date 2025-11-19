import type { Track } from '$lib/types.js';
import type { YearMarker } from '../types/tunetap.js';

/**
 * Get the release year from a track's firstReleaseDate
 */
export function getReleaseYear(track: Track): number | null {
	if (!track.firstReleaseDate) return null;
	const year = parseInt(track.firstReleaseDate.split('-')[0]);
	return isNaN(year) ? null : year;
}

/**
 * Calculate the minimum and maximum years from a set of tracks
 * Always returns a global span (1950-current year) with optional padding
 */
export function getYearRange(tracks: Track[]): { minYear: number; maxYear: number } | null {
	const years = tracks.map(getReleaseYear).filter((year): year is number => year !== null);

	if (years.length === 0) return null;

	const actualMinYear = Math.min(...years);
	const actualMaxYear = Math.max(...years);
	const currentYear = new Date().getFullYear();

	// Global bounds: clamp to 1950 as lower bound, but allow future years for upper bound
	const GLOBAL_MIN_YEAR = 1950;
	const GLOBAL_MAX_YEAR = currentYear;

	// Calculate padded range with ±5 years padding around actual range
	const padding = 5;
	const paddedMinYear = Math.max(GLOBAL_MIN_YEAR, actualMinYear - padding);
	// Allow maxYear to exceed current year if tracks are from the future
	const paddedMaxYear = Math.max(GLOBAL_MAX_YEAR, actualMaxYear + padding);

	// If the actual range is very small or empty, use global bounds but ensure maxYear covers all tracks
	if (actualMaxYear - actualMinYear < 10) {
		return {
			minYear: GLOBAL_MIN_YEAR,
			maxYear: Math.max(GLOBAL_MAX_YEAR, actualMaxYear + padding)
		};
	}

	// Otherwise use padded range, ensuring minYear respects global bounds but maxYear can exceed current year
	return {
		minYear: Math.max(GLOBAL_MIN_YEAR, paddedMinYear),
		maxYear: paddedMaxYear // Already ensures it's at least as high as actualMaxYear + padding
	};
}

/**
 * Calculate the position percentage for a track on the timeline
 * @param trackYear - The year of the track
 * @param minYear - Minimum year in the range
 * @param maxYear - Maximum year in the range
 * @returns Position as percentage (0-100)
 */
export function calculateTimelinePosition(
	trackYear: number,
	minYear: number,
	maxYear: number
): number {
	if (maxYear === minYear) return 50; // Center if all same year
	return ((trackYear - minYear) / (maxYear - minYear)) * 100;
}

/**
 * Generate year markers for the timeline axis
 * @param minYear - Minimum year
 * @param maxYear - Maximum year
 * @param interval - Interval between markers (default: 5 years)
 * @returns Array of year markers with positions
 */
export function generateYearMarkers(
	minYear: number,
	maxYear: number,
	interval: number = 5
): YearMarker[] {
	const markers: YearMarker[] = [];
	const range = maxYear - minYear;

	// For very small ranges, just show min and max years
	if (range <= 2) {
		markers.push({
			year: minYear,
			position: 0,
			isDecade: minYear % 10 === 0
		});
		if (maxYear !== minYear) {
			markers.push({
				year: maxYear,
				position: 100,
				isDecade: maxYear % 10 === 0
			});
		}
		return markers;
	}

	// Determine interval based on range
	let actualInterval = interval;
	if (range > 100) {
		actualInterval = 10; // Use decades for large ranges
	} else if (range > 50) {
		actualInterval = 5; // Use 5-year intervals for medium ranges
	} else if (range > 20) {
		actualInterval = 5; // Use 5-year intervals for medium-small ranges
	} else if (range > 10) {
		actualInterval = 2; // Use 2-year intervals for small ranges
	} else {
		actualInterval = 1; // Use 1-year intervals for very small ranges
	}

	// Round minYear down to nearest interval
	const startYear = Math.floor(minYear / actualInterval) * actualInterval;
	// Round maxYear up to nearest interval
	const endYear = Math.ceil(maxYear / actualInterval) * actualInterval;

	// Generate markers, but filter out duplicates and ensure minimum spacing
	const seenPositions = new Set<number>();
	const minSpacing = 5; // Minimum 5% spacing between markers

	for (let year = startYear; year <= endYear; year += actualInterval) {
		// Only include markers within or at the edges of the range
		if (year < minYear - actualInterval || year > maxYear + actualInterval) {
			continue;
		}

		const isDecade = year % 10 === 0;
		let position = calculateTimelinePosition(year, minYear, maxYear);

		// Clamp position to valid range
		position = Math.max(0, Math.min(100, position));

		// Check if this position is too close to an existing marker
		let tooClose = false;
		for (const seenPos of seenPositions) {
			if (Math.abs(position - seenPos) < minSpacing) {
				tooClose = true;
				break;
			}
		}

		if (!tooClose) {
			seenPositions.add(position);
			markers.push({ year, position, isDecade });
		}
	}

	// Sort by year to ensure correct order
	return markers.sort((a, b) => a.year - b.year);
}

/**
 * Validate if tracks are in correct chronological order
 */
export function validateTimelineOrder(tracks: Track[]): boolean {
	for (let i = 0; i < tracks.length - 1; i++) {
		const year1 = getReleaseYear(tracks[i]);
		const year2 = getReleaseYear(tracks[i + 1]);
		if (year1 === null || year2 === null || year1 > year2) {
			return false;
		}
	}
	return true;
}
