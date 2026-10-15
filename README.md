<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Conflux Circuit

A cyberpunk racing game where pilots compete across a procedurally generated circuit of 47 arcade mini-game events. Features solo & team racing, online multiplayer via Colyseus (casual rooms, ranked ELO matchmaking, single-elimination tournaments, and live spectating), async PvP ghost racing, daily/weekly challenges, 50-tile gauntlet survival mode, corporation contracts, rival interventions, neural skill trees, chassis module loadouts, and Firebase-backed leaderboards + match history.

## Game Modes

- **Standard & Team Race** — 1-6 players (human + bots, Free-For-All or Team Alpha vs Team Omega) across 4-20 tiles.
- **Daily Challenge** — UTC-seeded race that changes every day (`YYYY-MM-DD`). Same conditions for all players worldwide.
- **Weekly Cup** — Larger 6-player race with a curated event preset. New ISO-week seed each week.
- **Solo Gauntlet** — 50-tile survival run with 3 lives and escalating difficulty.
- **Ghost Time-Attack** — Async head-to-head PvP against recorded pilot runs on identical seeds.
- **Online Multiplayer & Ranked Queue** — Create/join rooms via 4-character codes, queue for ELO-rated matches, compete in 4/8/16-player Elimination Tournaments, or spectate live matches.

## Run Locally

**Prerequisites:** Node.js 20+

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
├── events/            47 arcade mini-game events (ReactionTap, AimFlick, BalanceBeam, etc.)
├── hooks/             useGameEngine (local), useOnlineGame (Colyseus), useSound
├── services/          audioService, botMind, firebase, networkService, profileService
├── shared/            Portable game logic (eventCatalog, types, constants, pathGenerator, matchSummary, gameRules)
├── server/            Colyseus authoritative server (ConfluxRoom, MatchmakingRoom, TournamentRoom, REST API)
├── App.tsx            Root component — screen routing, online/local mode switching
├── types.ts           Client re-exports from shared/types + React-dependent GameEvent type
└── index.css          Mobile-first CSS foundation (safe-area, touch targets, a11y, PWA)
```

## Tech Stack

- **Frontend:** React 19, Vite 6, TailwindCSS 4
- **Backend:** Colyseus (authoritative multiplayer), Express
- **Cloud:** Firebase (Auth, Firestore, Hosting) + hybrid server progression endpoints
- **Testing:** Vitest, ESLint 10

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
