<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Conflux Circuit

A cyberpunk racing game where pilots compete across a procedurally generated circuit of 30+ arcade mini-game events. Features local multiplayer, online multiplayer via Colyseus, daily/weekly challenges, gauntlet survival mode, corporation contracts, rival system, and Firebase-backed leaderboards + match history.

## Game Modes

- **Standard Race** — 1-6 players (human + bots) across 8-12 tiles. Earn CP, climb the leaderboard.
- **Daily Challenge** — Seeded race that changes every day. Same conditions for all players worldwide.
- **Weekly Cup** — Larger 6-player race with a curated event preset. New seed each week.
- **Solo Gauntlet** — Endless 50-tile survival run. 3 lives. No bots. Just you.
- **Online Multiplayer** — Create or join rooms via 4-character codes. Real-time authoritative server.

## Run Locally

**Prerequisites:** Node.js 18+

### Client (Vite dev server)

```bash
npm install
npm run dev
```

Client runs at `http://localhost:5173` (default Vite port).

### Server (Colyseus)

```bash
cd server
npm install
npm run dev
```

Server runs at `ws://localhost:2567`.

Set `VITE_SERVER_URL` in `.env` to override the server URL for the client.

### Firebase (optional)

Firebase provides cloud leaderboards, match history, and profile sync. Without it, the game runs fully local.

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Copy `.env.example` to `.env` and fill in your Firebase config
3. Deploy Firestore security rules: `firebase deploy --only firestore:rules`

## Project Structure

```
├── components/        React UI components (Lobby, EventRunner, ResultsScreen, etc.)
├── events/            30+ arcade mini-game events (ReactionTap, AimFlick, BalanceBeam, etc.)
├── hooks/             useGameEngine (local), useOnlineGame (Colyseus), useSound
├── services/          audioService, botMind, firebase, networkService, profileService
├── shared/            Portable game logic (types, constants, pathGenerator, matchSummary, contractService)
├── server/            Colyseus authoritative server (ConfluxRoom, rate limiting, REST matchmaking)
├── App.tsx            Root component — screen routing, online/local mode switching
├── types.ts           Client re-exports from shared/types + React-dependent GameEvent type
└── index.css          Mobile-first CSS foundation (safe-area, touch targets, a11y, PWA)
```

## Tech Stack

- **Frontend:** React 18, Vite, TailwindCSS
- **Backend:** Colyseus (authoritative multiplayer), Express
- **Cloud:** Firebase (Auth, Firestore, Hosting)
- **Testing:** Vitest
- **PWA:** Installable, offline-capable, mobile-optimized

## Testing

```bash
# Client tests (shared modules)
npx vitest run

# Server tests
cd server && npx vitest run

# Type checking
npx tsc --noEmit

# Production build
npx vite build
```
