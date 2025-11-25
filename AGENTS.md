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
│   │       ├── timeline.ts      # Timeline calculation utilities
│   │       └── error-boundary.ts # Error handling utilities
│   ├── routes/
│   │   ├── (app)/               # Authenticated routes
│   │   ├── (auth)/              # Public/Auth routes
│   │   ├── +page.svelte         # Homepage
│   │   ├── playlist2/           # Playlist input page
│   │   │   ├── +page.svelte
│   │   │   └── data.remote.ts   # Remote functions
│   │   └── game2/               # Main game page
│   │       ├── +page.svelte
│   │       └── musicbrainz.remote.ts  # MusicBrainz queries
│   ├── features/                # Feature-based organization
│   │   └── [feature-name]/
│   │       ├── components/      # Feature-specific UI
│   │       ├── state/           # OOP Context classes
│   │       └── modals/          # Feature-specific modals
│   └── app.css                  # Global styles
├── prisma/
│   └── schema.prisma            # Database schema
└── static/                      # Static assets
```

## Game Mechanics

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

---

## Svelte 5 & Runes

### Svelte 5 Runes Exclusively
- Use `$state`, `$derived`/`$derived.by()`, `$effect`, and `$props` exclusively.
- **Forbidden:** Legacy `export let`, `$:`, and `onMount` (unless absolutely necessary for library compat).

### `$derived` vs `$derived.by`

**Use `$derived`** for single-line expressions:
```typescript
const double = $derived(count * 2);
```

**Use `$derived.by`** for complex logic, loops, or early returns:
```typescript
const filtered = $derived.by(() => {
  if (!active) return [];
  return list.filter(i => i.score > 50);
});
```

### `$effect`
- Avoid `$effect` for derived state (use `$derived`).
- Use `$effect` only for side effects (logging, analytics, direct DOM manipulation).

### Typing Props
```svelte
<script lang="ts">
  interface Props {
    data: MyData;
    optional?: string;
    onChange: (val: string) => void;
  }

  let { data, optional = 'default', onChange }: Props = $props();
</script>
```

### Typing Snippets
```typescript
import type { Snippet } from 'svelte';

interface Props {
  header: Snippet;
  row: Snippet<[Item]>;
}
```

### Event Handling
```typescript
// ✅ Svelte 5: Direct property binding
<button onclick={handleClick}>Click me</button>

// ❌ Svelte 4: Old event directive (don't use)
<button on:click={handleClick}>Click me</button>
```

### Snippets vs Slots
Prefer `{@render children()}` over `<slot>`:
### Interaction on Structural Containers
- Never attach keyboard listeners directly to non-interactive wrappers like timeline reels or scroll containers; Svelte enforces this via `a11y_no_noninteractive_element_interactions`.
- If user interaction needs to be detected (e.g., to hide swipe hints), either:
  - Move the keyboard detection to `svelte:window` and guard against inputs, or
  - Convert the element into a true interactive control (add `role`, `tabindex`, and keyboard semantics).
- Scroll/touch detection can remain on the container via passive listeners registered in a `$effect`, with cleanup when the element unmounts.

```svelte
<script lang="ts">
  let { children } = $props();
</script>

<div class="card">
  {@render children()}
</div>
```

---

## Data Loading & Remote Functions

### Standard Loading Pattern
**NEVER** load data in `$state` classes. Always load in the component template.

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { getItemDetails } from './data.remote';
  import { createBoundaryErrorHandler, rethrow } from "$lib/utils/error-boundary";

  const id = $derived(Number(page.params.id) || 0);
</script>

<svelte:boundary onerror={createBoundaryErrorHandler('ComponentName')}>
  {#snippet failed(error, reset)}
    <div class="error-container">
      <p>Could not load data.</p>
      <button onclick={reset}>Retry</button>
    </div>
  {/snippet}

  {#await getItemDetails({ id })}
    <Skeleton />
  {:then data}
    <ItemView {data} />
  {:catch error}
    {rethrow(error)}
  {/await}
</svelte:boundary>
```

### Critical Data Loading Rules
1. **Rethrow Errors:** `svelte:boundary` does not catch Promise rejections automatically. Use `rethrow(error)` in `{:catch}` to propagate errors.
2. **No Derived Queries:** Do not wrap query calls in `$derived`. Call them directly in markup.
3. **Boundary Placement:** Put boundaries *inside* logical checks so empty states don't trigger errors.
4. **Always include `failed` snippet** for error UI with retry button.

### Shorthand Without Pending State
When data changes frequently and you want to avoid content jumping:
```svelte
<svelte:boundary onerror={createBoundaryErrorHandler('ComponentName')}>
  {#snippet failed(error, reset)}
    <ErrorUI {error} {reset} />
  {/snippet}
  
  {#await getData() then data}
    <Content {data} />
  {:catch error}
    {rethrow(error)}
  {/await}
</svelte:boundary>
```

### Remote Function Types

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

**Command Functions** (mutations):
```typescript
import { updateItem } from './actions.remote';

async function handleSubmit() {
  try {
    const result = await updateItem(formData);
    if (result.success) {
      formData = { title: '', description: '' };
    }
  } catch (error) {
    console.error('Failed to update item:', error);
  }
}
```

**Form Functions** (progressive enhancement):
```svelte
<form {...createPost}>
  <input name="title" />
  <textarea name="content"></textarea>
  <button>Publish!</button>
</form>

{#if createPost.result?.success}
  <p>Successfully published!</p>
{/if}
```

### Optimistic Updates
```svelte
<form {...updateItem.enhance(async ({ form, data, submit }) => {
    await submit().updates(
        getItemDetails({ id: data.id }).withOverride((current) => {
            return { ...current, ...data };
        })
    );
    form.reset();
})}>
```

**Optimistic Update Rules:**
- Match queries exactly in `.withOverride()`
- Do NOT call `.refresh()` or `invalidateAll()` after `.updates()`
- Use `Map<string, Status>` for tracking multiple optimistic updates

---

## State Management

### OOP Context Pattern
Use Class-based Contexts with Runes for shared state.

**Core Rule:** State classes must **NEVER** perform async data fetching directly.

### Context Class Structure
```typescript
import { getContext, setContext } from "svelte";

const KEY = Symbol("FeatureContext");

export class FeatureContext {
  // 1. Primitive State
  selectedId = $state<string | null>(null);
  filters = $state({ active: true });

  // 2. Data Storage (Loaded by Component)
  items = $state<Item[]>([]);

  // 3. Computed Logic
  selectedItem = $derived(this.items.find(i => i.id === this.selectedId));

  // 4. Actions
  select(id: string) {
    this.selectedId = id;
  }

  // 5. Hydration
  updateData(items: Item[]) {
    this.items = items;
  }
}

export function createFeatureContext() {
  const ctx = new FeatureContext();
  setContext(KEY, ctx);
  return ctx;
}

export function useFeatureContext() {
  return getContext<FeatureContext>(KEY);
}
```

### Provider Component
```svelte
<script>
  import { createFeatureContext } from './state';
  import { getItems } from './data.remote';

  const ctx = createFeatureContext();
</script>

{#await getItems()}
  <Loading />
{:then items}
  {@const _ = ctx.updateData(items)}
  <Slot />
{/await}
```

### Decision Matrix: Context vs Component

| Feature | Where | Example |
|---------|-------|---------|
| Data Fetching | Component | `{#await getItems()}` |
| Data Storage | Context | `this.items = items` |
| Shared State | Context | `this.selectedId` |
| Navigation | Component | `goto('/next-page')` |
| Computed Logic | Context | `get filteredItems()` |
| Form State | Component | Local inputs, validation |
| UI Preferences | Context | Theme, sidebar, filters |

**Rule of Thumb:** If only one component uses it, keep it local. If 2+ need it, move to context.

---

## Runed Library Utilities

### `watch`
Use instead of `$effect` when you need specific dependencies or previous values:
```typescript
watch(() => count, (curr, prev) => {
  console.log(curr, prev);
});
```

### `Debounced`
Use for search inputs or expensive calculations:
```typescript
let search = $state("");
const debounced = new Debounced(() => search, 500);
// Use debounced.current
```

### `PersistedState`
Use for UI preferences (sidebar state, theme, table columns):
```typescript
const preferences = new PersistedState("app-prefs", { sidebarOpen: true });
```

### `useSearchParams`
Use for syncing URL query params with state:
```typescript
import { useSearchParams } from "runed/kit";
const params = useSearchParams({
    page: z.number().default(1),
    q: z.string().default("")
});
```

---

## Server-Side Authentication

### Server Hooks Pattern
Authentication is handled exclusively server-side using SvelteKit Hooks and HttpOnly cookies.

```typescript
// hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/api/')) return resolve(event);

  const token = event.cookies.get('access_token');
  const user = await validateOrRefresh(token, event.cookies);

  if (user) {
    event.locals.user = user;
  }

  if (isProtectedRoute(event.url.pathname) && !event.locals.user) {
    throw redirect(303, '/login');
  }

  return resolve(event);
};
```

### Cookie Configuration
```typescript
export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: !process.env.ALLOW_INSECURE_COOKIES,
  sameSite: "lax" as const,
};
```

### Token Refresh Locking
Prevent multiple parallel requests from refreshing the same token:
```typescript
const ongoingRefreshes = new Map<string, Promise<any>>();

async function refreshTokenSafely(userId: string, cookies: Cookies) {
  const key = `refresh_${userId}`;

  if (ongoingRefreshes.has(key)) {
    return await ongoingRefreshes.get(key);
  }

  const refreshPromise = attemptTokenRefresh(cookies)
    .finally(() => ongoingRefreshes.delete(key));

  ongoingRefreshes.set(key, refreshPromise);
  return await refreshPromise;
}
```

### Client-Side Access
Never read cookies in `+page.svelte`. Pass user data via `+layout.server.ts`:
```typescript
// +layout.server.ts
export const load = async ({ locals }) => {
  return { user: locals.user };
};
```

---

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

### Component Documentation
All new components must include an `@component` comment block:
```svelte
<!--
@component

Brief description of what this component does.

Usage:
  ```html
  <ComponentName prop="value" />
  ```
-->

<script lang="ts">
  let { prop } = $props();
</script>
```

### Component Patterns
- **Props**: Use TypeScript interfaces
- **Events**: Use callback props (e.g., `onPlaceBefore`, `onNextTurn`)
- **State**: Prefer local `$state` over prop drilling
- **Styling**: Tailwind CSS classes, scoped styles when needed

---

## Database Schema

The Prisma schema includes:

- **ReleaseDateCache**: Caches MusicBrainz release date lookups
  - `trackName`: Track name
  - `artistName`: Artist name
  - `releaseDate`: Cached release date (YYYY-MM-DD)
  - `createdAt`: Cache timestamp

---

## API Integration

### MusicBrainz Queue System
```typescript
import { musicBrainzQueue } from '$lib/server/musicbrainz-queue';

const date = await musicBrainzQueue.enqueue(trackName, artistName);
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

---

## Timeline Utilities

```typescript
import { getReleaseYear, getYearRange, calculateTimelinePosition } from '$lib/utils/timeline';

const year = getReleaseYear(track);
const range = getYearRange(tracks);
const position = calculateTimelinePosition(year, range.minYear, range.maxYear);
```

---

## Code Style Guidelines

### IMPORTANT: Verification Commands
- **USE**: `npm run check` for TypeScript verification
- **NEVER** run `npm run lint` or `npm run format` unless explicitly asked
- **WHY**: Linting often flags pre-existing formatting issues unrelated to your work

### Naming Conventions
- **Components:** PascalCase (e.g., `ItemTable`)
- **Component Files:** kebab-case (e.g., `item-table.svelte`)
- **Functions/Vars:** camelCase
- **Remote Functions:**
  - Queries: `get[Entity]`, `list[Entities]`
  - Mutations: `create[Entity]`, `update[Entity]`, `delete[Entity]`

### Formatting & Style
- **Formatting**: Prettier with Svelte plugin
- **Linting**: ESLint with Svelte plugin
- **TypeScript**: Strict mode enabled

### Best Practices Checklist
- ✅ Keep components small and focused
- ✅ Use `snippet` for reusable internal markup
- ✅ Use `$derived.by` for complex logic, `$derived` for single expressions
- ✅ Use standard HTML attributes (`onclick` not `on:click`)
- ✅ Use `{@const}` only if used 2+ times or computationally expensive

---

## Common Tasks

### Adding a New Game Component
1. Create component in `src/lib/components/custom/tunetap/`
2. Add `@component` documentation block
3. Use TypeScript for props
4. Follow existing component patterns
5. Use Tailwind for styling

### Adding a Remote Function
1. Create `.remote.ts` file in route directory
2. Import `query`, `command`, or `form` from `$app/server`
3. Define Zod schema for validation
4. Implement async handler
5. Use in component with `#await` blocks and error boundaries

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

---

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
npx prisma generate
npx prisma migrate dev --name migration_name
npx prisma studio
```

---

## Important Notes

1. **Session Storage**: Game state is passed via `sessionStorage` between routes
2. **Audio Playback**: Uses HTML5 Audio API, manages playback state manually
3. **Release Dates**: Format is YYYY-MM-DD, extracted as years for timeline
4. **Score Calculation**: Based on consecutive correct placements from start
5. **Win Condition**: First player to reach 10 correct placements wins
6. **Component Naming**: Game components are in `tunetap/` directory

---

## Related Documentation

- `.cursor/rules/data-loading.mdc`: Data loading & remote functions patterns
- `.cursor/rules/library-runed.mdc`: Runed library utilities guide
- `.cursor/rules/project-standards.mdc`: General coding standards
- `.cursor/rules/server-auth.mdc`: Server-side authentication patterns
- `.cursor/rules/state-management.mdc`: OOP state management guide
- `.cursor/rules/svelte-best-practices.mdc`: Svelte 5 syntax and best practices
- `README.md`: Project overview and setup

---

After a big plan implementation you should execute `coderabbit review --plain` with a 3 minute timer and it'll find potential bugs in the implementation.
