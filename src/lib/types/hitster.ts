import type { Track } from '../types.js';

export interface Player {
	name: string;
	score: number;
	timeline: Track[];
}

export interface PlacementResult {
	correct: boolean;
	correctPosition: number;
}

export type GameStatus = 'setup' | 'playing' | 'roundEnd' | 'gameEnd';
export type PlacementType = 'before' | 'after' | 'same';

export interface YearMarker {
	year: number;
	position: number; // Percentage (0-100)
	isDecade: boolean;
}

