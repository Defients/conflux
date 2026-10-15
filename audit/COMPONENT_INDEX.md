# Component index and execution-grade progress map

Companion to [the full audit](C:/myProjects/ConfluxCircuit/audit/DEVELOPMENT_STATE_AUDIT.md). All percentages are INFERENCE/judgment from observed integration and defects, not test coverage. Source symbols/imports are FACT from static extraction. No item is declared Shipping or battle-tested.

## Every registered mini-game

Common upstream: EventProps, React, registry metadata and event timing; downstream: raw metric → client/server scorer → race rules → summary. All are reachable through Workshop and eligible generated event pools. Every event needs the canonical clock, command validation and browser acceptance work described in B01/B04/B14. No event has been individually certified end-to-end. Randomness/pause-reference counts are signals, not proof of correctness.

| Event / purpose | Status / completion | Source | Duration d1/d2/d3 (seconds) | Specific gaps / duplication |
|---|---|---|---|---|
| Balance Beam — Keep the ball balanced on the beam as long as possible. The beam tilts randomly — counteract it! | Partial 45% | [events/BalanceBeam.tsx](C:/myProjects/ConfluxCircuit/events/BalanceBeam.tsx) | 12/10/8 | B14: unattainable top score at harder difficulties; contains unseeded randomness |
| Reaction Tap — Tap when the panel turns green. Don't tap too early! | Partial 55% | [events/ReactionTap.tsx](C:/myProjects/ConfluxCircuit/events/ReactionTap.tsx) | 8/8/8 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| System Purge — Type the valid commands. Use Spacebar to skip corrupted commands. | Partial 55% | [events/SystemPurge.tsx](C:/myProjects/ConfluxCircuit/events/SystemPurge.tsx) | 14/13/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Type Burst — Type the phrase exactly as shown. Correct errors to finish. | Partial 55% | [events/TypeBurst.tsx](C:/myProjects/ConfluxCircuit/events/TypeBurst.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors; contains unseeded randomness |
| Quick Quiz — Answer 3 questions as quickly as possible. | Partial 55% | [events/QuickQuiz.tsx](C:/myProjects/ConfluxCircuit/events/QuickQuiz.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Aim Flick — Drag and release to shoot the projectile into the goal. | Partial 55% | [events/AimFlick.tsx](C:/myProjects/ConfluxCircuit/events/AimFlick.tsx) | 10/10/10 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Memory Flip — Find all the matching pairs of cards. | Partial 55% | [events/MemoryFlip.tsx](C:/myProjects/ConfluxCircuit/events/MemoryFlip.tsx) | 20/20/20 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Slider Precision — Stop the slider at the target value. | Partial 55% | [events/SliderPrecision.tsx](C:/myProjects/ConfluxCircuit/events/SliderPrecision.tsx) | 10/10/10 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Pattern Recall — Memorize and repeat the sequence. | Partial 55% | [events/PatternRecall.tsx](C:/myProjects/ConfluxCircuit/events/PatternRecall.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Evade Grid — Survive the hazards until the timer runs out. | Partial 55% | [events/EvadeGrid.tsx](C:/myProjects/ConfluxCircuit/events/EvadeGrid.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors; contains unseeded randomness |
| Jump Bar — Time your jump to clear the bar. | Partial 55% | [events/JumpBar.tsx](C:/myProjects/ConfluxCircuit/events/JumpBar.tsx) | 20/25/30 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors; contains unseeded randomness |
| Wire Link — Connect the matching nodes without crossing wires. | Partial 55% | [events/WireLink.tsx](C:/myProjects/ConfluxCircuit/events/WireLink.tsx) | 20/25/30 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Maze Micro — Use arrow keys to reach the exit as fast as possible. | Partial 45% | [events/MazeMicro.tsx](C:/myProjects/ConfluxCircuit/events/MazeMicro.tsx) | 15/18/21 | B14: pause ignored and unsolved timeout presentation |
| Find the Missing Pixel — Spot the difference between the two images. | Partial 55% | [events/FindPixel.tsx](C:/myProjects/ConfluxCircuit/events/FindPixel.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Target Practice — Click on the targets as they appear. Don't miss! | Partial 55% | [events/TargetPractice.tsx](C:/myProjects/ConfluxCircuit/events/TargetPractice.tsx) | 10/10/10 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors; contains unseeded randomness |
| Rhythm Tap — Tap the spacebar in time with the pulse. | Partial 55% | [events/RhythmTap.tsx](C:/myProjects/ConfluxCircuit/events/RhythmTap.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Sequence Sort — Memorize the number sequence, then click them in the correct order. | Partial 55% | [events/SequenceSort.tsx](C:/myProjects/ConfluxCircuit/events/SequenceSort.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Asteroid Dodge — Use the arrow keys to dodge the falling asteroids. | Partial 55% | [events/AsteroidDodge.tsx](C:/myProjects/ConfluxCircuit/events/AsteroidDodge.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors; contains unseeded randomness |
| Path Tracer — Trace the path with your mouse without leaving the lines. | Partial 55% | [events/PathTracer.tsx](C:/myProjects/ConfluxCircuit/events/PathTracer.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Code Breaker — Guess the secret code using the clues provided. | Partial 55% | [events/CodeBreaker.tsx](C:/myProjects/ConfluxCircuit/events/CodeBreaker.tsx) | 25/30/35 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Quick Math — Solve as many math problems as you can before time runs out. | Partial 55% | [events/QuickMath.tsx](C:/myProjects/ConfluxCircuit/events/QuickMath.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Color Math — Adjust the sliders to match the target color. | Partial 45% | [events/ColorMath.tsx](C:/myProjects/ConfluxCircuit/events/ColorMath.tsx) | 13/14/15 | B14: pause ignored |
| Angle Nudge — Rotate the dial to the target angle and confirm. | Partial 55% | [events/AngleNudge.tsx](C:/myProjects/ConfluxCircuit/events/AngleNudge.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Type-Racer Snippet — Type the short phrase as fast as possible. You must correct errors. | Partial 55% | [events/TypeRacerSnippet.tsx](C:/myProjects/ConfluxCircuit/events/TypeRacerSnippet.tsx) | 8/8/8 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Snapshot Memory — Memorize the grid, then answer questions about the symbol locations. | Partial 55% | [events/SnapshotMemory.tsx](C:/myProjects/ConfluxCircuit/events/SnapshotMemory.tsx) | 13/14/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Burst Clicks — Click the target as fast as you can for 5 seconds. Avoid inhuman speeds! | Partial 55% | [events/BurstClicks.tsx](C:/myProjects/ConfluxCircuit/events/BurstClicks.tsx) | 5/5/5 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Sprint Mash — Alternate keys (A/D) with a steady rhythm to sprint. Spamming will stall you! | Partial 45% | [events/SprintMash.tsx](C:/myProjects/ConfluxCircuit/events/SprintMash.tsx) | 7/7/7 | B14: pause ignored |
| Ghost Trajectory — Watch the launch, then click where you think the object will land. | Partial 55% | [events/GhostTrajectory.tsx](C:/myProjects/ConfluxCircuit/events/GhostTrajectory.tsx) | 11/12/13 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Emoji Cipher — Use the legend to decode the secret word. | Partial 55% | [events/EmojiCipher.tsx](C:/myProjects/ConfluxCircuit/events/EmojiCipher.tsx) | 16/17/18 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Audio Beat Match — Select the option that matches the reference beat. | Partial 50% | [events/AudioBeat.tsx](C:/myProjects/ConfluxCircuit/events/AudioBeat.tsx) | 12/12/12 | B14: visual rhythm without tone playback |
| Whack-a-Mole — Click the moles before they retreat! | Partial 55% | [events/WhackAMole.tsx](C:/myProjects/ConfluxCircuit/events/WhackAMole.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Stop the Clock — Stop the timer at the exact target time. 3 rounds, lowest average error wins! | Partial 55% | [events/StopTheClock.tsx](C:/myProjects/ConfluxCircuit/events/StopTheClock.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Word Storm — Type the falling words to destroy them before they hit the bottom! | Partial 55% | [events/WordStorm.tsx](C:/myProjects/ConfluxCircuit/events/WordStorm.tsx) | 14/13/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Anagram Rush — Unscramble as many words as you can before time runs out! | Partial 55% | [events/AnagramRush.tsx](C:/myProjects/ConfluxCircuit/events/AnagramRush.tsx) | 13/14/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Dial Lock — Rotate the dial to find the hidden unlock position. Warm/cold feedback guides you. 3 locks! | Partial 55% | [events/DialLock.tsx](C:/myProjects/ConfluxCircuit/events/DialLock.tsx) | 20/25/30 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Pixel Push — Push the block into the target zone. It has momentum — tap carefully! 3 rounds. | Partial 55% | [events/PixelPush.tsx](C:/myProjects/ConfluxCircuit/events/PixelPush.tsx) | 15/15/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Mirror Draw — Trace the shape — but your cursor is mirrored horizontally! | Partial 55% | [events/MirrorDraw.tsx](C:/myProjects/ConfluxCircuit/events/MirrorDraw.tsx) | 13/14/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Number Stack — Memorize the number sequence, then type it in REVERSE order! | Partial 55% | [events/NumberStack.tsx](C:/myProjects/ConfluxCircuit/events/NumberStack.tsx) | 13/16/19 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Symbol Match — Memorize the symbol set, then click only those symbols from the grid. | Partial 55% | [events/SymbolMatch.tsx](C:/myProjects/ConfluxCircuit/events/SymbolMatch.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Drum Echo — Watch the drum pattern, then reproduce it on the pads with the same rhythm! | Partial 50% | [events/DrumEcho.tsx](C:/myProjects/ConfluxCircuit/events/DrumEcho.tsx) | 13/14/15 | B14: visual rhythm without tone playback |
| Wave Ride — Keep your marker on the scrolling sine wave. The wave shifts over time! | Partial 55% | [events/WaveRide.tsx](C:/myProjects/ConfluxCircuit/events/WaveRide.tsx) | 11/12/13 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Color Sort — Click the matching colored bin to sort each falling orb. Speed up! | Partial 55% | [events/ColorSort.tsx](C:/myProjects/ConfluxCircuit/events/ColorSort.tsx) | 12/12/12 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Flow Connect — Rotate the pipe tiles to connect the source to the destination. | Partial 40% | [events/FlowConnect.tsx](C:/myProjects/ConfluxCircuit/events/FlowConnect.tsx) | 25/30/35 | B14: solvability, visual/logical rotation and stale success closure |
| Logic Gates — Determine the output of each logic gate circuit. Answer as many as you can! | Partial 55% | [events/LogicGates.tsx](C:/myProjects/ConfluxCircuit/events/LogicGates.tsx) | 13/14/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Tilt Maze — Navigate the ball through the maze to the exit. Tilt with arrow keys or mouse movement! | Partial 55% | [events/TiltMaze.tsx](C:/myProjects/ConfluxCircuit/events/TiltMaze.tsx) | 25/20/15 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |
| Chord Memory — Watch the sequence of colored notes light up, then replay them in order. The sequence grows! | Partial 50% | [events/ChordMemory.tsx](C:/myProjects/ConfluxCircuit/events/ChordMemory.tsx) | 14/16/18 | B14: progression differs from description |
| Word Scramble — Unscramble the jumbled cyberpunk words as fast as you can! | Partial 55% | [events/WordScramble.tsx](C:/myProjects/ConfluxCircuit/events/WordScramble.tsx) | 20/25/30 | Runtime/input/pause/mobile behavior unverified; scoring duplicated in server descriptors |

## Every scanned file and implementation unit

Each row is a leaf component/artifact; subsystem-level purpose, dependencies, blockers and completion judgment are expanded in the main matrix. The JSON index supplies every detected named function/class/interface/export with source line and all imports (upstream dependencies). Incoming imports can be resolved from that same graph. Build/test/config reachability must not be confused with user navigation.

| File | Purpose | Status / completion | Access path | Missing integration / risk |
|---|---|---|---|---|
| [.firebaserc](C:/myProjects/ConfluxCircuit/.firebaserc) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [.github/workflows/ci.yml](C:/myProjects/ConfluxCircuit/.github/workflows/ci.yml) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [.gitignore](C:/myProjects/ConfluxCircuit/.gitignore) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [App.tsx](C:/myProjects/ConfluxCircuit/App.tsx) | Coordinates screens, profiles, local/online races and completion | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [CHANGELOG.md](C:/myProjects/ConfluxCircuit/CHANGELOG.md) | Documents development behavior/plans | Partial 40% | Developer documentation | Stale claims must be reconciled against current source |
| [MULTIPLAYER_ARCHITECTURE.md](C:/myProjects/ConfluxCircuit/MULTIPLAYER_ARCHITECTURE.md) | Documents development behavior/plans | Partial 40% | Developer documentation | Stale claims must be reconciled against current source |
| [PATCH_NOTES.md](C:/myProjects/ConfluxCircuit/PATCH_NOTES.md) | Documents development behavior/plans | Partial 40% | Developer documentation | Stale claims must be reconciled against current source |
| [README.md](C:/myProjects/ConfluxCircuit/README.md) | Documents development behavior/plans | Partial 40% | Developer documentation | Stale claims must be reconciled against current source |
| [REMEDIATION_LEDGER.md](C:/myProjects/ConfluxCircuit/REMEDIATION_LEDGER.md) | Documents development behavior/plans | Partial 40% | Developer documentation | Stale claims must be reconciled against current source |
| [TODO.md](C:/myProjects/ConfluxCircuit/TODO.md) | Documents development behavior/plans | Partial 40% | Developer documentation | Stale claims must be reconciled against current source |
| [components/AccoladesScreen.tsx](C:/myProjects/ConfluxCircuit/components/AccoladesScreen.tsx) | Displays unlocked achievements | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/ConnectionIndicator.tsx](C:/myProjects/ConfluxCircuit/components/ConnectionIndicator.tsx) | Displays connection quality and reconnect state | Partial 40% | Online UI and socket events | B05/B10: identity, subscribers, reconnect and cache |
| [components/Countdown.tsx](C:/myProjects/ConfluxCircuit/components/Countdown.tsx) | Presents the pre-event countdown | Partial 45% | Active race/practice | B02/B04/B05: phases, clock and player identity |
| [components/DebugPanel.tsx](C:/myProjects/ConfluxCircuit/components/DebugPanel.tsx) | Displays/copies complete race state | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/ErrorBoundary.tsx](C:/myProjects/ConfluxCircuit/components/ErrorBoundary.tsx) | Catches React rendering failures | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/EventList.tsx](C:/myProjects/ConfluxCircuit/components/EventList.tsx) | Filters/selects event pool and manages presets and practice entry | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/EventPlaytestRunner.tsx](C:/myProjects/ConfluxCircuit/components/EventPlaytestRunner.tsx) | Verifies EventPlaytestRunner with unit/integration fixtures | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/EventRunner.tsx](C:/myProjects/ConfluxCircuit/components/EventRunner.tsx) | Hosts events, telemetry, powers and race interactions | Partial 45% | Active race/practice | B02/B04/B05: phases, clock and player identity |
| [components/ExplainEventModal.tsx](C:/myProjects/ConfluxCircuit/components/ExplainEventModal.tsx) | Explains event instructions and scoring | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/GhostRaceScreen.tsx](C:/myProjects/ConfluxCircuit/components/GhostRaceScreen.tsx) | Fetches and selects a ghost opponent | Partial 30% | Code path exists; UI entry disconnected | See B12: replay contract and lifecycle isolation |
| [components/HangarScreen.tsx](C:/myProjects/ConfluxCircuit/components/HangarScreen.tsx) | Purchases and equips chassis modules | Partial 55% | Lobby/navigation | B08/B13/B15: currency, persistence and semantic drift |
| [components/LeaderboardScreen.tsx](C:/myProjects/ConfluxCircuit/components/LeaderboardScreen.tsx) | Displays all-time, daily and gauntlet rankings | Partial 40% | Cloud UI or finish projection | B09: paths, missing mode publishing and silent errors |
| [components/Lobby.tsx](C:/myProjects/ConfluxCircuit/components/Lobby.tsx) | Configures local races and exposes progression/navigation | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/MatchHistoryScreen.tsx](C:/myProjects/ConfluxCircuit/components/MatchHistoryScreen.tsx) | Reads finished match history and replays seeds | Partial 40% | Cloud UI or finish projection | B09: paths, missing mode publishing and silent errors |
| [components/ModeSelector.tsx](C:/myProjects/ConfluxCircuit/components/ModeSelector.tsx) | Selects local, online, ranked, ghost and tournament modes | Partial 25% | No ordinary lobby entry | Navigation is disconnected |
| [components/OnboardingFlow.tsx](C:/myProjects/ConfluxCircuit/components/OnboardingFlow.tsx) | Introduces pilot setup and gameplay | Partial 25% | No ordinary lobby entry | Navigation is disconnected |
| [components/OnlineLobby.tsx](C:/myProjects/ConfluxCircuit/components/OnlineLobby.tsx) | Creates/joins/discovers rooms, queues, moderates and exposes spectating | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/PilotProfileSetup.tsx](C:/myProjects/ConfluxCircuit/components/PilotProfileSetup.tsx) | Creates/selects a local pilot | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/PitStopScreen.tsx](C:/myProjects/ConfluxCircuit/components/PitStopScreen.tsx) | Chooses energy-funded recovery/utility actions | Partial 45% | Active race/practice | B02/B04/B05: phases, clock and player identity |
| [components/PowerUpIcon.tsx](C:/myProjects/ConfluxCircuit/components/PowerUpIcon.tsx) | Renders power-up symbols | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/RaceTrackHUD.tsx](C:/myProjects/ConfluxCircuit/components/RaceTrackHUD.tsx) | Shows track, standings, energy, status and commands | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/RankBadge.tsx](C:/myProjects/ConfluxCircuit/components/RankBadge.tsx) | Displays rating tier | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/ResultsScreen.tsx](C:/myProjects/ConfluxCircuit/components/ResultsScreen.tsx) | Displays final standings and reward summary | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/RivalInterventionModal.tsx](C:/myProjects/ConfluxCircuit/components/RivalInterventionModal.tsx) | Accepts/rejects rival hazard/sabotage/veto offer | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/RivalTauntOverlay.tsx](C:/myProjects/ConfluxCircuit/components/RivalTauntOverlay.tsx) | Displays timed rival dialogue | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/SettingsScreen.tsx](C:/myProjects/ConfluxCircuit/components/SettingsScreen.tsx) | Edits sound, haptic and accessibility preferences | Partial 55% | Lobby/navigation | B08/B13/B15: currency, persistence and semantic drift |
| [components/SkillTreeScreen.tsx](C:/myProjects/ConfluxCircuit/components/SkillTreeScreen.tsx) | Purchases skill nodes with prerequisites | Partial 55% | Lobby/navigation | B08/B13/B15: currency, persistence and semantic drift |
| [components/SpectatorOverlay.tsx](C:/myProjects/ConfluxCircuit/components/SpectatorOverlay.tsx) | Selects observed player and presents spectator controls | Partial 25% | Button/code exists; complete admission blocked | See B12: auth, ID and lock barriers |
| [components/TileResultsScreen.tsx](C:/myProjects/ConfluxCircuit/components/TileResultsScreen.tsx) | Displays tile performance and movement | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/TimerBar.tsx](C:/myProjects/ConfluxCircuit/components/TimerBar.tsx) | Shows event countdown progress | Partial 45% | Active race/practice | B02/B04/B05: phases, clock and player identity |
| [components/Toast.tsx](C:/myProjects/ConfluxCircuit/components/Toast.tsx) | Presents temporary effect notifications | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [components/TournamentScreen.tsx](C:/myProjects/ConfluxCircuit/components/TournamentScreen.tsx) | Displays bracket, joins and enters tournament matches | Partial 25% | Server callable; UI entry disconnected | See B11: authority, persistence, admission and return flow |
| [components/WelcomePopup.tsx](C:/myProjects/ConfluxCircuit/components/WelcomePopup.tsx) | Presents first-visit introduction | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [constants.ts](C:/myProjects/ConfluxCircuit/constants.ts) | Defines game content, balance values and configuration catalogs | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [eslint.config.js](C:/myProjects/ConfluxCircuit/eslint.config.js) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [events/EventStub.tsx](C:/myProjects/ConfluxCircuit/events/EventStub.tsx) | Application entry, metadata, asset or build contract | Deprecated 15% | No ordinary active path | Unused scaffold/compatibility export; verify references before removal |
| [events/eventRegistry.ts](C:/myProjects/ConfluxCircuit/events/eventRegistry.ts) | Registers all 47 event descriptions, durations, scoring and lazy components | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [firebase.json](C:/myProjects/ConfluxCircuit/firebase.json) | Initializes Firebase client and anonymous sessions | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [firestore.rules](C:/myProjects/ConfluxCircuit/firestore.rules) | Configures build, deployment or access policy | Partial 35% | Indirect: finish/auth/storage | See B06–B09 and R13: authority, identity, receipts |
| [hooks/useConnectionStatus.ts](C:/myProjects/ConfluxCircuit/hooks/useConnectionStatus.ts) | Subscribes to connection metrics | Partial 40% | Online UI and socket events | B05/B10: identity, subscribers, reconnect and cache |
| [hooks/useEventFeedback.ts](C:/myProjects/ConfluxCircuit/hooks/useEventFeedback.ts) | Unifies event sound/haptic feedback | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [hooks/useGameEngine.ts](C:/myProjects/ConfluxCircuit/hooks/useGameEngine.ts) | Constructs local/ghost/gauntlet state and applies rules/effects | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [hooks/useOnlineGame.ts](C:/myProjects/ConfluxCircuit/hooks/useOnlineGame.ts) | Maps network events to online state and commands | Partial 40% | Online UI and socket events | B05/B10: identity, subscribers, reconnect and cache |
| [hooks/useOnlineScreenSync.ts](C:/myProjects/ConfluxCircuit/hooks/useOnlineScreenSync.ts) | Maps online phases into App screens | Partial 40% | Online UI and socket events | B05/B10: identity, subscribers, reconnect and cache |
| [hooks/useScreenTransition.ts](C:/myProjects/ConfluxCircuit/hooks/useScreenTransition.ts) | Unused transition abstraction | Deprecated 15% | No ordinary active path | Unused scaffold/compatibility export; verify references before removal |
| [hooks/useSound.ts](C:/myProjects/ConfluxCircuit/hooks/useSound.ts) | Exposes audio singleton to components | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [index.css](C:/myProjects/ConfluxCircuit/index.css) | Defines application styles and animation | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [index.html](C:/myProjects/ConfluxCircuit/index.html) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [index.tsx](C:/myProjects/ConfluxCircuit/index.tsx) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [manifest.json](C:/myProjects/ConfluxCircuit/manifest.json) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [metadata.json](C:/myProjects/ConfluxCircuit/metadata.json) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [netlify.toml](C:/myProjects/ConfluxCircuit/netlify.toml) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [package-lock.json](C:/myProjects/ConfluxCircuit/package-lock.json) | Pins transitive dependencies | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [package.json](C:/myProjects/ConfluxCircuit/package.json) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [public/_redirects](C:/myProjects/ConfluxCircuit/public/_redirects) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [render.yaml](C:/myProjects/ConfluxCircuit/render.yaml) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [server/RENDER_DEPLOY.md](C:/myProjects/ConfluxCircuit/server/RENDER_DEPLOY.md) | Documents development behavior/plans | Partial 40% | Developer documentation | Stale claims must be reconciled against current source |
| [server/package-lock.json](C:/myProjects/ConfluxCircuit/server/package-lock.json) | Pins transitive dependencies | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [server/package.json](C:/myProjects/ConfluxCircuit/server/package.json) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [server/src/__tests__/ConfluxRoom.test.ts](C:/myProjects/ConfluxCircuit/server/src/__tests__/ConfluxRoom.test.ts) | Verifies ConfluxRoom with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [server/src/__tests__/eventValidator.test.ts](C:/myProjects/ConfluxCircuit/server/src/__tests__/eventValidator.test.ts) | Verifies eventValidator with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [server/src/__tests__/matchmaking.integration.test.ts](C:/myProjects/ConfluxCircuit/server/src/__tests__/matchmaking.integration.test.ts) | Verifies matchmaking.integration with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [server/src/__tests__/restApi.test.ts](C:/myProjects/ConfluxCircuit/server/src/__tests__/restApi.test.ts) | Verifies restApi with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [server/src/__tests__/retry.test.ts](C:/myProjects/ConfluxCircuit/server/src/__tests__/retry.test.ts) | Verifies retry with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [server/src/__tests__/tournament.integration.test.ts](C:/myProjects/ConfluxCircuit/server/src/__tests__/tournament.integration.test.ts) | Verifies tournament.integration with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [server/src/__tests__/verifyToken.test.ts](C:/myProjects/ConfluxCircuit/server/src/__tests__/verifyToken.test.ts) | Verifies verifyToken with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [server/src/auth/verifyToken.ts](C:/myProjects/ConfluxCircuit/server/src/auth/verifyToken.ts) | Verifies Firebase tokens and development bypass | Partial 35% | Indirect: finish/auth/storage | See B06–B09 and R13: authority, identity, receipts |
| [server/src/createExpressApp.ts](C:/myProjects/ConfluxCircuit/server/src/createExpressApp.ts) | Configures CORS/JSON and health, diagnostics, discovery endpoints | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/src/eventDescriptors.ts](C:/myProjects/ConfluxCircuit/server/src/eventDescriptors.ts) | Duplicates event descriptors/scoring for server use | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/src/firebaseAdmin.ts](C:/myProjects/ConfluxCircuit/server/src/firebaseAdmin.ts) | Initializes Admin SDK and exposes readiness state | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/src/gameServerConfig.ts](C:/myProjects/ConfluxCircuit/server/src/gameServerConfig.ts) | Registers gameplay, queue and tournament rooms | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/src/index.ts](C:/myProjects/ConfluxCircuit/server/src/index.ts) | Application entry, metadata, asset or build contract | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [server/src/rooms/ConfluxRoom.ts](C:/myProjects/ConfluxCircuit/server/src/rooms/ConfluxRoom.ts) | Owns authoritative match lifecycle and gameplay commands | Partial 35% | WebSocket match room | B01–B07: command/phase/clock/receipt integrity |
| [server/src/rooms/MatchmakingRoom.ts](C:/myProjects/ConfluxCircuit/server/src/rooms/MatchmakingRoom.ts) | Groups waiting players and reserves gameplay seats | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/src/rooms/TournamentRoom.ts](C:/myProjects/ConfluxCircuit/server/src/rooms/TournamentRoom.ts) | Builds/advances tournament brackets and child rooms | Partial 25% | Server callable; UI entry disconnected | See B11: authority, persistence, admission and return flow |
| [server/src/services/leaderboardRepository.ts](C:/myProjects/ConfluxCircuit/server/src/services/leaderboardRepository.ts) | Writes ranking projection documents | Partial 40% | Cloud UI or finish projection | B09: paths, missing mode publishing and silent errors |
| [server/src/services/matchHistoryRepository.ts](C:/myProjects/ConfluxCircuit/server/src/services/matchHistoryRepository.ts) | Writes personal match history | Partial 40% | Cloud UI or finish projection | B09: paths, missing mode publishing and silent errors |
| [server/src/services/matchSummaryPipeline.ts](C:/myProjects/ConfluxCircuit/server/src/services/matchSummaryPipeline.ts) | Coordinates profile transaction, projections and summary delivery | Partial 35% | Indirect: finish/auth/storage | See B06–B09 and R13: authority, identity, receipts |
| [server/src/services/profileRepository.ts](C:/myProjects/ConfluxCircuit/server/src/services/profileRepository.ts) | Reads/writes/transacts authoritative profiles | Partial 35% | Indirect: finish/auth/storage | See B06–B09 and R13: authority, identity, receipts |
| [server/src/services/retry.ts](C:/myProjects/ConfluxCircuit/server/src/services/retry.ts) | Retries transient persistence errors with backoff | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/src/services/tournamentRepository.ts](C:/myProjects/ConfluxCircuit/server/src/services/tournamentRepository.ts) | Saves, loads and deletes tournament brackets | Partial 25% | Server callable; UI entry disconnected | See B11: authority, persistence, admission and return flow |
| [server/src/validation/eventValidator.ts](C:/myProjects/ConfluxCircuit/server/src/validation/eventValidator.ts) | Checks event telemetry plausibility | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/src/validation/rateLimiter.ts](C:/myProjects/ConfluxCircuit/server/src/validation/rateLimiter.ts) | Limits selected commands with per-client token buckets | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [server/tsconfig.json](C:/myProjects/ConfluxCircuit/server/tsconfig.json) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [server/vitest.config.ts](C:/myProjects/ConfluxCircuit/server/vitest.config.ts) | Verifies vitest.config with unit/integration fixtures | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [services/__tests__/firebaseGhostService.test.ts](C:/myProjects/ConfluxCircuit/services/__tests__/firebaseGhostService.test.ts) | Verifies firebaseGhostService with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [services/__tests__/networkService.test.ts](C:/myProjects/ConfluxCircuit/services/__tests__/networkService.test.ts) | Verifies networkService with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [services/audioService.ts](C:/myProjects/ConfluxCircuit/services/audioService.ts) | Loads external sounds and synthesizes fallback feedback | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/botMind.ts](C:/myProjects/ConfluxCircuit/services/botMind.ts) | Simulates bot metrics and strategic commands | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/firebase.ts](C:/myProjects/ConfluxCircuit/services/firebase.ts) | Initializes Firebase client and anonymous sessions | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/firebaseGhostService.ts](C:/myProjects/ConfluxCircuit/services/firebaseGhostService.ts) | Reads and publishes ghost run documents | Partial 30% | Code path exists; UI entry disconnected | See B12: replay contract and lifecycle isolation |
| [services/firebaseProfileService.ts](C:/myProjects/ConfluxCircuit/services/firebaseProfileService.ts) | Fetches and writes complete cloud profiles | Partial 35% | Indirect: finish/auth/storage | See B06–B09 and R13: authority, identity, receipts |
| [services/gameRules.ts](C:/myProjects/ConfluxCircuit/services/gameRules.ts) | Processes race steps, powers, overdrive, pit stops and interventions | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/hapticsService.ts](C:/myProjects/ConfluxCircuit/services/hapticsService.ts) | Provides browser vibration patterns | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/leaderboardService.ts](C:/myProjects/ConfluxCircuit/services/leaderboardService.ts) | Reads ranking queries | Partial 40% | Cloud UI or finish projection | B09: paths, missing mode publishing and silent errors |
| [services/matchHistoryService.ts](C:/myProjects/ConfluxCircuit/services/matchHistoryService.ts) | Reads personal match documents | Partial 40% | Cloud UI or finish projection | B09: paths, missing mode publishing and silent errors |
| [services/nebulaGenerator.ts](C:/myProjects/ConfluxCircuit/services/nebulaGenerator.ts) | Generates seeded procedural background texture | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/networkService.ts](C:/myProjects/ConfluxCircuit/services/networkService.ts) | Owns room/queue/tournament sockets, callbacks, reconnect and telemetry cache | Partial 40% | Online UI and socket events | B05/B10: identity, subscribers, reconnect and cache |
| [services/pathGenerator.ts](C:/myProjects/ConfluxCircuit/services/pathGenerator.ts) | Generates seeded tile/event/modifier paths | Partial 45% | Race setup | B03: bounded generation and input validation |
| [services/presetService.ts](C:/myProjects/ConfluxCircuit/services/presetService.ts) | Persists Workshop event pools | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/profileService.ts](C:/myProjects/ConfluxCircuit/services/profileService.ts) | Manages local accounts, normalization, migration and purchases | Partial 55% | Lobby/navigation | B08/B13/B15: currency, persistence and semantic drift |
| [services/rivalBanter.ts](C:/myProjects/ConfluxCircuit/services/rivalBanter.ts) | Selects contextual rival dialogue | Deprecated 15% | No ordinary active path | Unused scaffold/compatibility export; verify references before removal |
| [services/seededRNG.ts](C:/myProjects/ConfluxCircuit/services/seededRNG.ts) | Produces deterministic pseudo-random values | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [services/shareService.ts](C:/myProjects/ConfluxCircuit/services/shareService.ts) | Encodes/decodes race settings in URL-safe workflow | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/__tests__/botMind.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/botMind.test.ts) | Verifies botMind with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/contractService.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/contractService.test.ts) | Verifies contractService with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/gameRules.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/gameRules.test.ts) | Verifies gameRules with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/gameSetup.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/gameSetup.test.ts) | Verifies gameSetup with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/matchSummary.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/matchSummary.test.ts) | Verifies matchSummary with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/pathGenerator.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/pathGenerator.test.ts) | Verifies pathGenerator with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/phase3.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/phase3.test.ts) | Verifies phase3 with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/rankSystem.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/rankSystem.test.ts) | Verifies rankSystem with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/__tests__/seededRNG.test.ts](C:/myProjects/ConfluxCircuit/shared/__tests__/seededRNG.test.ts) | Verifies seededRNG with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/botMind.ts](C:/myProjects/ConfluxCircuit/shared/botMind.ts) | Simulates bot metrics and strategic commands | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/constants.ts](C:/myProjects/ConfluxCircuit/shared/constants.ts) | Defines game content, balance values and configuration catalogs | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/contractService.ts](C:/myProjects/ConfluxCircuit/shared/contractService.ts) | Generates and evaluates sponsor objectives | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/dailyChallengeService.ts](C:/myProjects/ConfluxCircuit/shared/dailyChallengeService.ts) | Derives daily/weekly seeds and stores personal best | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/gameRules.ts](C:/myProjects/ConfluxCircuit/shared/gameRules.ts) | Processes race steps, powers, overdrive, pit stops and interventions | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/gameSetup.ts](C:/myProjects/ConfluxCircuit/shared/gameSetup.ts) | Builds players and applies skills/loadouts/syndicates/seasons | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/index.ts](C:/myProjects/ConfluxCircuit/shared/index.ts) | Application entry, metadata, asset or build contract | Deprecated 15% | No ordinary active path | Unused scaffold/compatibility export; verify references before removal |
| [shared/matchSummary.test.ts](C:/myProjects/ConfluxCircuit/shared/matchSummary.test.ts) | Verifies matchSummary with unit/integration fixtures | Integrated 65% | Developer: test runner | Existing suite passes; does not establish journey completeness |
| [shared/matchSummary.ts](C:/myProjects/ConfluxCircuit/shared/matchSummary.ts) | Computes/applies reward, mastery, accolade and progression summaries | Partial 35% | Indirect: finish/auth/storage | See B06–B09 and R13: authority, identity, receipts |
| [shared/pathGenerator.ts](C:/myProjects/ConfluxCircuit/shared/pathGenerator.ts) | Generates seeded tile/event/modifier paths | Partial 45% | Race setup | B03: bounded generation and input validation |
| [shared/protocol.ts](C:/myProjects/ConfluxCircuit/shared/protocol.ts) | Defines room names, commands and server payloads | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/rankSystem.ts](C:/myProjects/ConfluxCircuit/shared/rankSystem.ts) | Computes rating changes and tier presentation | Partial 30% | Queue/results/profile | B07: placement and eligibility |
| [shared/rivalBanter.ts](C:/myProjects/ConfluxCircuit/shared/rivalBanter.ts) | Selects contextual rival dialogue | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/seededRNG.ts](C:/myProjects/ConfluxCircuit/shared/seededRNG.ts) | Produces deterministic pseudo-random values | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [shared/types.ts](C:/myProjects/ConfluxCircuit/shared/types.ts) | Declares shared entities, profiles, telemetry and state contracts | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [styles.css](C:/myProjects/ConfluxCircuit/styles.css) | Defines application styles and animation | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [tailwind.config.js](C:/myProjects/ConfluxCircuit/tailwind.config.js) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [tsconfig.json](C:/myProjects/ConfluxCircuit/tsconfig.json) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [tsconfig.node.json](C:/myProjects/ConfluxCircuit/tsconfig.node.json) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |
| [types.ts](C:/myProjects/ConfluxCircuit/types.ts) | Declares shared entities, profiles, telemetry and state contracts | Partial 60% | Yes: entry-point import graph | See subsystem matrix; no independent end-to-end certification |
| [vite-env.d.ts](C:/myProjects/ConfluxCircuit/vite-env.d.ts) | Application entry, metadata, asset or build contract | Partial 60% | Developer/helper or no entry import | See subsystem matrix; no independent end-to-end certification |
| [vite.config.ts](C:/myProjects/ConfluxCircuit/vite.config.ts) | Configures build, deployment or access policy | Integrated 65% | Build/deploy or entry point | Runtime deployment and production recovery unverified |

## Content and rule catalogs

Individual entries below are definitions, not independently completed features. They inherit the completion, dependencies and blockers of their owning subsystem in the main matrix. `shared/constants.ts`, `shared/types.ts`, `shared/gameSetup.ts` and `shared/gameRules.ts` are the governing evidence.

### ANOMALY_DEFINITIONS

- **Time Dilation**: All event timers are reduced by 20%.
- **Gravity Well**: Movement gains are halved for all racers.
- **Data Corruption**: UI elements glitch and scramble randomly.
- **Hyper Flux**: Power-ups are twice as effective.
- **Warp Drive**: Passive movement speed doubled for all racers.
- **Cosmic Storm**: Random energy surges grant spontaneous Overdrive.
- **Chronos Shift**: The sequence of upcoming events is completely randomized.
- **Void Collapse**: The track is shorter, but all events are harder.
- **Quantum Entanglement**: Power-ups affect a random racer instead of the intended target.

### POWERUP_DEFINITIONS

- **Clarity**: Instantly removes the Mist Bomb's blur effect.
- **Mist Bomb**: Blurs opponents' screens for half of the next event.
- **Time Snare**: Freezes the leader (or 2nd place) on the next tile.
- **Shield**: Blocks the next incoming debuff.
- **Data Spike**: Scrambles an opponent's upcoming tile view.
- **Overcharge**: Instantly gain +2 energy for power-up activation.
- **Sludge**: Slows all opponents on the next tile.
- **Reflector**: Reflects the next incoming debuff back at the sender.

### TILE_MODIFIER_DEFINITIONS

- **BOOST_PAD**: 3-Star performance grants double movement!
- **POWER_SURGE**: Guaranteed Power-Up reward on completion!
- **STATIC_FIELD**: All Power-Ups are disabled for this tile!
- **FOG_BANK**: The next event is hidden until it starts!
- **SPONSORED**: Bonus reputation for high performance!
- **ICE_PATCH**: Slippery! 3★ is harder but grants bonus movement.
- **NEBULA_DRIFT**: Cosmic chaos! The event is replaced with a random one.

### BOT_PROFILES

- **Easy**: {"reaction":{"mean":320,"std":80,"clamp":[140,700]},"typing":{"wpm":35,"std":6,"errorRate":[0.03,0.06]},"precision":{"star2Chance":0.4,"star3Chance":0.15}}
- **Intermediate**: {"reaction":{"mean":240,"std":60,"clamp":[120,600]},"typing":{"wpm":50,"std":7,"errorRate":[0.01,0.04]},"precision":{"star2Chance":0.55,"star3Chance":0.3}}
- **Rival**: {"reaction":{"mean":220,"std":50,"clamp":[110,550]},"typing":{"wpm":55,"std":6,"errorRate":[0.01,0.03]},"precision":{"star2Chance":0.6,"star3Chance":0.38}}

### CHASSIS_DEFINITIONS

- **Standard Issue**: Balanced starter frame. No bonuses, no drawbacks, fully dependable.
- **Aegis Chassis**: Defensive frame. Start each race with a Shield for safer openers and recovery.
- **Momentum Chassis**: Snowball frame. Earn a permanent speed boost each time you score 3 stars or better.
- **Scavenger Chassis**: Sustain frame. High-end rewards are more likely to convert into Shields.
- **Glass Cannon**: High-risk race frame. Gain more movement from every success, but debuffs hit harder.

### ACCOLADE_DEFINITIONS

- **First Victory**: Win your first race against any opponents.
- **Rivalry Begins**: Defeat your persistent Rival for the first time.
- **Hazardous Duty**: Accept a Rival's Hazard challenge and achieve 3 stars.
- **Perfectionist**: Finish a race with a perfect 3-star average.
- **Overdriver**: Successfully execute an Overdrive for a 4-star result.
- **Collector**: Unlock all available Chassis in the Hangar.
- **Ghost Hunter**: Defeat a recorded ghost run in Ghost Race mode.
- **Tournament Champion**: Win a single-elimination tournament bracket.
- **Comeback King**: Win a race after being in last place at the halfway point.
- **Power Player**: Use 5 or more Power-Ups in a single race.

### RIVAL_TRAIT_DEFINITIONS

- **Precision Focus**: Rival has honed their skills in Precision events.
- **Reaction Pro**: Rival has lightning-fast reflexes in Reaction events.
- **Typing Ace**: Rival excels at all Typing-based challenges.
- **Debuff Resistant**: Rival is more likely to start with a Shield or Clarity.
- **Aggressive**: Rival is more likely to use offensive Power-Ups.

### CORPORATION_DEFINITIONS

- **Cyberex Solutions**: Precision engineering for a perfect future. They value flawless execution.
- **Zenith Performance**: A racing syndicate that values raw speed and aggressive tactics above all.
- **Rogue Dynamics**: An enigmatic collective known for their disruptive tech and high-risk, high-reward approach.

### PIT_STOP_CONFIG

- **tilesPerStage**: 4
- **actions**: {"scrub":{"cost":3,"description":"Remove a negative status effect.","icon":"🧼"},"tuneUp":{"cost":4,"description":"Gain a random Power-Up.","icon":"🔧"},"analyze":{"cost":2,"description":"Reveal the next set of upcoming tiles.","icon":"📊"},"recharge":{"cost":0,"description":"Skip your action to gain 2 Energy.","icon":"🔋"}}

### WEEKLY_CUP_PRESETS

- **Precision & Reflexes**: {"name":"Precision & Reflexes","eventIds":["reaction-tap","aim-flick","target-practice","path-tracer","asteroid-dodge","slider-precision"]}
- **Cognitive Overload**: {"name":"Cognitive Overload","eventIds":["quick-math","code-breaker","sequence-sort","memory-flip","emoji-cipher","system-purge"]}
- **Rhythm & Flow**: {"name":"Rhythm & Flow","eventIds":["rhythm-tap","jump-bar","sprint-mash","evade-grid","audio-beat"]}

### SKILL_TREE_NODES

- **speed-t1**: Begin each race with +0.5 bonus energy per star.
- **speed-t2**: Overdrive cooldown reduced by 1 tile.
- **speed-t3**: Overdrive success grants +25% extra hyperdrive movement surge.
- **speed-t4**: 15% chance to start each race with a random Power-Up.
- **speed-t5**: Earn +0.5 additional bonus energy per star.
- **tech-t1**: Start each race with a Shield.
- **tech-t2**: Debuffs last 1 fewer tile.
- **tech-t3**: Power-ups gain +1 tile duration or +1 bonus energy.
- **tech-t4**: See the next 2 upcoming tiles for free & Pit Stop Analyze costs 0⚡.
- **tech-t5**: Data Spike scrambles targets for 2 tiles instead of 1.
- **endurance-t1**: Debuffs last 1 fewer tile.
- **endurance-t2**: Earn +1 bonus energy per star.
- **endurance-t3**: 1★ results grant 2★ movement speed (1.6x).
- **endurance-t4**: Pit Stop Recharge gives +3 Energy instead of +2.
- **endurance-t5**: Once per race, a 0★ result is upgraded to 1★.

### CHASSIS_MODULES

- **core-shield**: Start each race with a Shield.
- **core-energy**: Start each race with +2 Energy.
- **core-clarity**: Start each race with a Clarity power-up.
- **thrusters-momentum**: +10% movement from all star results.
- **thrusters-speed**: +15% movement from all star results.
- **thrusters-utility**: Start each race with a random Power-Up.
- **shielding-cleanse**: Debuffs last 1 fewer tile.
- **shielding-powerup**: Start with a Clarity power-up.
- **shielding-fortify**: Shield absorbs an extra debuff hit before breaking.

### SEASONAL_MODIFIERS

- **double-energy**: All energy gains are doubled!
- **hardcore**: No power-ups. Pure skill only.
- **anomaly-chaos**: Every race has an anomaly. Expect the unexpected.
- **sprint-mode**: All races are 4 tiles. Fast and furious.
- **marathon**: All races are 16 tiles. Endurance test.
- **turbo-energy**: Triple energy gains!

### TEAM_POWERUP_DEFINITIONS

- **Rally**: Boost a teammate's movement by 1.5x on the next tile.
- **Shield Wall**: Both teammates get a Shield.

### SYNDICATE_PERK_DESCRIPTIONS

- **CYBEREX**: {"1":"+5% movement on 3★ results","2":"+1 Starting Energy & +5% 3★ movement","3":"+10% movement on 3★ results & +1 Starting Energy"}
- **ZENITH**: {"1":"+0.25 Energy per Star","2":"+5% base movement & +0.25 Energy/Star","3":"-1 Overdrive Cooldown, +5% movement & +0.25 Energy/Star"}
- **ROGUE**: {"1":"+10% chance to start with a random Power-Up","2":"+1 Debuff Resistance & +10% Power-Up start chance","3":"Start with Reflector Immunity (1 tile), +1 Debuff Res & +10% Power-Up chance"}

## Excluded/generated/implicit artifacts

- Installed node_modules and generated client/server dist trees: dependency/build outputs; builds verified, not first-party feature components.
- .firebase cache, .netlify state/config, manifest and hosting targets: deployment scaffolding; production state unverified.
- .env/.env.example: configuration boundary; private values intentionally excluded; server environment examples do not themselves load dotenv.
- cc1.zip: ignored archive, approximately 88 MB; content not inspected or treated as active implementation.
- migrated_prompt_history: tracked history artifact despite ignore patterns; content not inspected or used as application evidence.
- Empty src directory: obsolete scaffold.
- New audit scripts/logs/indexes: audit-only deliverables; not shipped application features.

## Source symbols and dependency evidence

See [file-index.json](C:/myProjects/ConfluxCircuit/audit/file-index.json) for all extracted symbols with one-based source lines, imports, timer counts and entry-point import reachability; [component-index.json](C:/myProjects/ConfluxCircuit/audit/component-index.json) adds the file-level judgments above. This inventory does not imply every branch was dynamically executed.
