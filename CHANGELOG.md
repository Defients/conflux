# Changelog

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
