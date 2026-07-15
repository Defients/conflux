# Conflux Circuit — Multiplayer TODO

## Completed
- [x] Extract shared logic into `/shared` (types, constants, seededRNG, pathGenerator, gameRules, rivalBanter, protocol)
- [x] Client re-exports from shared — zero breakage to existing imports
- [x] Scaffold Colyseus server (`/server`) with ConfluxRoom, event validation, star computation
- [x] Client networking layer (networkService, useOnlineGame hook)
- [x] Protocol message types fully defined and documented
- [x] Player model evolved with optional online fields (playerType, connectionId, userId, isReady, isConnected)
- [x] Server-side event telemetry validation (shape, timing, bounds)
- [x] Server-side authoritative star computation (mirrors all 30 client getStars functions)
- [x] Reconnect token persistence (sessionStorage)
- [x] Architecture documentation (MULTIPLAYER_ARCHITECTURE.md)
- [x] Online lobby UI — OnlineLobby.tsx (create/join/ready/start/roster with chassis selector)
- [x] "Online Multiplayer" button added to Lobby.tsx launch controls
- [x] EventRunner.tsx refactored for dual mode (local bot sim + online telemetry submission)
- [x] App.tsx fully integrated: `activeGameState` pattern uses server state in online mode
- [x] Server ConfluxRoom handles full match lifecycle (lobby → countdown → playing → results → finished)
- [x] Server processes pit stops, interventions, overdrive, power-ups via shared GameRules
- [x] Server reconnection with 30s grace period + full state resync
- [x] Server room metadata exposes `roomCode` for join-by-code via `getAvailableRooms`
- [x] useOnlineGame hook tracks `matchPhase` (countdown/playing/tile_results/pit_stop/intervention/finished)
- [x] App.tsx `useEffect` drives screen transitions from `onlineGame.matchPhase`
- [x] Online pit stop flow: server sends PIT_STOP → client renders PitStopScreen → `sendPitStopAction`
- [x] Online intervention flow: server sends INTERVENTION → client renders RivalInterventionModal → `sendInterventionChoice`
- [x] Online results/rematch: ResultsScreen uses `sendRequestRematch` / `leaveRoom` in online mode
- [x] `.env.example` with `VITE_SERVER_URL` for developer setup
- [x] Both client and server compile cleanly (`tsc --noEmit`)
- [x] Server broadcasts INTERVENTION message with full payload (rivalName, standardTile, hazardTile, cpBonus)
- [x] Server broadcasts game state after intervention/pit-stop resolution before advancing
- [x] Host-only intervention choice guard on server (non-host gets error)
- [x] Multiplayer pit stop: server collects all human player actions before advancing (`pendingPitStops`)
- [x] Rematch handler resets `pendingResults` and `pendingPitStops`
- [x] Client clears stale tileResults/interventionData on countdown
- [x] Power-up/overdrive handlers securely derive playerId from session (no spoofing)

- [x] Shared botMind.ts: full bot simulation (30 events) extracted to `/shared/botMind.ts`
- [x] Server uses `simulateBotPerformance` via `BotEventInfo` adapter (EVENT_DESCRIPTORS + STAR_COMPUTERS)
- [x] Client `services/botMind.ts` refactored to thin adapter over shared module
- [x] networkService: auto-reconnect with exponential backoff (5 attempts, 1s→16s delay)
- [x] useOnlineGame hook: exposes `isReconnecting`, smart disconnect vs reconnecting detection
- [x] OnlineLobby: reconnecting banner UI (yellow pulse)
- [x] App.tsx: `'disconnected'` matchPhase routes back to online lobby
- [x] `broadcastGameState` includes `phase` field for client sync
- [x] `handlePlayerAbandoned`: disconnected player during pit_stop auto-advances game
- [x] `handlePlayerAbandoned`: host disconnect during intervention auto-rejects with `false`
- [x] App.tsx: `isOnlineHost` derived from lobbyState — intervention modal gated to host only
- [x] Non-host players see "waiting for host to decide" overlay during intervention
- [x] `useOnlineGame` `onGameStateUpdate` syncs all phases (playing/tile_results/finished/lobby) for reconnection resync
- [x] `sendGameStateToClient` on reconnect also re-sends INTERVENTION/PIT_STOP messages for correct screen
- [x] `onJoin`: rejects mid-match joins, sanitizes playerName (max 20 chars), validates chassisId
- [x] **BUGFIX**: `startMatch` now broadcasts initial game state before `COUNTDOWN` — fixes null `activeGameState` fallback to Lobby on match start
- [x] Server: bot overdrive/power-up decisions applied in `startTile` via `decideBotPowerUp`/`decideBotOverdrive` (shared botMind)
- [x] App.tsx: sound effect on `tile_results` in online mode (looks up human player by `connectionId`)

## Remaining — Phase 2 (Integration Polish)
- [x] Online mode end-to-end test (start server + client, create room, play through)

## Phase 5 — Production Readiness & Polish (Complete)
- [x] Extracted Express app into `createExpressApp.ts` for testability
- [x] REST API tests: health, diagnostics, rooms, queue status, 404 (5 tests)
- [x] Removed dead code: unused `onReportResult` prop and `handleTournamentReportResult` callback
- [x] Added `server/.env.example` with all env vars documented

## Phase 4 — Tournament Flow & Test Coverage (Complete)
- [x] Wire RACE_FINISHED → reportTournamentResult so match results flow back to TournamentRoom
- [x] App.tsx tracks tournamentMatchId, determines win/loss from finalStandings, reports to server
- [x] Auto-return to tournament screen after match concludes
- [x] TournamentRoom.advanceRound broadcasts TOURNAMENT_CHAMPION when champion is set
- [x] Cleaned up TournamentScreen — removed redundant state (now handled at App level)
- [x] TournamentRoom server integration test: 4 clients → bracket → report → champion
- [x] Ghost race Firestore service tests: graceful degradation + type validation
- [x] Extended vitest include pattern for services/**/*.test.ts

## Phase 2+3 — Game Modes & Content Expansion (Complete)
- [x] Ghost Race mode: fetch ghost runs from Firestore, race against recorded performances, submit results
- [x] Tournament mode: connect to TournamentRoom, populate bracket, join matches, report results, advance bracket
- [x] 3 new power-ups: Overcharge (+2 energy), Sludge (slow all opponents), Reflector (debuff immunity)
- [x] 4 new accolades: GhostHunter, TournamentChampion, ComebackKing, PowerPlayer
- [x] 2 new tile modifiers: ICE_PATCH (harder 3★ + bonus movement), NEBULA_DRIFT (random event replacement)
- [x] Tournament result reporting: REPORT_TOURNAMENT_RESULT protocol message, TournamentRoom handler
- [x] TournamentChampion accolade awarded when champion is crowned
- [x] GhostHunter accolade awarded when winning a ghost race
- [x] powerUpsUsed counter on Player, incremented on each power-up activation
- [x] POWER_SURGE and pit stop tuneUp award from expanded power-up pool
- [x] Bot AI handles new power-ups (Overcharge self-buff, Reflector defensive)
- [x] 23 new tests for power-ups, accolades, tile modifiers, and types
- [x] CI pipeline verified (colyseus.js already in server devDependencies)

## Phase 5 — Enhancement-First Polish (Complete)
- [x] **BUGFIX**: EventRunner `isEventOver` reset between tiles — was stuck `true` after first tile, blocking all subsequent events
- [x] **BUGFIX**: TileResultsScreen null guard for `completedTile`/`lastTileResults` — prevented crash at edge cases (index 0, gauntlet)
- [x] **BUGFIX**: useOnlineGame clears stale `matchSummary` on countdown — prevented previous match's summary showing during rematch
- [x] **BUGFIX**: ReactionTap state machine now respects `isPaused` — reaction timer no longer continues during countdown pause
- [x] **BUGFIX**: networkService saves reconnect token after successful reconnection — server may issue new token
- [x] **BUGFIX**: EventRunner humanPlayer null guard — graceful fallback instead of crash when no human player found
- [x] **BUGFIX**: App.tsx `handleSwitchPilot` now awaits `leaveRoom` — prevents state race between leave cleanup and profile reset
- [x] **SECURITY**: ConfluxRoom `handleUpdateSettings` validates and clamps input (playerCount 1-6, runLength 1-20, bots ≥ 0)
- [x] **PERF**: EventRunner bot effect uses `gameStateRef` instead of stale closure — bot decisions now use current game state
- [x] **CODE HEALTH**: Removed stale multi-line comment in EventRunner about `onActivateOverdrive` signature change (already done)
- [x] **CODE HEALTH**: Replaced inline `import("./types").EventResult` with proper import in App.tsx
- [x] **CODE HEALTH**: Added clarifying comment on ConfluxRoom hardcoded 15000ms duration (server-side timeout default)
- [x] **CODE HEALTH**: audioService `setEnabled` now async and awaits `init()` — sounds fully loaded before playback
- [x] **A11Y**: TimerBar updates `aria-label` via direct DOM manipulation for screen reader access
- [x] **A11Y**: WhackAMole keyboard support (number keys 1-9) and `aria-label` on mole buttons
- [x] **A11Y**: TileResultsScreen `aria-live="polite"` for screen reader announcements

## Phase 3 — Firebase Integration (Complete)
- [x] Firebase project setup + config
- [x] Firebase Auth (anonymous auth, upgrade path)
- [x] Firestore profile persistence (profileService dual backend)
- [x] Leaderboard writes after match completion
- [x] Match history metadata storage
- [x] Firebase Hosting deployment config
- [x] Firestore security rules

## Phase 4 — Server Hardening (Complete)
- [x] Server rate limiting (token bucket per client + message type)
- [x] Matchmaking REST endpoint (`/api/rooms`) with phase filtering
- [x] Browse open rooms UI in OnlineLobby
- [x] Minimal spectator mode (join active matches as observer)
- [x] Server room lifecycle tests (ConfluxRoom.test.ts)
- [x] Shared module unit tests (seededRNG, pathGenerator, contractService, matchSummary)

## Known Limitations
- Gauntlet mode is local-only by design (only accessible from local Lobby, 1 player, 0 bots)
- No mid-match join (rooms lock at match start; spectators can join active matches but cannot play)
- Clock skew between client/server uses generous tolerance (10s)
- Firebase integration requires a configured Firebase project (game runs fully local without it)

## How to Run

### Client (Vite dev server)
```bash
# From project root
npm install
npm run dev
```

### Server (Colyseus)
```bash
cd server
npm install
npm run dev
```

Server: `ws://localhost:2567`
Client: `http://localhost:5173` (default Vite port)

Set `VITE_SERVER_URL` env var to override server URL.
