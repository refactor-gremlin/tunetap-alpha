# Gemini Project Context: TuneTap

This document provides a comprehensive overview of the TuneTap project for AI-assisted development.

## 1. Project Overview

TuneTap is a web-based, music-themed party game built with **SvelteKit** and **Svelte 5**. The core gameplay loop involves players loading a Spotify playlist and arranging the songs in chronological order based on their real-world release dates.

The application is architected to be efficient and user-friendly, featuring:
*   **Spotify Integration:** Fetches playlists using `spotify-url-info`.
*   **Release Date Fetching:** Uses the **MusicBrainz API** to find the original release date of tracks.
*   **Database Caching:** A **Prisma**-managed **SQLite** database caches MusicBrainz responses to minimize API calls and speed up subsequent game setups.
*   **Modern Frontend:** Built with **Svelte 5 runes** (`$state`, `$derived`) for state management. The UI is composed of `shadcn-svelte` components (using `bits-ui`) and styled with **Tailwind CSS**.
*   **Build Tooling:** The project is built and served using **Vite**.

## 2. Building and Running

Standard Node.js and npm/pnpm/yarn are used. The key commands are defined in `package.json`.

### First-Time Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```
2.  **Set up Database:** This generates the Prisma client and runs database migrations.
    ```bash
    npx prisma generate
    npx prisma migrate dev
    ```

### Core Commands

*   **Run Development Server:** Starts the app on `http://localhost:5173`.
    ```bash
    npm run dev
    ```
*   **Build for Production:**
    ```bash
    npm run build
    ```
*   **Preview Production Build:**
    ```bash
    npm run preview
    ```
*   **Type Checking:**
    ```bash
    npm run check
    ```
*   **Linting and Formatting:**
    ```bash
    npm run lint
    npm run format
    ```

### Database Management

*   **View Database:** Open Prisma Studio to inspect the SQLite database.
    ```bash
    npx prisma studio
    ```
*   **Create a Migration:**
    ```bash
    npx prisma migrate dev --name <migration_name>
    ```

## 3. Development Conventions

*   **Language:** The project is written entirely in **TypeScript**.
*   **State Management:** Follows the **Svelte 5 runes** paradigm for reactivity. The project also uses the `runed` library extensively.
*   **Component Structure:** Components are organized in `src/lib/components/custom/tunetap/common`. They are designed to be reusable and are styled using CSS variables injected from parent pages.
*   **Styling:** The project uses **Tailwind CSS v4** and `prettier-plugin-tailwindcss` for class sorting.
*   **Code Style:** Enforced by **ESLint** and **Prettier**. Run `npm run lint` and `npm run format` before committing.
*   **API Calls:** The project uses a custom "Remote Functions" abstraction over SvelteKit's built-in data loading and form actions.

This context should provide a solid foundation for any development tasks or analysis of the TuneTap project.

---

## 4. Key Architectural Patterns & Libraries

The following architectural patterns are enforced by the project's tooling and must be followed.

### 4.1. SvelteKit Remote Functions

This pattern provides a structured way to handle data fetching and mutations.

*   **Function Types:**
    *   `query()`: For data fetching.
    *   `form()`: For HTML form submissions.
    *   `command()`: For direct client-to-server function calls.
    *   `prerender()`: For generating data at build time.

*   **CRITICAL Data Loading Rule:** Data from `query` functions **must** be loaded directly in the template using a full `{#await}` block. **Never** wrap a query call in `$derived.by()` or access its `.current` property directly in the script.

    **Correct Usage:**
    ```svelte
    {#await getData({ id: 123 })}
      <p>Loading...</p>
    {:then data}
      <Content {data} />
    {:catch error}
      <p>Error: {error.message}</p>
    {/await}
    ```

*   **Optimistic Updates:** For form submissions, use the `.updates()` method with a `.withOverride()` callback to provide an optimistic UI update. The query call inside `.withOverride()` must be identical to the one used in the `#await` block to ensure the cache is correctly updated.
    ```svelte
    <form {...scanPakketForm.enhance(async ({ data, submit }) => {
      await submit().updates(
        getPakketten({ vrachtNr: data.vrachtNr }).withOverride(current => {
          // Return updated data locally before the server responds
        })
      );
    })}>
      ...
    </form>
    ```

### 4.2. The `runed` Utilities Library

The `runed` library is used extensively to simplify common Svelte 5 patterns.

*   **State Management:**
    *   `PersistedState`: For reactive state that persists to `localStorage` or `sessionStorage` and syncs across tabs (e.g., user preferences, theme).
    *   `StateHistory`: For implementing undo/redo functionality.
    *   `FiniteStateMachine`: For modeling complex, type-safe component states (e.g., game status, modal flows).
    *   `Context`: A type-safe wrapper around Svelte's context API.

*   **Reactivity & Events:**
    *   `useEventListener`: Attaches event listeners with automatic cleanup. This is the preferred way to add listeners to the `window` or `document`.
    *   `useInterval`: Manages intervals with automatic cleanup and pause/resume controls.
    *   `watch`: Provides more granular control over reactive dependencies than `$effect`.
    *   `useDebounce` / `Debounced`: Used for debouncing reactive values, especially for user input that triggers API calls.

*   **DOM & Element Utilities:**
    *   `onClickOutside`: For closing modals or dropdowns when a user clicks away from them.
    *   `useIntersectionObserver`: For lazy loading or triggering animations when elements scroll into view.
    *   `activeElement`: A reactive reference to the currently focused element on the page.
    *   `IsFocusWithin`: A reactive boolean that checks if focus is within a specified container.