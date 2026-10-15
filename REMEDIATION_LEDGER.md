# ConfluxCircuit Remediation Ledger

**Updated:** 2026-10-15  
**Current Baseline:** 216 client/shared tests, 87 server tests, 0 lint errors/warnings, clean typecheck, clean client & server builds. All 11 audit diagnostic probes (`B01–B15`, `R01–R18`) remediated and verified in `server/src/__tests__/auditRemediation.test.ts` and `shared/__tests__/eventCatalog.test.ts`.

## Legend
- `unverified` — not yet checked against code
- `confirmed` — defect reproduced/structurally proven
- `partial` — partially true, needs nuance
- `stale` — was true but code changed
- `incorrect` — disproven by code
- `blocked` — cannot fix due to external dependency
- `fixed` — repaired and verified

---

## October 2026 Development-State Audit Remediations (B01–B15)
- **B01 (Telemetry enforcement):** `fixed` — `ConfluxRoom.handleSubmitEventResult` rejects invalid telemetry with `0★` + `ROOM_ERROR` and scores using `expectedTile.eventId`.
- **B02 (Command cost & phase guards):** `fixed` — Client `force` flag ignored on server; `GameRules.activateOverdrive` deduplicates `overdrivingPlayerIds`; `pit_stop` and `intervention` are explicit `MatchPhase` states with 20s deadlines and action validation.
- **B03 (Three-tile generator hang):** `fixed` — `assignDifficultyAndModifiers` samples bounded interior positions `[1..runLength-2]` without unbounded loops; `sanitizeGameSettings` enforced at all ingresses.
- **B04 (Independent clocks):** `fixed` — Canonical 47-event metadata/durations/scorers unified in `shared/eventCatalog.ts`; `Countdown` synced to 3.5s (`count = 3`); `TimerBar` preserves elapsed time across `isPaused`.
- **B05 (Online human identity):** `fixed` — `App.tsx` resolves `activeHumanPlayerId` from session/UID and passes `localPlayerId` to `EventRunner`, `PitStopScreen`, `TileResultsScreen`, `ResultsScreen`, and `RaceTrackHUD`.
- **B06 & §6 (Reward summary recomputation):** `fixed` — `runMatchSummaryPipeline` computes `MatchSummary` once inside `updateProfileTransaction` with an immutable `matchId`, persists a match receipt, and delivers the exact committed summary without recomputation.
- **B07 (Ranking inflation & eligibility):** `fixed` — ELO changes gated on `isRanked` and computed with 1-based placements (`+16` / `-16` for equal-rated 2-player match); `ratingChange`/`newRating`/`newTier` included in `MatchSummary`.
- **B08 (Account identity & CP ledger):** `fixed` — `circuitPoints` is the single currency ledger in `normalizeProfile` and `Lobby.tsx`; local profiles bind to `firebaseUid`; `FIREBASE_AUTH_DISABLED=1` rejected when `NODE_ENV === 'production'`.
- **B09 (Firestore daily paths & UTC boundary):** `fixed` — Daily leaderboard uses valid 3-segment collection (`leaderboards/daily_${seed}/entries`) and 4-segment document (`leaderboards/daily_${seed}/entries/${userId}`) paths; `getDailySeed()` uses UTC `YYYY-MM-DD`; `/api/progression/local-match` publishes local/daily/gauntlet runs.
- **B10 (Network pub/sub, reconnect & queue timeout):** `fixed` — `networkService.setHandlers` uses a multi-subscriber `Set`; reconnect token preserved across backoff retries; `onQueueTimeout` keeps `isQueuing = true`.
- **B11 (Tournament authority & lifecycle):** `fixed` — `TournamentRoom` requires `onAuth`, enforces 30s grace timeout on single reports, receives authoritative `onChildMatchFinished` callbacks from `ConfluxRoom`, and restores brackets via `loadTournamentBracket`.
- **B12–B13 (Modes, Workshop, Rematch):** `fixed` — `Lobby.tsx` wires `ModeSelector`, Team Mode (`Rally` / `Shield Wall`), and Workshop pool on first race start; `handleRematch` preserves Gauntlet/Ghost/Standard mode.
- **B14–B15 (Mini-games & skill/module/season contracts):** `fixed` — `FlowConnect` solvable generator + single rotation + `solvedRef` metric; `BalanceBeam` 3★ attainable at all difficulties; `MazeMicro`/`ColorMath`/`SprintMash` pause handling; `ChordMemory` growing rounds + synth notes; `AudioBeat`/`DrumEcho` synth tones; `SeededRNG` across all 47 events; 52-week seasonal rotation and whole-match `hardcore` power-up restriction.

---

## Earlier Issues

### A1: Skill effects non-functional (CRITICAL)
- **Status:** confirmed
- **Evidence:** `gameSetup.ts` L145-180: `applySkillEffects` handles only `tech-t1` (Shield). `speed-t1` is a no-op (`energy = player.energy`). `endurance-t1` is comment-only. 12/15 skills have no effect. `gameRules.ts` reads `_energyPerStarBonus` (L172,179), `_debuffResistance` (L82), `_movementBonus` (L214-215) but these are never set.
- **Affected files:** `shared/gameSetup.ts`, `shared/gameRules.ts`, `hooks/useGameEngine.ts`
- **Root cause:** `useGameEngine.initializeGame` creates players inline without calling `applySkillEffects`. Server calls it but the function is mostly no-ops.
- **Planned fix:** Introduce typed `PlayerModifiers`, implement all 15 skills, wire into both local and online init.

### A2: Module effects non-functional (CRITICAL)
- **Status:** confirmed
- **Evidence:** `gameSetup.ts` L187-225: `applyLoadoutEffects` handles only `core-shield`, `core-energy`, `shielding-powerup`. 6/9 modules are no-ops (comments say "applied during processRaceStep" but no flags set).
- **Affected files:** `shared/gameSetup.ts`, `shared/gameRules.ts`
- **Planned fix:** Implement all 9 modules with typed modifier flags.

### A3: useGameEngine doesn't call applySkillEffects/applyLoadoutEffects (CRITICAL)
- **Status:** confirmed
- **Evidence:** `hooks/useGameEngine.ts` L54-162: `initializeGame` creates players inline, never calls `applySkillEffects` or `applyLoadoutEffects`. No `skills` or `loadout` references in file.
- **Affected files:** `hooks/useGameEngine.ts`
- **Planned fix:** Refactor `initializeGame` to use `createPlayers` from `gameSetup.ts` and apply skill/loadout effects from profile.

### A4: DebuffResistant rival trait is no-op (MEDIUM)
- **Status:** confirmed
- **Evidence:** `botMind.ts` L34-35: `case RivalTraitId.DebuffResistant: break;` — no logic.
- **Affected files:** `shared/botMind.ts`
- **Planned fix:** Implement debuff resistance for rival bots.

### A5: AggressivePowerups rival trait is no-op (MEDIUM)
- **Status:** confirmed
- **Evidence:** `botMind.ts` L36-37: `case RivalTraitId.AggressivePowerups: break;` — no logic. Comment at L805 mentions it but `riskBias` doesn't check for the trait.
- **Affected files:** `shared/botMind.ts`
- **Planned fix:** Implement aggressive power-up usage for rival bots with the trait.

### A6: Rival traits never passed to simulateBotPerformance (MEDIUM)
- **Status:** confirmed
- **Evidence:** `EventRunner.tsx` L118: `simulateBotPerformance(player, event, currentTile.difficulty, settings)` — no `rivalTraits` arg. `ConfluxRoom.ts` L949-951: same, comment says "not available on server yet".
- **Affected files:** `components/EventRunner.tsx`, `server/src/rooms/ConfluxRoom.ts`
- **Planned fix:** Pass rival traits from profile/gameState to bot simulation in both local and online modes.

### B1: No Firebase auth token verification on server (CRITICAL)
- **Status:** confirmed
- **Evidence:** `ConfluxRoom.ts` onJoin accepts optional `userId` from client options without verification.
- **Affected files:** `server/src/rooms/ConfluxRoom.ts`, `server/src/firebaseAdmin.ts`
- **Planned fix:** Add Firebase token verification in onJoin.

### C1: Client-trusted event metrics (CRITICAL)
- **Status:** confirmed
- **Evidence:** `eventValidator.ts` validates shape/bounds but recomputes stars from client-submitted `primaryMetric`/`secondaryMetric`. No replay verification.
- **Affected files:** `server/src/validation/eventValidator.ts`
- **Planned fix:** Add bounded telemetry anomaly detection, bind submissions to server-issued nonces.

### C2: Tournament result spoofing (HIGH)
- **Status:** confirmed
- **Evidence:** `TournamentRoom.ts` accepts `REPORT_TOURNAMENT_RESULT` without verifying reporter was in match.
- **Affected files:** `server/src/rooms/TournamentRoom.ts`
- **Planned fix:** Verify reporter is a match participant, bind to authoritative match completion.

### D1: Tournament state in-memory only (HIGH)
- **Status:** confirmed
- **Evidence:** `TournamentRoom.ts` L19-22: bracket state in-memory, no persistence.
- **Affected files:** `server/src/rooms/TournamentRoom.ts`
- **Planned fix:** Persist bracket to Firestore.

### D2: Firebase repository silent failures (HIGH)
- **Status:** confirmed
- **Evidence:** All 3 repositories log errors but don't retry.
- **Affected files:** `server/src/services/*.ts`
- **Planned fix:** Add retry with exponential backoff.

### D3: Profile sync race condition (MEDIUM)
- **Status:** confirmed
- **Evidence:** `firebaseProfileService.ts` read-then-write without transaction.
- **Affected files:** `services/firebaseProfileService.ts`
- **Planned fix:** Use Firestore transaction.

### E1: Matchmaking race condition (MEDIUM)
- **Status:** partial — needs verification
- **Evidence:** Audit claims queue filter before async createMatch. Needs code review.
- **Affected files:** `server/src/rooms/MatchmakingRoom.ts`

### F1: Settings dual source of truth (LOW)
- **Status:** confirmed
- **Evidence:** `Lobby.tsx` and `SettingsScreen.tsx` both manage settings with different shapes.
- **Affected files:** `components/Lobby.tsx`, `components/SettingsScreen.tsx`

### F2: Tailwind CDN in production (MEDIUM)
- **Status:** confirmed
- **Evidence:** `index.html` loads Tailwind from CDN.
- **Affected files:** `index.html`, build config

### F3: Event-level audio/haptics missing (MEDIUM)
- **Status:** confirmed
- **Evidence:** grep verified: zero events import audioService/playSound/useSound/hapticsService.
- **Affected files:** all 48 event files
- **Planned fix:** Create shared `useEventFeedback` hook, integrate at key interaction points.

### F4: useCountdown dead code (LOW)
- **Status:** confirmed
- **Evidence:** `hooks/useCountdown.ts` exists but `Countdown.tsx` has inline timer.
- **Affected files:** `hooks/useCountdown.ts`, `components/Countdown.tsx`

### F5: isOverdriving prop drift (LOW)
- **Status:** confirmed
- **Evidence:** `EventRunner.tsx` L236 passes `isOverdriving` but most events don't declare it.
- **Affected files:** `components/EventRunner.tsx`, event files

### G1: ConfluxRoom god object (MEDIUM)
- **Status:** confirmed
- **Evidence:** 1297 lines, 13 handlers, 5 concerns.
- **Affected files:** `server/src/rooms/ConfluxRoom.ts`

### G2: Missing tests for botMind, gameRules, networkService (HIGH)
- **Status:** confirmed
- **Evidence:** No test files exist for these 3 critical modules.
- **Affected files:** (new test files)

### G3: No lint config (LOW)
- **Status:** confirmed
- **Evidence:** No eslint/prettier config files found.

### G4: Seasonal modifiers not activated (LOW)
- **Status:** confirmed
- **Evidence:** `getActiveSeasonalModifier()` defined in constants but never called in game loop.
- **Affected files:** `hooks/useGameEngine.ts`, `shared/gameRules.ts`

### CORRECTED AUDIT CLAIMS
- All 48 events are real (NOT stubs) — verified
- All 9 anomalies are wired — verified
- Tournament networkService methods are real (NOT stubs) — verified
- Hangar/SkillTree/Settings CSS is partial (NOT missing) — verified
