# Conflux Circuit — Multiplayer Architecture

## Overview

Conflux Circuit has been refactored from a local-only browser game into a **hybrid local/online multiplayer** architecture. The game preserves all existing single-player and local modes while adding room-based online multiplayer powered by **Colyseus** (authoritative game server) with **Firebase** planned for auth/persistence.

## Directory Structure

```
conflux-circuit/
├── shared/                  # Portable logic (no React, no browser APIs)
│   ├── types.ts             # All shared type definitions
│   ├── constants.ts         # Game constants, balance values
│   ├── seededRNG.ts         # Deterministic RNG
│   ├── pathGenerator.ts     # Run/tile generation
│   ├── gameRules.ts         # Authoritative rules engine
│   ├── rivalBanter.ts       # Seeded banter generation
│   ├── protocol.ts          # Client↔Server message types
│   └── index.ts             # Barrel export
│
├── server/                  # Colyseus game server (Node.js)
│   ├── src/
│   │   ├── index.ts         # Server entry point (Express + Colyseus)
│   │   ├── eventDescriptors.ts  # Server-side event metadata + star computers
│   │   ├── rooms/
│   │   │   └── ConfluxRoom.ts   # Main game room (lobby + match lifecycle)
│   │   └── validation/
│   │       └── eventValidator.ts # Telemetry validation + star computation
│   ├── package.json
│   └── tsconfig.json
│
├── components/              # React UI components (client)
├── events/                  # Mini-game event implementations
├── hooks/
│   ├── useGameEngine.ts     # Local game engine (preserved)
│   ├── useOnlineGame.ts     # Online game state hook
│   └── useSound.ts
├── services/
│   ├── networkService.ts    # Colyseus client connection manager
│   ├── gameRules.ts         # Client wrapper (injects eventRegistry)
│   ├── profileService.ts    # Profile persistence (local + Firebase)
│   ├── pathGenerator.ts     # Re-export from shared
│   ├── seededRNG.ts         # Re-export from shared
│   └── ...                  # Other client services
├── types.ts                 # Re-exports shared + client-only types (GameEvent, EventProps)
├── constants.ts             # Re-exports shared constants
└── App.tsx                  # Main app with mode switching
```

## Architecture Layers

### 1. Shared Module (`/shared`)

**Portable, isomorphic code** used by both client and server. Contains:

- **Types**: All game state interfaces, player models, enums
- **Constants**: Balance values, bot profiles, anomaly definitions
- **SeededRNG**: Deterministic pseudo-random number generation
- **PathGenerator**: Seeded run/tile generation
- **GameRules**: Authoritative rules engine (movement, power-ups, overdrive, pit stops, interventions)
- **BotMind**: Full bot simulation (30 events), power-up decisions, overdrive decisions. Uses `BotEventInfo` interface — both client and server provide their own `getStars` implementation.
- **Protocol**: Typed message definitions for client↔server communication

**Key constraint**: No React, no browser APIs, no `import.meta`, no DOM.

### 2. Server (`/server`)

**Colyseus authoritative game server**. Owns all match state:

- **ConfluxRoom**: Room lifecycle (lobby → countdown → playing → results → finished)
- **EventValidator**: Validates client telemetry, computes authoritative star ratings
- **EventDescriptors**: Server-side event metadata + star computation functions

### 3. Client (project root)

**React/Vite frontend**. Responsible for:

- Rendering all UI and mini-game events
- Local input handling
- Packaging event telemetry for server submission
- Rendering server state updates in online mode
- Preserving full local mode functionality

## Game Modes

### Local Mode (Preserved)
- Uses `useGameEngine.ts` hook (unchanged)
- All state computed locally in the browser
- Bot simulation runs client-side
- No network connection required

### Online Mode (New)
- Uses `useOnlineGame.ts` hook + `networkService.ts`
- Server owns all authoritative state
- Client runs event UIs and submits raw telemetry
- Server validates, scores, and advances the race

## Online Event Scoring Flow

```
┌─────────┐     ┌──────────────┐     ┌──────────┐
│  Server  │────▶│ Tile Start   │────▶│  Client  │
│          │     │ (eventId,    │     │          │
│          │     │  seed, diff, │     │          │
│          │     │  timestamp)  │     │          │
└─────────┘     └──────────────┘     └──────────┘
                                          │
                                     Player does
                                     the mini-game
                                          │
                                          ▼
┌─────────┐     ┌──────────────┐     ┌──────────┐
│  Server  │◀───│  Telemetry   │◀────│  Client  │
│          │     │ (metrics,    │     │          │
│          │     │  tileIndex,  │     │          │
│          │     │  eventId,    │     │          │
│          │     │  timestamp)  │     │          │
└─────────┘     └──────────────┘     └──────────┘
     │
     ▼
 Validate:
 • Shape check
 • Tile/event match
 • Timing plausibility
 • Metric bounds
     │
     ▼
 Compute stars
 (server-side getStars)
     │
     ▼
 Process race step
 (shared GameRules)
     │
     ▼
 Broadcast results
 to all clients
```

**Key principle**: The client NEVER submits star ratings. It submits raw metrics (reaction time, hits, WPM, etc.) and the server computes stars authoritatively.

## Player Model

The `Player` interface was evolved with optional online fields:

```typescript
interface Player {
  // Original fields (preserved)
  id: number;
  name: string;
  isBot: boolean;
  isRival: boolean;
  // ...

  // New online multiplayer fields (optional)
  playerType?: 'human' | 'bot';
  connectionId?: string;    // Colyseus sessionId
  userId?: string;          // Firebase UID
  isReady?: boolean;
  isConnected?: boolean;
}
```

## Protocol Messages

### Client → Server

| Message | Payload | Description |
|---------|---------|-------------|
| `room:ready` | `{ ready: boolean }` | Toggle ready state |
| `room:start` | `{}` | Host starts match |
| `room:updateSettings` | `{ settings: Partial<GameSettings> }` | Host updates settings |
| `game:submitEventResult` | `EventTelemetry` | Submit event performance |
| `game:usePowerUp` | `{ powerUp, targetId? }` | Use a power-up |
| `game:activateOverdrive` | `{ force? }` | Activate overdrive |
| `game:interventionChoice` | `{ accept: boolean }` | Respond to intervention |
| `game:pitStopAction` | `{ action }` | Execute pit stop action |
| `game:requestRematch` | `{}` | Request rematch |

### Server → Client

| Message | Payload | Description |
|---------|---------|-------------|
| `room:created` | `{ roomCode }` | Room created confirmation |
| `room:error` | `{ message }` | Error notification |
| `game:tileStart` | `TileStartPayload` | New tile begins |
| `game:tileResults` | `TileResultsPayload` | Tile results + updated state |
| `game:raceFinished` | `RaceFinishedPayload` | Final standings |
| `game:intervention` | `InterventionPayload` | Rival intervention prompt |
| `game:pitStop` | `{}` | Pit stop phase |
| `game:countdown` | `{ tileIndex }` | Countdown notification |
| `game:playerDisconnected` | `{ sessionId }` | Player disconnected |
| `game:playerReconnected` | `{ sessionId }` | Player reconnected |

## Client Integration Pattern

### `activeGameState` Pattern

`App.tsx` resolves a single `activeGameState` variable that abstracts over local vs online:

```typescript
const activeGameState = isOnline ? onlineGame.serverGameState : gameState;
```

All screen components receive `activeGameState` — they don't know or care whether they're in local or online mode.

### Server-Driven Screen Transitions

In online mode, a `useEffect` watches `onlineGame.matchPhase` and sets the screen:

```
matchPhase     → screen
─────────────────────────────
'countdown'    → Event (+ countdown overlay)
'playing'      → Event
'tile_results' → TileResults
'pit_stop'     → PitStop
'intervention' → (modal overlay, no screen change)
'finished'     → Results
'lobby'        → OnlineLobby
```

### Dual-Mode Handlers

Action handlers branch on `isOnline`:
- **Power-ups**: local → `usePowerUp(playerId, ...)` / online → `onlineGame.sendUsePowerUp(...)`
- **Overdrive**: local → `activateOverdrive(playerId, ...)` / online → `onlineGame.sendActivateOverdrive(...)`
- **Pit Stop**: local → `handlePitStopAction(...)` / online → `onlineGame.sendPitStopAction(...)`
- **Intervention**: local → `handleInterventionChoice(...)` / online → `onlineGame.sendInterventionChoice(...)`
- **Rematch**: local → `handleRematch()` / online → `onlineGame.sendRequestRematch()`

### Room Discovery

Rooms are discovered by code via `getAvailableRooms()` + metadata matching:
- Server sets `this.setMetadata({ roomCode })` in `onCreate`
- Client queries all available rooms and matches `metadata.roomCode`

## Reconnection

- Reconnect tokens stored in `sessionStorage`
- Server allows reconnection within 30-second grace period
- On reconnect, server sends full current game state AND re-sends phase-specific messages (INTERVENTION, PIT_STOP) so the client renders the correct screen
- `networkService` auto-reconnects with exponential backoff: 5 attempts, 1s → 2s → 4s → 8s → 16s delays
- `useOnlineGame` exposes `isReconnecting` — `OnlineLobby` shows a pulsing yellow banner
- Client `onConnectionChange` distinguishes reconnecting (no phase reset) vs truly disconnected (routes to lobby)
- Abandoned players get 0-star defaults for missed tiles
- Disconnected player during pit stop: server auto-submits their action so game advances
- Host disconnect during intervention: server auto-rejects with `false`

## Server Hardening

- `onJoin`: rejects mid-match joins (phase !== 'lobby'), sanitizes name (20-char cap), validates `chassisId`
- `startMatch`: broadcasts initial game state **before** COUNTDOWN to prevent null `activeGameState` fallback
- `startTile`: simulates bot overdrive/power-up decisions via shared `decideBotPowerUp`/`decideBotOverdrive`
- `handleInterventionChoice`: host-only guard; non-host receives `ROOM_ERROR`
- `handlePitStopAction`: collects all human players' submissions via `pendingPitStops` before advancing
- `handleRematch`: resets `pendingResults` and `pendingPitStops` to prevent stale state

## Firebase (Planned)

- **Auth**: Anonymous auth initially, upgrade path to email/Google
- **Firestore**: Profile persistence, chassis unlocks, accolades, leaderboards
- **NOT** used for real-time game state transport

## Running Locally

### Client
```bash
npm install
npm run dev
```

### Server
```bash
cd server
npm install
npm run dev
```

Server runs on `ws://localhost:2567`. Client connects via `VITE_SERVER_URL` env var (defaults to `ws://localhost:2567`).
