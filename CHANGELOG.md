# Changelog

## [Unreleased] — Phase 5: Production Readiness & Polish

### Server Refactoring
- Extracted Express app creation into `createExpressApp.ts` — REST routes now reusable in tests without duplicating code
- `index.ts` simplified to import `createExpressApp` instead of defining routes inline

### REST API Tests
- New `restApi.test.ts`: 5 tests covering `GET /health`, `GET /diagnostics`, `GET /api/rooms`, `GET /api/queue/status`, and 404 handling
- Tests verify response status codes, body structure, and registered room types

### Dead Code Cleanup
- Removed unused `onReportResult` prop from `TournamentScreen` interface and destructuring
- Removed unused `handleTournamentReportResult` callback from `App.tsx` (result reporting handled by `useEffect` since Phase 4)

### Deployment Documentation
- Added `server/.env.example` documenting all server environment variables (PORT, NODE_ENV, ALLOWED_ORIGINS, Firebase config, build metadata)

## [Unreleased] — Phase 4: Tournament Flow & Test Coverage

### Tournament Match Result Flow
- Wired `RACE_FINISHED` → `networkService.reportTournamentResult()` so match results flow back to `TournamentRoom` automatically
- `App.tsx` tracks `tournamentMatchId` state — when a tournament match finishes, determines win/loss from `finalStandings` and reports to server
- Auto-returns to tournament screen 3s after match concludes
- `TournamentRoom.advanceRound()` now broadcasts `TOURNAMENT_CHAMPION` message when champion is set (was only in result handler, which ran before the tick)
- Cleaned up `TournamentScreen` — removed redundant `currentMatchId` state and `reportMatchResult` callback (now handled at App level)

### Tests
- **TournamentRoom integration test**: 4 clients join → bracket fills → results reported → round advances → champion declared. Verifies `TOURNAMENT_UPDATE` and `TOURNAMENT_CHAMPION` messages.
- **Ghost service tests**: 6 tests covering graceful degradation when Firebase `db` is null, `GhostRun` type structure validation, and tile result star range validation.
- Extended vitest `include` pattern to cover `services/**/*.test.ts`

## [Unreleased] — Phase 2+3: Game Modes & Content Expansion

### New Game Modes
- **Ghost Race**: Race against recorded ghost runs from Firestore. Fetch a random ghost, race head-to-head with pre-recorded tile results, and submit your own run for others to challenge. Falls back to synthetic ghosts when offline.
- **Tournament**: Single-elimination bracket tournaments (4/8/16 players). Join via `joinOrCreate`, bracket populates and matches start automatically. Results report back to `TournamentRoom` to advance the bracket. Champion is crowned and broadcast.

### New Power-Ups
- **Overcharge** 🔋: Instantly gain +2 energy for power-up activation.
- **Sludge** 🛢️: Slow all opponents on the next tile.
- **Reflector** 🪞: Grants IMMUNE status, blocking the next incoming debuff.

### New Accolades
- **Ghost Hunter** 👻: Defeat a recorded ghost run in Ghost Race mode.
- **Tournament Champion** 🏅: Win a single-elimination tournament bracket.
- **Comeback King** 👑: Win a race after being in last place at the halfway point.
- **Power Player** 🎮: Use 5 or more Power-Ups in a single race.

### New Tile Modifiers
- **ICE_PATCH** 🧊: Increases tile difficulty by 1. 3★ performance grants 1.5× bonus movement.
- **NEBULA_DRIFT** 🌌: Replaces the tile's event with a different random one (cosmic chaos).

### Tournament Infrastructure
- Added `REPORT_TOURNAMENT_RESULT` client message and `TOURNAMENT_CHAMPION` server message to protocol.
- `TournamentRoom` now processes match results, marks winners, advances rounds, and broadcasts champion.
- `networkService` gains `joinTournament`, `leaveTournament`, `reportTournamentResult` methods.
- `TournamentScreen` rewritten with shared `TournamentBracket` types, join/chassis/bracket-size setup, live bracket display, match cards, and champion celebration.

### Game Engine
- `powerUpsUsed` counter added to `Player` interface, incremented on each power-up activation.
- `POWER_SURGE` tiles now have 40% chance to award from expanded power-up pool (includes new power-ups).
- Pit Stop `tuneUp` now awards from the full 8-power-up pool instead of only 3.
- Bot AI updated to handle new power-ups: Overcharge (self-buff when low energy), Reflector (defensive when behind).

### Tests
- 23 new tests covering new power-ups, accolades, tile modifiers, and type validity.

## [Unreleased] — Enhancement-First Polish

### Fixed
- **Critical**: `EventRunner` `isEventOver` state not resetting between tiles, blocking all events after the first tile
- **Critical**: `TileResultsScreen` crash when `completedTile` or `lastTileResults` is undefined (edge case at index 0, gauntlet mode)
- **Critical**: `EventRunner` React hooks violation — early return for `humanPlayer` null was placed before `useState(isActivelyBlurred)`, causing crash on re-render when human player is null
- `useOnlineGame` stale `matchSummary` persisting across matches — now cleared on countdown
- `ReactionTap` state machine ignoring `isPaused` — reaction timer continued during countdown pause
- `networkService.tryReconnect` not persisting new reconnect token after successful reconnection
- `EventRunner` crash when no human player found — now renders graceful fallback
- `App.tsx` `handleSwitchPilot` not awaiting `leaveRoom` — caused state race during pilot switch
- `RaceTrackHUD` crash when no human player found — `players.find(p => !p.isBot)!` replaced with null guard
- `PitStopScreen` crash when no human player found — same `!` assertion removed, null guard added after hooks

### Security
- `ConfluxRoom.handleUpdateSettings` now validates and clamps host input (`playerCount` 1–6, `runLength` 1–20, `easyBots`/`intermediateBots` ≥ 0)

### Performance
- `EventRunner` bot decision effect uses `gameStateRef` instead of stale closure — bot power-up/overdrive decisions now reference current game state
- `EventRunner` `handleEventComplete` wrapped in `useCallback` — prevents `MemoizedEventComponent` re-renders from parent state changes
- `RaceTrackHUD` rank computation memoized — eliminates duplicated `players.filter()` calls in JSX render body

### Code Health
- Removed stale 4-line comment in `EventRunner` about `onActivateOverdrive` signature change (already implemented)
- Replaced inline `import("./types").EventResult` in `App.tsx` with proper top-level import
- Added clarifying comment on `ConfluxRoom` hardcoded 15000ms duration (server-side timeout default, not actual event duration)
- `audioService.setEnabled` now async, awaits `init()` to ensure sounds are loaded before playback

### Accessibility
- `TimerBar` updates `aria-label` via direct DOM manipulation for screen reader access
- `WhackAMole` keyboard support: number keys 1–9 map to mole holes; `aria-label` added to each hole button
- `TileResultsScreen` `aria-live="polite"` on results dialog for screen reader announcements

### Verification
- Client `tsc --noEmit`: clean
- Server `tsc --noEmit`: clean
- Client tests: 78 passed (vitest)
- Server tests: 18 passed (vitest)
- Client `vite build`: succeeds, `_redirects` included in dist

## [Unreleased] — Online Deployment Setup

### Fixed
- **Critical**: `networkService.ts` `HTTP_SERVER_URL` derivation bug — `wss://` was converted to `httpss://` instead of `https://`, breaking the `/api/rooms` REST endpoint in production

### Infrastructure
- Created `render.yaml` blueprint for one-click Colyseus server deployment on Render (free tier)
- Created `netlify.toml` for frontend static hosting with SPA fallback
- Created `public/_redirects` for Netlify SPA routing (all routes → `index.html`)
- Updated `server/RENDER_DEPLOY.md` with full deployment guide: Render blueprint, Netlify frontend, custom domain setup for `confluxcircuit.com`
- `ALLOWED_ORIGINS` now includes both `https://confluxcircuit.com` and `https://www.confluxcircuit.com`
