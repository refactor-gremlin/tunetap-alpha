# AGENTS.md - TuneTap Project Guide

This document provides essential context for AI agents working on the TuneTap project. It covers architecture, patterns, conventions, and common tasks.

## Project Overview

TuneTap is a web-based music knowledge game built with SvelteKit and Svelte 5. Players arrange songs from Spotify playlists in chronological order based on their release dates. The game features:

- **Spotify Integration**: Load public Spotify playlists
- **Release Date Lookup**: Automatic fetching from MusicBrainz API
- **Audio Playback**: Plays previews from Spotify or YouTube
- **Smart Caching**: SQLite database caches release dates
- **Queue System**: Handles MusicBrainz API rate limits
- **Multiplayer Support**: Multiple players compete to arrange tracks correctly

## Tech Stack

- **Framework**: SvelteKit 2.x with Svelte 5 (using runes)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.x
- **Database**: SQLite with Prisma ORM
- **State Management**: Runed (Svelte 5 runes utilities)
- **UI Components**: Custom components built with bits-ui
- **Form Handling**: SvelteKit Superforms
- **Music APIs**:
  - Spotify URL Info (playlist fetching)
  - YouTube SR (audio source finding)
  - MusicBrainz API (release date lookup)

## Project Structure

```
tunetap-alpha/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── custom/          # Custom game components
│   │   │   │   └── tunetap/     # Game-specific components
│   │   │   └── shadncn-ui/      # UI component library
│   │   ├── server/              # Server-side utilities
│   │   │   ├── db.ts            # Prisma database client
│   │   │   ├── musicbrainz-queue.ts  # API queue system
│   │   │   └── playlist.server.ts    # Playlist processing
│   │   ├── types/               # TypeScript type definitions
│   │   │   ├── tunetap.ts       # Game-specific types
│   │   │   └── ...
│   │   └── utils/               # Utility functions
│   │       └── timeline.ts      # Timeline calculation utilities
│   ├── routes/
│   │   ├── +page.svelte         # Homepage
│   │   ├── playlist2/           # Playlist input page
│   │   │   ├── +page.svelte
│   │   │   └── data.remote.ts   # Remote functions
│   │   └── game2/               # Main game page
│   │       ├── +page.svelte
│   │       └── musicbrainz.remote.ts  # MusicBrainz queries
│   └── app.css                  # Global styles
├── prisma/
│   └── schema.prisma            # Database schema
└── static/                      # Static assets
```

## Key Concepts

### Game Mechanics

The game follows a turn-based multiplayer format:

1. **Setup Phase**: Players configure names and game settings
2. **Playing Phase**: Current player listens to a track and places it on their timeline
3. **Round End Phase**: Results are shown, scores updated
4. **Game End Phase**: Winner is determined (first to 10 correct placements)

**Placement Types**:

- `before`: Place track before a reference track
- `after`: Place track after a reference track
- `same`: Place track in the same year as a reference

**Scoring**: Players must maintain consecutive correct placements from the start. Score resets to 0 if order is broken.

### Data Flow

1. **Playlist Loading**: User provides Spotify playlist URL
2. **Track Fetching**: Server fetches tracks via Spotify API
3. **Audio Source Finding**: YouTube/Spotify preview URLs are located
4. **Release Date Lookup**: MusicBrainz API provides first release dates
5. **Caching**: Release dates cached in SQLite for future use
6. **Game State**: Client-side state manages players, tracks, and game flow

### State Management Patterns

The project uses Svelte 5 runes extensively:

- `$state`: Reactive state variables
- `$derived`: Computed values
- `$effect`: Side effects and reactivity

**Runed Utilities** (from `runed` package):

- `useInterval`: Interval management with cleanup
- `PersistedState`: Browser storage with cross-tab sync
- `Debounced`: Debounced reactive state
- `FiniteStateMachine`: Type-safe state machines
- `useEventListener`: Automatic event listener cleanup

### Remote Functions Pattern

SvelteKit remote functions are used for server-side operations:

**Query Functions** (data fetching):

```typescript
export const fetchFirstReleaseDate = query(
	z.object({
		trackName: z.string(),
		artistName: z.string()
	}),
	async ({ trackName, artistName }) => {
		// Server-side logic
		return result;
	}
);
```

**Usage in Components**:

```svelte
{#await fetchFirstReleaseDate({ trackName, artistName })}
	<Loading />
{:then date}
	<Display {date} />
{:catch error}
	<ErrorDisplay {error} />
{/await}
```

**Critical Rules**:

- Always use direct `#await` blocks in templates
- Never wrap queries in `$derived.by()` or access `.current`
- Place `svelte:boundary` inside conditionals
- Always provide explicit pending states

## Component Architecture

### Game Components (`src/lib/components/custom/tunetap/`)

- **UnifiedGameHeader**: Player banner with compact scores
- **CurrentTrackCard**: Displays current track being played
- **AllPlayersTimelines**: Shows all player timelines with placement controls
- **PlayerTimeline**: Individual player timeline visualization
- **HorizontalTimeline**: Timeline axis with year markers
- **PlacementControls**: Controls for placing tracks
- **PlacementConfirmationDialog**: Confirms track placement
- **RoundResultModal**: Shows round results
- **GameEndScreen**: End game screen with winner
- **PlayerSetup**: Initial player configuration
- **TrackCard**: Individual track display card

### Component Patterns

**Props**: Use TypeScript interfaces for props
**Events**: Use callback props (e.g., `onPlaceBefore`, `onNextTurn`)
**State**: Prefer local `$state` over prop drilling
**Styling**: Tailwind CSS classes, scoped styles when needed

## Database Schema

The Prisma schema includes:

- **ReleaseDateCache**: Caches MusicBrainz release date lookups
  - `trackName`: Track name
  - `artistName`: Artist name
  - `releaseDate`: Cached release date (YYYY-MM-DD)
  - `createdAt`: Cache timestamp

## API Integration

### MusicBrainz Queue System

The project implements a queue system to respect MusicBrainz API rate limits:

- Sequential processing of requests
- Real-time queue size tracking
- Error handling and retry logic
- Batch cache checking before API calls

**Usage**:

```typescript
import { musicBrainzQueue } from '$lib/server/musicbrainz-queue';

// Enqueue a request
const date = await musicBrainzQueue.enqueue(trackName, artistName);

// Check queue size
const size = musicBrainzQueue.getPendingCount();
```

### Spotify Integration

- Uses `spotify-url-info` package
- Fetches playlist tracks and metadata
- Extracts preview URLs when available

### YouTube Integration

- Uses `youtube-sr` package
- Finds audio sources for tracks
- Falls back to YouTube when Spotify preview unavailable

## Timeline Utilities

The `timeline.ts` utility provides:

- `getReleaseYear(track)`: Extract year from release date
- `getYearRange(tracks)`: Calculate min/max years
- `calculateTimelinePosition()`: Calculate position percentage
- `generateYearMarkers()`: Generate timeline axis markers
- `validateTimelineOrder()`: Validate chronological order

## Common Tasks

### Adding a New Game Component

1. Create component in `src/lib/components/custom/tunetap/`
2. Use TypeScript for props
3. Follow existing component patterns
4. Use Tailwind for styling
5. Export from component file

### Adding a Remote Function

1. Create `.remote.ts` file in route directory
2. Import `query`, `command`, or `form` from `$app/server`
3. Define Zod schema for validation
4. Implement async handler
5. Use in component with `#await` blocks

### Modifying Game Logic

Game logic is primarily in `src/routes/game2/+page.svelte`:

- `validatePlacement()`: Validates track placement
- `placeTrack()`: Handles track placement and scoring
- `selectRandomTrack()`: Selects next track
- `nextTurn()`: Advances to next player

### Adding Database Fields

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name migration_name`
3. Update TypeScript types if needed
4. Update server-side code using the field

## Code Style Guidelines

- **Formatting**: Prettier with Svelte plugin
- **Linting**: ESLint with Svelte plugin
- **TypeScript**: Strict mode enabled
- **Svelte 5**: Use runes (`$state`, `$derived`, `$effect`)
- **Components**: PascalCase for component names
- **Files**: kebab-case for file names

## Testing & Development

### Running Development Server

```bash
npm run dev
```

### Type Checking

```bash
npm run check
```

### Database Management

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# View database
npx prisma studio
```

## Important Notes

1. **Session Storage**: Game state is passed via `sessionStorage` between routes
2. **Audio Playback**: Uses HTML5 Audio API, manages playback state manually
3. **Release Dates**: Format is YYYY-MM-DD, extracted as years for timeline
4. **Score Calculation**: Based on consecutive correct placements from start
5. **Win Condition**: First player to reach 10 correct placements wins
6. **Component Naming**: Game components are in `tunetap/` directory

## Related Documentation

- `.cursor/rules/sveltekit-remote-functions.mdc`: Remote functions guide
- `.cursor/rules/runed-library-utilities.mdc`: Runed utilities guide
- `README.md`: Project overview and setup

## Common Patterns

### Loading Data with Remote Functions

```svelte
<script lang="ts">
	import { getData } from './data.remote';

	let condition = $state(true);
</script>

{#if condition}
	<svelte:boundary>
		{#await getData({ param: value })}
			<LoadingSpinner />
		{:then data}
			<DisplayComponent {data} />
		{:catch error}
			<ErrorMessage {error} />
		{/await}
	</svelte:boundary>
{/if}
```

### Managing Game State

```typescript
let players = $state<Player[]>([]);
let currentPlayerIndex = $state(0);
let gameStatus = $state<GameStatus>('setup');

const currentPlayer = $derived(players[currentPlayerIndex]);
const winner = $derived(players.find((p) => p.score >= 10));
```

### Timeline Calculations

```typescript
import { getReleaseYear, getYearRange, calculateTimelinePosition } from '$lib/utils/timeline';

const year = getReleaseYear(track);
const range = getYearRange(tracks);
const position = calculateTimelinePosition(year, range.minYear, range.maxYear);
```

---

This guide should help AI agents understand the project structure, patterns, and conventions. For specific implementation details, refer to the actual code files and inline documentation.
