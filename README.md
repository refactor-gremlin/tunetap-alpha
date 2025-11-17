# TuneTap 🎵

An open-source music-themed party game where players arrange songs in chronological order based on their release dates.

## 🎮 What is TuneTap?

TuneTap is a web-based music knowledge game that challenges players to arrange songs from their favorite Spotify playlists in chronological order. players listen to songs and must correctly place them on a timeline based on when they were first released.

### Key Features

- **🎵 Spotify Integration**: Load any public Spotify playlist to create your game
- **📅 Release Date Lookup**: Automatically fetches first release dates from MusicBrainz
- **🎧 Audio Playback**: Plays audio previews from Spotify or YouTube
- **💾 Smart Caching**: Caches release dates in SQLite for faster subsequent lookups
- **⚡ Queue System**: Efficiently handles MusicBrainz API rate limits with a queue system
- **🌙 Dark Mode**: Beautiful dark theme with smooth animations
- **📱 Responsive**: Works on desktop and mobile devices

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- A Spotify account (for playlist URLs)
- SQLite (included with Node.js)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tunetap-alpha.git
cd tunetap-alpha
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn install
```

3. Set up the database:
```bash
npx prisma generate
npx prisma migrate dev
```

4. Create a `.env` file (optional - defaults work for development):
```env
DATABASE_URL="file:./dev.db"
```

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🎯 How to Play

1. **Start the Game**: Click "Start Game" on the homepage
2. **Load a Playlist**: Paste a public Spotify playlist URL (e.g., `https://open.spotify.com/playlist/...`)
3. **Wait for Processing**: The app will fetch tracks, find audio sources, and look up release dates
4. **Play & Arrange**: Listen to songs and arrange them in chronological order based on their release dates
5. **Win**: Be the first to correctly place all songs in order!

### Game Modes

Currently, TuneTap supports a basic mode where you can:
- Listen to tracks from your playlist
- View release dates as they're fetched
- Arrange tracks chronologically

Future game modes:
- **Original Mode**: Guess if a song was released before or after other songs
- **Expert Mode**: Name the artist, song title, and exact release year

## 🛠️ Tech Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/) with [Svelte 5](https://svelte.dev/)
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: SQLite with [Prisma](https://www.prisma.io/)
- **UI Components**: Custom components built with [bits-ui](https://www.bits-ui.com/)
- **State Management**: [Runed](https://runed.dev/) (Svelte 5 runes utilities)
- **Music APIs**:
  - [Spotify URL Info](https://www.npmjs.com/package/spotify-url-info) - Fetch playlist tracks
  - [YouTube SR](https://www.npmjs.com/package/youtube-sr) - Find YouTube audio sources
  - [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) - Look up release dates

## 📁 Project Structure

```
tunetap-alpha/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable UI components
│   │   ├── server/         # Server-side utilities
│   │   └── types.ts        # TypeScript type definitions
│   ├── routes/
│   │   ├── +page.svelte    # Homepage
│   │   ├── playlist/       # Playlist input page
│   │   └── game/           # Game page
│   └── app.css             # Global styles
├── prisma/
│   └── schema.prisma       # Database schema
└── static/                 # Static assets
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run type checking
- `npm run lint` - Lint code
- `npm run format` - Format code with Prettier

### Database Management

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# View database in Prisma Studio
npx prisma studio

# Reset database (development only)
npx prisma migrate reset
```

## 🎨 Features in Detail

### Release Date Caching

TuneTap uses SQLite to cache release dates from MusicBrainz, significantly reducing API calls for repeated tracks. The cache stores:
- Track name
- Artist name
- Release date (YYYY-MM-DD format)
- Timestamps for cache management

### MusicBrainz Queue System

To respect MusicBrainz API rate limits, TuneTap implements a queue system that:
- Processes release date lookups sequentially
- Shows queue size in real-time
- Handles errors gracefully
- Provides progress feedback

### Audio Sources

TuneTap tries multiple sources for audio playback:
1. Spotify preview URLs (30-second previews)
2. YouTube videos (full songs when available)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. Here are some areas where help is needed:

- [ ] Implement timeline/arrangement UI
- [ ] Add multiplayer support
- [ ] Create different game modes (Original, Expert)
- [ ] Improve audio source detection
- [ ] Add more music services (Apple Music, YouTube Music)
- [ ] Improve mobile experience
- [ ] Add tests
- [ ] Improve documentation

### Development Guidelines

- Follow the existing code style (Prettier + ESLint)
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Follow the patterns in `.cursor/rules/` for SvelteKit remote functions
- Write clear commit messages

## 📝 License

[Add your license here - e.g., MIT, Apache 2.0, etc.]

## 🙏 Acknowledgments

- Inspired by [Hitster](https://hitstergame.com) - the original card game
- Built with amazing open-source tools (Svelte, SvelteKit, Prisma, etc.)
- Music data provided by [MusicBrainz](https://musicbrainz.org/)

## 📮 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/tunetap-alpha/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/tunetap-alpha/discussions)

---

Made with ❤️ and 🎵 by the open-source community
