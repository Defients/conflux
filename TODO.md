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
- [ ] Online mode end-to-end test (start server + client, create room, play through)

## Remaining — Phase 3
- [ ] Firebase project setup + config
- [ ] Firebase Auth (anonymous auth, upgrade path)
- [ ] Firestore profile persistence (profileService dual backend)
- [ ] Leaderboard writes after match completion
- [ ] Match history metadata storage
- [ ] Firebase Hosting deployment config

## Known Limitations
- Gauntlet mode is local-only by design (only accessible from local Lobby, 1 player, 0 bots)
- Room code discovery relies on Colyseus getAvailableRooms metadata — may need custom matchmaking endpoint
- No spectator mode
- No mid-match join (rooms lock at match start)
- Clock skew between client/server uses generous tolerance (10s)
- No rate limiting on message submission
- Firebase integration is scaffolded but not wired

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
