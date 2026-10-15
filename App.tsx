

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GameScreen, GameSettings, GameState, GameEvent, PilotProfile, EventTelemetry, PowerUp, EventResult, ChassisId, TournamentBracket, AccoladeId } from './types';
import { MatchSummary, computeMatchSummary, applyMatchSummaryToProfile } from './shared/matchSummary';
import { SeededRNG } from './shared/seededRNG';
import { useGameEngine } from './hooks/useGameEngine';
import { useOnlineGame } from './hooks/useOnlineGame';
import { Lobby } from './components/Lobby';
import { OnlineLobby } from './components/OnlineLobby';
import { EventRunner } from './components/EventRunner';
import { Countdown } from './components/Countdown';
import { ResultsScreen } from './components/ResultsScreen';
import { eventRegistry } from './events/eventRegistry';
import { ToastContainer } from './components/Toast';
import { TileResultsScreen } from './components/TileResultsScreen';
import { audioService } from './services/audioService';
import { hapticsService } from './services/hapticsService';
import { EventList } from './components/EventList';
import { EventPlaytestRunner } from './components/EventPlaytestRunner';
import { PilotProfileSetup } from './components/PilotProfileSetup';
import { loadProfile, saveProfile, createProfileAccount, clearProfile, listProfiles, setActiveProfile, deleteProfileAccount } from './services/profileService';
import { fetchProfile, syncProfile, syncProfileMerge } from './services/firebaseProfileService';
import { signIn, resetAnonymousSession, auth } from './services/firebase';
import { submitGhostRun, fetchRandomGhost } from './services/firebaseGhostService';
import { PitStopScreen, PitStopAction } from './components/PitStopScreen';
import { PIT_STOP_CONFIG } from './constants';
import { RivalInterventionModal } from './components/RivalInterventionModal';
import { AccoladesScreen } from './components/AccoladesScreen';
import { LeaderboardScreen } from './components/LeaderboardScreen';
import { MatchHistoryScreen } from './components/MatchHistoryScreen';
import { RivalTauntOverlay } from './components/RivalTauntOverlay';
import { WelcomePopup, hasSeenWelcome } from './components/WelcomePopup';
import { generateContracts } from './shared/contractService';
import { getDailySeed, getDailyPersonalBest, saveDailyPersonalBest } from './shared/dailyChallengeService';
import { Contract } from './types';
import { ModeSelector, GameModeSelection } from './components/ModeSelector';
import { GhostRaceScreen } from './components/GhostRaceScreen';
import { SkillTreeScreen } from './components/SkillTreeScreen';
import { HangarScreen } from './components/HangarScreen';
import { SettingsScreen, loadSettings, saveSettings, UISettings } from './components/SettingsScreen';
import { OnboardingFlow } from './components/OnboardingFlow';
import { TournamentScreen } from './components/TournamentScreen';
import { networkService } from './services/networkService';
import { ConnectionIndicator } from './components/ConnectionIndicator';
import { useConnectionStatus } from './hooks/useConnectionStatus';
import { useOnlineScreenSync } from './hooks/useOnlineScreenSync';
import { SpectatorOverlay } from './components/SpectatorOverlay';

/** Extended screen enum for online-specific and v5.0 screens. */
type AppScreen = GameScreen | 'ONLINE_LOBBY' | 'MODE_SELECT' | 'SKILL_TREE' | 'HANGAR' | 'SETTINGS' | 'ONBOARDING' | 'TOURNAMENT' | 'GHOST_RACE';

const App: React.FC = () => {
  const [screen, setScreen] = useState<AppScreen>(GameScreen.Lobby);
  const [profile, setProfile] = useState<PilotProfile | null>(() => loadProfile());

  // Authenticate with Firebase and try to fetch profile on load
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const user = await signIn();
      if (user && mounted) {
        setIsSignedIn(true);
        const fetched = await fetchProfile();
        if (fetched) {
          setProfile(fetched);
        }
      }
    };
    initAuth();
    return () => { mounted = false; };
  }, []);

  const { gameState, ghostRun, toasts, rivalTaunt, addToast, initializeGame, initializeGauntlet, initializeGhostRace, getGhostResultForTile, processTileResults, processGauntletTile, usePowerUp, activateOverdrive, effectTrigger, handlePitStopAction, handleInterventionChoice } = useGameEngine();
  const onlineGame = useOnlineGame();
  const isOnline = onlineGame.mode === 'online';
  const isOnlineHost = onlineGame.lobbyState?.hostSessionId === onlineGame.sessionId;

  const [showCountdown, setShowCountdown] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  
  const [activeEventIds, setActiveEventIds] = useState<string[]>(() => eventRegistry.map(e => e.id));
  const [playtestConfig, setPlaytestConfig] = useState<{ event: GameEvent; difficulty: number } | null>(null);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [savedProfiles, setSavedProfiles] = useState(() => listProfiles());
  const [showWelcome, setShowWelcome] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | undefined>(undefined);
  // v5.0 state
  const [uiSettings, setUiSettings] = useState<UISettings>(() => loadSettings());
  const [tournamentBracket, setTournamentBracket] = useState<TournamentBracket | null>(null);
  const [tournamentMatchId, setTournamentMatchId] = useState<string | null>(null);
  const reportedTournamentMatchRef = useRef<string | null>(null);
  const tournamentReturnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const connectionStatus = useConnectionStatus();
  const { leaveSpectator } = useOnlineScreenSync({
    online: onlineGame,
    setScreen: (s) => setScreen(s as AppScreen),
  });

  // Parse ?room= URL param for auto-join
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setPendingRoomCode(room.toUpperCase());
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Auto-navigate to online lobby when pendingRoomCode is set and profile is ready
  useEffect(() => {
    if (pendingRoomCode && profile && !isOnline) {
      onlineGame.setMode('online');
      setScreen('ONLINE_LOBBY' as AppScreen);
    }
  }, [pendingRoomCode, profile, isOnline]);

  useEffect(() => {
    // Accessibility and settings listeners
    document.documentElement.classList.toggle('hc', !!gameState?.settings.accessibility);
    document.documentElement.classList.toggle('cb', !!gameState?.settings.colorBlindMode);
    
    if (gameState) {
      audioService.init(gameState.settings.sound);
      hapticsService.setEnabled(gameState.settings.uiEffects);
      audioService.unlockOnFirstGesture();
    }
    
    return () => { 
        document.documentElement.classList.remove('hc');
        document.documentElement.classList.remove('cb');
    };
  }, [gameState?.settings.accessibility, gameState?.settings.sound, gameState?.settings.uiEffects, gameState?.settings.colorBlindMode]);
  
  // Effect for screen shake
  useEffect(() => {
    if (effectTrigger > 0 && gameState?.settings.uiEffects) {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [effectTrigger, gameState?.settings.uiEffects]);

  const handleProfileCreated = useCallback((data: { name: string, avatarId: string }) => {
    const newProfile = createProfileAccount(data.name, data.avatarId);
    syncProfile(newProfile);
    setProfile(newProfile);
    setSavedProfiles(listProfiles());
  }, []);

  const handleUpdateProfile = useCallback((updatedProfile: PilotProfile) => {
      saveProfile(updatedProfile);
      setProfile(updatedProfile);
      setSavedProfiles(listProfiles());
  }, []);

  const handleSwitchPilot = useCallback(async () => {
    await onlineGame.leaveRoom();
    onlineGame.setMode('local');
    clearProfile();
    setProfile(null);
    setSavedProfiles(listProfiles());
    setScreen(GameScreen.Lobby);
    setMatchSummary(null);
    setShowCountdown(false);
    setIsSignedIn(false);
    const user = await resetAnonymousSession();
    if (user) {
      setIsSignedIn(true);
    }
  }, [onlineGame]);

  const handleSelectExistingProfile = useCallback((accountId: string) => {
    const selectedProfile = setActiveProfile(accountId);
    if (!selectedProfile) return;
    setProfile(selectedProfile);
    setSavedProfiles(listProfiles());
    setScreen(GameScreen.Lobby);
    setMatchSummary(null);
    setShowCountdown(false);
  }, []);

  const handleDeleteExistingProfile = useCallback((accountId: string) => {
    const nextProfile = deleteProfileAccount(accountId);
    setSavedProfiles(listProfiles());
    setProfile(nextProfile);
    setScreen(GameScreen.Lobby);
    setMatchSummary(null);
    setShowCountdown(false);
  }, []);

  const handleStartGame = useCallback((settings: GameSettings, customEventIds?: string[]) => {
    const effectivePool = customEventIds && customEventIds.length > 0 ? customEventIds : activeEventIds;
    initializeGame(settings, effectivePool, profile);
    setActiveContracts(generateContracts(settings.seed));
    setScreen(GameScreen.Event);
    setShowCountdown(true);
    setMatchSummary(null);
  }, [initializeGame, activeEventIds, profile]);

  const handleStartGauntlet = useCallback((settings: GameSettings) => {
    initializeGauntlet(settings, profile);
    setActiveContracts([]);
    setScreen(GameScreen.Event);
    setShowCountdown(true);
    setMatchSummary(null);
  }, [initializeGauntlet, profile]);

  const handleStartGhostRace = useCallback(async (settings: GameSettings) => {
    // Try to fetch a real ghost run from Firestore matching runLength; fall back to a deterministic synthetic ghost.
    let ghost = await fetchRandomGhost(settings.runLength, settings.seed);
    if (!ghost) {
      const ghostSeed = settings.seed || `ghost-${Date.now()}`;
      const runLength = settings.runLength;
      const synRng = new SeededRNG(`synthetic-ghost-${ghostSeed}`);
      const tileResults = Array.from({ length: runLength }, (_, i) => ({
        tileIndex: i + 1,
        stars: synRng.nextInt(1, 4),
        primaryMetric: synRng.nextInt(100, 300),
      }));
      ghost = {
        ghostId: `synthetic-${ghostSeed}`,
        ownerName: 'Ghost AI',
        ownerAvatarId: '👻',
        seed: ghostSeed,
        runLength,
        tileResults,
        submittedAt: Date.now(),
        ownerCircuitPoints: 500,
        userId: 'synthetic',
        schemaVersion: 1,
      };
    }
    setActiveContracts([]);
    initializeGhostRace(settings, ghost, profile);
    setScreen(GameScreen.Event);
    setShowCountdown(true);
    setMatchSummary(null);
  }, [initializeGhostRace, profile]);

  const handleTileComplete = useCallback((results: { [playerId: number]: EventResult }) => {
      if (gameState?.settings.isGauntlet) {
          processGauntletTile(results);
      } else {
          processTileResults(results);
      }
      const playerResult = results[1];
      if (playerResult.stars >= 3) {
        audioService.playSound('event-success');
      } else {
        audioService.playSound('event-fail');
      }
      setScreen(GameScreen.TileResults);
  }, [processTileResults, processGauntletTile, gameState?.settings.isGauntlet]);

  const advanceToNextEvent = useCallback(() => {
    setScreen(GameScreen.Event);
    setShowCountdown(true);
  }, []);

  // Build event dimension map once (stable across re-renders)
  const eventDimensionMap = useMemo(() => {
    const map: Record<string, string> = {};
    eventRegistry.forEach(e => { map[e.id] = e.performanceDimension; });
    return map;
  }, []);

  /**
   * Compute and apply a MatchSummary for a finished race.
   * Works identically for local and online modes.
   */
  const handleAuthoritativeMatchSummary = useCallback((summary: MatchSummary): PilotProfile | null => {
    if (!profile) return null;

    const updatedProfile = applyMatchSummaryToProfile(profile, summary);
    if (updatedProfile) {
      handleUpdateProfile(updatedProfile);
    }

    if (summary.dailyIsNewBest && summary.dailyPersonalBest !== null) {
      saveDailyPersonalBest(summary.dailyPersonalBest);
    }

    setMatchSummary(summary);
    setScreen(GameScreen.Results);
    return updatedProfile;
  }, [profile, handleUpdateProfile]);

  const finalizeRace = useCallback((finishedGameState: GameState, raceContracts: Contract[], raceMode: 'local' | 'online') => {
    if (!profile) return;

    const summary = computeMatchSummary({
      gameState: finishedGameState,
      profile,
      mode: raceMode,
      contracts: raceContracts,
      eventDimensionMap,
      dailySeed: getDailySeed(),
      currentDailyBest: getDailyPersonalBest(),
    });

    const updatedProfile = handleAuthoritativeMatchSummary(summary);
    if (updatedProfile) {
      if (raceMode === 'local') {
        syncProfile(updatedProfile);
        // Also publish local/daily/gauntlet race to server leaderboards & match history when authenticated
        const currentUser = auth?.currentUser;
        if (currentUser && typeof currentUser.getIdToken === 'function') {
          currentUser.getIdToken().then((idToken) => {
            const serverHttpUrl = (import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567')
              .replace(/^wss:/, 'https:')
              .replace(/^ws:/, 'http:');
            return fetch(`${serverHttpUrl}/api/progression/local-match`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({ summary, profile: updatedProfile, idToken }),
            });
          }).catch(() => {
            // Offline or local-only mode: local profile sync already completed
          });
        }
      } else {
        syncProfileMerge(updatedProfile);
      }
    }

    // Submit ghost run if this was a ghost race
    if (ghostRun && finishedGameState.players[0]) {
      const humanPlayer = finishedGameState.players[0];
      const tileResults = humanPlayer.tileHistory.map(t => ({
        tileIndex: t.tileIndex,
        stars: t.stars,
        primaryMetric: t.primaryMetric ?? 0,
      }));
      const currentUser = auth?.currentUser;
      if (currentUser) {
        submitGhostRun(currentUser.uid, {
          ownerName: profile.name,
          ownerAvatarId: profile.avatarId,
          seed: finishedGameState.settings.seed,
          runLength: finishedGameState.settings.runLength,
          tileResults,
          ownerCircuitPoints: updatedProfile?.circuitPoints ?? profile.circuitPoints,
          schemaVersion: 1,
          chassisId: finishedGameState.settings.selectedChassis,
        }).catch(err => console.error('[GhostRace] Failed to submit ghost run:', err));
      }

      // Award GhostHunter accolade if the human won
      const sortedPlayers = [...finishedGameState.players].sort((a, b) => b.position - a.position);
      if (sortedPlayers[0]?.id === humanPlayer.id && updatedProfile) {
        if (!updatedProfile.unlockedAccolades.includes(AccoladeId.GhostHunter)) {
          const ghostProfile = { ...updatedProfile, unlockedAccolades: [...updatedProfile.unlockedAccolades, AccoladeId.GhostHunter] };
          setProfile(ghostProfile);
          saveProfile(ghostProfile);
          syncProfile(ghostProfile);
        }
      }
    }
  }, [profile, eventDimensionMap, handleAuthoritativeMatchSummary, ghostRun]);

  const handleContinueAfterResults = useCallback(() => {
    if (!gameState || !profile) return;

    // --- Gauntlet Mode Logic ---
    if (gameState.settings.isGauntlet) {
        const humanPlayer = gameState.players[0];
        if ((humanPlayer.lives ?? 0) <= 0 || gameState.currentTileIndex >= gameState.run.length) {
            finalizeRace(gameState, [], 'local');
            return;
        }
        advanceToNextEvent();
        return;
    }

    // --- End of Race: compute summary via canonical pipeline ---
    if (gameState.currentTileIndex >= gameState.run.length) {
        finalizeRace(gameState, activeContracts, 'local');
        return;
    }

    // Check for pit stop
    const tilesPerStage = PIT_STOP_CONFIG.tilesPerStage;
    if (gameState.currentTileIndex > 0 && gameState.currentTileIndex % tilesPerStage === 0) {
        setScreen(GameScreen.PitStop);
        return;
    }

    // Check for rival intervention (modal will appear)
    if (gameState.activeIntervention) {
        // Do nothing, the modal is now active and will control the flow
        return;
    }

    // Default: go to next event
    advanceToNextEvent();
  }, [gameState, profile, advanceToNextEvent, finalizeRace, activeContracts]);

  const handlePitStopComplete = useCallback((playerId: number, action: PitStopAction) => {
      handlePitStopAction(playerId, action);
      advanceToNextEvent();
  }, [handlePitStopAction, advanceToNextEvent]);
  
  const handleInterventionComplete = useCallback((accept: boolean) => {
      handleInterventionChoice(accept);
      advanceToNextEvent();
  }, [handleInterventionChoice, advanceToNextEvent]);

  const handleRematch = useCallback(() => {
      if (!gameState) return;
      if (gameState.settings.isGauntlet) {
          handleStartGauntlet({
              ...gameState.settings,
              seed: String(Math.floor(Math.random() * 1000000)),
          });
          return;
      }
      if (ghostRun) {
          handleStartGhostRace(gameState.settings);
          return;
      }
      const nextSeed = gameState.settings.seed === getDailySeed()
          ? gameState.settings.seed
          : String(Math.floor(Math.random() * 1000000));
      const nextSettings = { ...gameState.settings, seed: nextSeed };
      initializeGame(nextSettings, activeEventIds, profile);
      setActiveContracts(generateContracts(nextSettings.seed));
      setScreen(GameScreen.Event);
      setShowCountdown(true);
      setMatchSummary(null);
  }, [gameState, ghostRun, handleStartGauntlet, handleStartGhostRace, initializeGame, activeEventIds, profile]);

  const handleNewRun = useCallback(() => {
      setScreen(GameScreen.Lobby);
      setMatchSummary(null);
  }, []);

  const handleGoToEventList = useCallback(() => {
    setScreen(GameScreen.EventList);
  }, []);

  const handleGoToAccolades = useCallback(() => {
    setScreen(GameScreen.Accolades);
  }, []);

  const handleGoToLeaderboard = useCallback(() => {
    setScreen(GameScreen.Leaderboard);
  }, []);

  const handleGoToMatchHistory = useCallback(() => {
    setScreen(GameScreen.MatchHistory);
  }, []);

  const handleReplaySeed = useCallback((seed: string) => {
    setScreen(GameScreen.Lobby);
    setMatchSummary(null);
    // The seed will be picked up via URL hash or manual entry
    window.location.hash = `#seed=${seed}`;
  }, []);

  const handleGoToOnline = useCallback(() => {
    onlineGame.setMode('online');
    setScreen('ONLINE_LOBBY' as AppScreen);
  }, [onlineGame]);

  // v5.0: Navigation handlers
  const handleGoToModeSelect = useCallback(() => {
    setScreen('MODE_SELECT');
  }, []);

  const handleModeSelect = useCallback((mode: GameModeSelection) => {
    switch (mode) {
      case 'local':
        setScreen(GameScreen.Lobby);
        break;
      case 'online':
        onlineGame.setMode('online');
        setScreen('ONLINE_LOBBY' as AppScreen);
        break;
      case 'ranked':
        onlineGame.setMode('online');
        setScreen('ONLINE_LOBBY' as AppScreen);
        break;
      case 'tournament':
        setScreen('TOURNAMENT');
        break;
      case 'ghost':
        setScreen('GHOST_RACE');
        break;
    }
  }, [onlineGame]);

  const handleGoToSkillTree = useCallback(() => {
    setScreen('SKILL_TREE');
  }, []);

  const handleGoToHangar = useCallback(() => {
    setScreen('HANGAR');
  }, []);

  const handleGoToSettings = useCallback(() => {
    setScreen('SETTINGS');
  }, []);

  const handleSaveSettings = useCallback((settings: UISettings) => {
    setUiSettings(settings);
    saveSettings(settings);
    audioService.setEnabled(settings.soundEnabled);
    hapticsService.setEnabled(settings.hapticsEnabled);
    document.documentElement.classList.toggle('hc', settings.highContrast || settings.reducedMotion);
    document.documentElement.classList.toggle('cb', !!settings.colorBlindMode);
  }, []);

  // Server-authoritative progression purchases: returns the authoritative
  // cloud profile on success, or null when offline/unauthenticated (caller
  // falls back to a local-only purchase).
  const postPurchase = useCallback(async (payload: Record<string, unknown>): Promise<PilotProfile | null> => {
    const user = auth?.currentUser;
    if (!user || typeof user.getIdToken !== 'function') return null;
    try {
      const idToken = await user.getIdToken();
      const serverHttpUrl = (import.meta.env.VITE_SERVER_URL || 'ws://localhost:2567')
        .replace(/^wss:/, 'https:')
        .replace(/^ws:/, 'http:');
      const resp = await fetch(`${serverHttpUrl}/api/progression/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ...payload, idToken }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return (data?.profile as PilotProfile) ?? null;
    } catch {
      return null;
    }
  }, []);

  const handleSkillUnlock = useCallback((branch: 'speed' | 'tech' | 'endurance', nodeId: string, cost: number) => {
    if (!profile) return;
    const currentCp = Math.max(profile.circuitPoints ?? 0, profile.skills?.availableCP ?? 0);
    if (currentCp < cost) return;
    const applyLocalUnlock = () => {
      const remainingCp = currentCp - cost;
      const updated: PilotProfile = {
        ...profile,
        circuitPoints: remainingCp,
        skills: {
          ...(profile.skills ?? { speed: {}, tech: {}, endurance: {}, availableCP: 0 }),
          availableCP: remainingCp,
          [branch]: {
            ...(profile.skills?.[branch] ?? {}),
            [nodeId]: true,
          },
        },
      };
      handleUpdateProfile(updated);
      syncProfile(updated);
    };
    postPurchase({ kind: 'skill', itemId: nodeId }).then((serverProfile) => {
      if (serverProfile) handleUpdateProfile(serverProfile);
      else applyLocalUnlock();
    });
  }, [profile, handleUpdateProfile, postPurchase]);

  const handleUnlockModule = useCallback((moduleId: string, cost: number) => {
    if (!profile) return;
    if ((profile.circuitPoints ?? 0) < cost) return;
    const existingModules = profile.unlockedModules ?? [];
    if (existingModules.includes(moduleId)) return;
    const applyLocalUnlock = () => {
      const remainingCp = profile.circuitPoints - cost;
      const updated: PilotProfile = {
        ...profile,
        circuitPoints: remainingCp,
        unlockedModules: [...existingModules, moduleId],
        skills: profile.skills ? { ...profile.skills, availableCP: remainingCp } : undefined,
      };
      handleUpdateProfile(updated);
      syncProfile(updated);
    };
    postPurchase({ kind: 'module', itemId: moduleId }).then((serverProfile) => {
      if (serverProfile) handleUpdateProfile(serverProfile);
      else applyLocalUnlock();
    });
  }, [profile, handleUpdateProfile, postPurchase]);

  const handleUnlockChassis = useCallback((chassisId: ChassisId, cost: number) => {
    if (!profile) return;
    if ((profile.circuitPoints ?? 0) < cost) return;
    if (profile.unlockedChassis.includes(chassisId)) return;
    const applyLocalUnlock = () => {
      const remainingCp = profile.circuitPoints - cost;
      const updated: PilotProfile = {
        ...profile,
        circuitPoints: remainingCp,
        unlockedChassis: [...profile.unlockedChassis, chassisId],
        skills: profile.skills ? { ...profile.skills, availableCP: remainingCp } : undefined,
      };
      handleUpdateProfile(updated);
      syncProfile(updated);
    };
    postPurchase({ kind: 'chassis', itemId: chassisId }).then((serverProfile) => {
      if (serverProfile) handleUpdateProfile(serverProfile);
      else applyLocalUnlock();
    });
  }, [profile, handleUpdateProfile, postPurchase]);

  const handleEquipModule = useCallback((chassisId: ChassisId, slot: 'core' | 'thrusters' | 'shielding', moduleId: string | null) => {
    if (!profile) return;
    const applyLocalEquip = () => {
      const updated = { ...profile };
      if (!updated.loadouts) updated.loadouts = {};
      const existing = updated.loadouts[chassisId] ?? { chassisId, modules: {} };
      updated.loadouts[chassisId] = {
        ...existing,
        modules: { ...existing.modules, [slot]: moduleId ?? undefined },
      };
      handleUpdateProfile(updated);
      syncProfile(updated);
    };
    postPurchase({ kind: 'equipModule', itemId: moduleId ?? '', chassisId, slot }).then((serverProfile) => {
      if (serverProfile) handleUpdateProfile(serverProfile);
      else applyLocalEquip();
    });
  }, [profile, handleUpdateProfile, postPurchase]);

  const handleSelectChassis = useCallback((chassisId: ChassisId) => {
    if (!profile) return;
    if (!profile.unlockedChassis.includes(chassisId)) return;
    try {
      const saved = localStorage.getItem('conflux-circuit-settings');
      const parsed = saved ? JSON.parse(saved) : {};
      localStorage.setItem('conflux-circuit-settings', JSON.stringify({ ...parsed, selectedChassis: chassisId }));
    } catch {
      // ignore storage errors
    }
    const updated = { ...profile };
    handleUpdateProfile(updated);
  }, [profile, handleUpdateProfile]);

  const handleOnboardingComplete = useCallback((name: string, avatarId: string, chassisId: ChassisId) => {
    const newProfile = createProfileAccount(name, avatarId);
    if (!newProfile.unlockedChassis.includes(chassisId)) {
      newProfile.unlockedChassis = [...newProfile.unlockedChassis, chassisId];
    }
    saveProfile(newProfile);
    syncProfile(newProfile);
    setProfile(newProfile);
    setSavedProfiles(listProfiles());
    setShowOnboarding(false);
    setScreen(GameScreen.Lobby);
  }, []);

  const handleTournamentJoinMatch = useCallback((matchId: string, roomCode: string) => {
    setTournamentMatchId(matchId);
    onlineGame.setMode('online');
    setPendingRoomCode(roomCode);
    setScreen('ONLINE_LOBBY' as AppScreen);
  }, [onlineGame]);

  const handleTournamentChampion = useCallback((championName: string) => {
    if (profile && championName === profile.name) {
      if (!profile.unlockedAccolades.includes(AccoladeId.TournamentChampion)) {
        const updated = { ...profile, unlockedAccolades: [...profile.unlockedAccolades, AccoladeId.TournamentChampion] };
        setProfile(updated);
        saveProfile(updated);
      }
    }
  }, [profile]);

  const handleLeaveTournament = useCallback(() => {
    networkService.leaveTournament();
    setTournamentBracket(null);
    setTournamentMatchId(null);
    setScreen(GameScreen.Lobby);
  }, []);

  const handleWelcomeClose = useCallback(() => {
    setShowWelcome(false);
  }, []);

  const handleWelcomeGoOnline = useCallback(() => {
    setShowWelcome(false);
    handleGoToOnline();
  }, [handleGoToOnline]);

  // ─── Online match phase → screen transitions ────────────────────────
  useEffect(() => {
    if (!isOnline) return;
    switch (onlineGame.matchPhase) {
      case 'countdown':
        // Generate contracts for the online match using the server seed
        if (onlineGame.serverGameState) {
          setActiveContracts(generateContracts(onlineGame.serverGameState.settings.seed));
        }
        setMatchSummary(null);
        setScreen(GameScreen.Event);
        setShowCountdown(true);
        break;
      case 'playing':
        setScreen(GameScreen.Event);
        break;
      case 'tile_results': {
        setScreen(GameScreen.TileResults);
        // Play sound based on human player's stars
        const humanPlayer = onlineGame.serverGameState?.players.find(
          p => p.connectionId === onlineGame.sessionId
        );
        if (humanPlayer && onlineGame.tileResults?.results) {
          const playerResult = onlineGame.tileResults.results[humanPlayer.id];
          if (playerResult?.stars >= 3) {
            audioService.playSound('event-success');
          } else {
            audioService.playSound('event-fail');
          }
        }
        break;
      }
      case 'pit_stop':
        setScreen(GameScreen.PitStop);
        break;
      case 'intervention':
        // Intervention modal overlays the current screen; no screen change needed
        break;
      case 'finished':
        setScreen(GameScreen.Results);
        break;
      case 'lobby':
        setScreen('ONLINE_LOBBY' as AppScreen);
        break;
      case 'disconnected':
        setScreen('ONLINE_LOBBY' as AppScreen);
        break;
    }
  }, [isOnline, onlineGame.matchPhase]);

  // Resolve the "active" game state — server-authoritative when online
  const activeGameState = isOnline ? onlineGame.serverGameState : gameState;

  // Resolve explicit local human player ID (handles non-host online players accurately)
  const activeHumanPlayerId = useMemo(() => {
    if (!activeGameState) return 1;
    if (isOnline) {
      const bySession = activeGameState.players.find(p => p.connectionId === onlineGame.sessionId);
      if (bySession) return bySession.id;
      const uid = auth?.currentUser?.uid;
      const byUid = uid ? activeGameState.players.find(p => p.userId === uid) : undefined;
      if (byUid) return byUid.id;
    }
    return activeGameState.players.find(p => !p.isBot)?.id ?? 1;
  }, [activeGameState, isOnline, onlineGame.sessionId]);

  // ─── Tournament match result reporting ────────────────────────────────
  // When a tournament match finishes, determine if the human won (1-based placement === 1)
  // and report the result back to the TournamentRoom, then return to the tournament screen.
  useEffect(() => {
    if (!tournamentMatchId) return;
    if (onlineGame.matchPhase !== 'finished') return;
    if (!onlineGame.raceFinished) return;
    if (reportedTournamentMatchRef.current === tournamentMatchId) return;

    reportedTournamentMatchRef.current = tournamentMatchId;
    const matchIdToReport = tournamentMatchId;

    const humanStanding = onlineGame.raceFinished.finalStandings.find(
      s => s.playerId === activeHumanPlayerId || s.name === profile?.name
    );
    const won = humanStanding ? humanStanding.placement === 1 : false;

    networkService.reportTournamentResult(matchIdToReport, won);

    // Return to tournament screen after a brief delay without canceling via state change
    if (tournamentReturnTimerRef.current) clearTimeout(tournamentReturnTimerRef.current);
    tournamentReturnTimerRef.current = setTimeout(() => {
      setTournamentMatchId(null);
      onlineGame.leaveRoom();
      onlineGame.setMode('local');
      setScreen('TOURNAMENT' as AppScreen);
    }, 3000);
  }, [tournamentMatchId, onlineGame.matchPhase, onlineGame.raceFinished, activeHumanPlayerId, profile]);

  useEffect(() => {
    return () => {
      if (tournamentReturnTimerRef.current) clearTimeout(tournamentReturnTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    if (onlineGame.matchSummary) {
      handleAuthoritativeMatchSummary(onlineGame.matchSummary);
    }
  }, [isOnline, onlineGame.matchSummary, handleAuthoritativeMatchSummary]);

  // Pre-extract current tiles to avoid Tile | undefined at render sites
  const localCurrentTile = gameState ? gameState.run[gameState.currentTileIndex] : undefined;
  const onlineCurrentTile = activeGameState ? activeGameState.run[activeGameState.currentTileIndex] : undefined;

  // Online telemetry submission handler
  const handleSubmitTelemetry = useCallback((telemetry: EventTelemetry) => {
    onlineGame.sendEventResult(telemetry);
  }, [onlineGame]);

  // Online power-up handler (sends to server)
  const handleOnlineUsePowerUp = useCallback((_playerId: number, powerUp: PowerUp, targetId?: number) => {
    onlineGame.sendUsePowerUp(powerUp, targetId);
  }, [onlineGame]);

  // Online overdrive handler (sends to server)
  const handleOnlineActivateOverdrive = useCallback((_playerId: number, force?: boolean) => {
    onlineGame.sendActivateOverdrive(force);
  }, [onlineGame]);
  
  const handleStartPlaytest = useCallback((event: GameEvent, difficulty: number) => {
    setPlaytestConfig({ event, difficulty });
    setScreen(GameScreen.EventPlaytest);
  }, []);

  const handleCopySeed = useCallback(() => {
    addToast('Seed copied to clipboard!', 'success');
  }, [addToast]);

  const handleShareRun = useCallback(() => {
    addToast('Share link copied to clipboard!', 'success');
  }, [addToast]);

  const upcomingEvent = useMemo(() => {
    if (activeGameState && activeGameState.run[activeGameState.currentTileIndex]) {
        const eventId = activeGameState.run[activeGameState.currentTileIndex].eventId;
        return eventRegistry.find(e => e.id === eventId) || null;
    }
    return null;
  }, [activeGameState]);


  const renderScreen = () => {
    if (showOnboarding) {
        return <OnboardingFlow onComplete={handleOnboardingComplete} />;
    }
    if (!profile) {
        return <PilotProfileSetup onProfileCreated={handleProfileCreated} existingProfiles={savedProfiles} onSelectProfile={handleSelectExistingProfile} onDeleteProfile={handleDeleteExistingProfile} onStartOnboarding={() => setShowOnboarding(true)} />;
    }

    const renderLobby = () => <Lobby profile={profile} setProfile={setProfile} onStartGame={handleStartGame} onStartGauntlet={handleStartGauntlet} onGoToEventList={handleGoToEventList} onGoToAccolades={handleGoToAccolades} onGoToOnline={handleGoToOnline} onGoToLeaderboard={handleGoToLeaderboard} onGoToMatchHistory={handleGoToMatchHistory} onSwitchPilot={handleSwitchPilot} onGoToModeSelect={handleGoToModeSelect} onGoToSkillTree={handleGoToSkillTree} onGoToHangar={handleGoToHangar} onGoToSettings={handleGoToSettings} />;

    switch (screen) {
      case 'ONLINE_LOBBY':
        return (
          <>
            {isOnline && (
              <div className="fixed top-2 right-2 z-40">
                <ConnectionIndicator quality={connectionStatus.quality} rttMs={connectionStatus.rttMs} isConnected={connectionStatus.isConnected} showLabel />
              </div>
            )}
            <OnlineLobby profile={profile} online={onlineGame} onBack={() => { onlineGame.setMode('local'); setScreen(GameScreen.Lobby); }} pendingRoomCode={pendingRoomCode} />
          </>
        );
      case 'MODE_SELECT':
        return <ModeSelector onSelect={handleModeSelect} onBack={() => setScreen(GameScreen.Lobby)} />;
      case 'SKILL_TREE':
        return <SkillTreeScreen profile={profile} onUnlock={handleSkillUnlock} onBack={() => setScreen(GameScreen.Lobby)} />;
      case 'HANGAR':
        return <HangarScreen profile={profile} onSelectChassis={handleSelectChassis} onEquipModule={handleEquipModule} onUnlockModule={handleUnlockModule} onUnlockChassis={handleUnlockChassis} onBack={() => setScreen(GameScreen.Lobby)} />;
      case 'SETTINGS':
        return <SettingsScreen settings={uiSettings} onSave={handleSaveSettings} onBack={() => setScreen(GameScreen.Lobby)} />;
      case 'TOURNAMENT':
        return <TournamentScreen bracket={tournamentBracket} onJoinMatch={handleTournamentJoinMatch} onLeave={handleLeaveTournament} onBracketUpdate={setTournamentBracket} onChampion={handleTournamentChampion} profile={profile} />;
      case 'GHOST_RACE':
        return <GhostRaceScreen profile={profile} onStart={handleStartGhostRace} onBack={() => setScreen(GameScreen.Lobby)} />;
      case 'ONBOARDING':
        return <OnboardingFlow onComplete={handleOnboardingComplete} />;
      case GameScreen.Lobby:
        return renderLobby();
      case GameScreen.Accolades:
        return <AccoladesScreen profile={profile} onBack={() => setScreen(GameScreen.Lobby)} />;
      case GameScreen.Leaderboard:
        return <LeaderboardScreen onBack={() => setScreen(GameScreen.Lobby)} />;
      case GameScreen.MatchHistory:
        return <MatchHistoryScreen onBack={() => setScreen(GameScreen.Lobby)} onReplaySeed={handleReplaySeed} userId={auth?.currentUser?.uid ?? null} />;
      case GameScreen.EventList:
        return <EventList 
                    onBack={() => setScreen(GameScreen.Lobby)} 
                    onApplyConfig={setActiveEventIds}
                    onPlaytest={handleStartPlaytest}
                    initialActiveIds={activeEventIds}
                    profile={profile}
                />;
       case GameScreen.EventPlaytest:
        if (!playtestConfig) return renderLobby();
        return <EventPlaytestRunner 
                    event={playtestConfig.event} 
                    difficulty={playtestConfig.difficulty} 
                    onExit={() => setScreen(GameScreen.EventList)} 
                />;
      case GameScreen.Event:
        if (!activeGameState)  return renderLobby();
        return <EventRunner
          gameState={activeGameState}
          onTileComplete={handleTileComplete}
          onUsePowerUp={isOnline ? handleOnlineUsePowerUp : usePowerUp}
          onActivateOverdrive={isOnline ? handleOnlineActivateOverdrive : activateOverdrive}
          onlineMode={isOnline}
          onSubmitTelemetry={isOnline ? handleSubmitTelemetry : undefined}
          getGhostResultForTile={ghostRun ? getGhostResultForTile : undefined}
          isPaused={showCountdown}
          rivalTraits={profile?.rivalData?.traits}
          contracts={activeContracts}
          localPlayerId={activeHumanPlayerId}
          isSpectator={isOnline && onlineGame.isSpectator}
        />;
      case GameScreen.TileResults:
        if (!activeGameState) return renderLobby();
        return <TileResultsScreen gameState={activeGameState} localPlayerId={activeHumanPlayerId} onContinue={isOnline ? () => { /* server auto-advances */ } : handleContinueAfterResults} />;
      case GameScreen.PitStop:
        if (!activeGameState) return renderLobby();
        return <PitStopScreen gameState={activeGameState} localPlayerId={activeHumanPlayerId} onAction={isOnline
          ? (_pid: number, action: PitStopAction) => { onlineGame.sendPitStopAction(action); }
          : handlePitStopComplete
        } />;
      case GameScreen.Results:
        if (!activeGameState) return renderLobby();
        return <ResultsScreen profile={profile} gameState={activeGameState} matchSummary={matchSummary} summaryPending={isOnline && isSignedIn && matchSummary === null} localPlayerId={activeHumanPlayerId} onRematch={isOnline ? () => { onlineGame.sendRequestRematch(); } : handleRematch} onNewRun={isOnline ? () => { onlineGame.leaveRoom(); onlineGame.setMode('local'); setScreen(GameScreen.Lobby); } : handleNewRun} onCopySeed={handleCopySeed} onShareRun={handleShareRun} />;
      default:
        return <div>Unknown Screen</div>;
    }
  };
  
  const rival = activeGameState?.players.find(p => p.isRival);

  // Online intervention handler
  const handleOnlineInterventionChoice = useCallback((accept: boolean) => {
    onlineGame.sendInterventionChoice(accept);
  }, [onlineGame]);

  useEffect(() => {
    if (profile && !hasSeenWelcome()) {
      const timer = setTimeout(() => setShowWelcome(true), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [profile]);

  return (
    <div className={`w-full min-h-screen bg-cosmic-blue text-gray-200 transition-transform duration-500 ${isShaking ? 'animate-shake' : ''}`} role="application" aria-label="Conflux Circuit Game">
        <main id="main-content" className="w-full min-h-screen">
        {renderScreen()}
        </main>
        {isOnline && onlineGame.isSpectator && (
            <SpectatorOverlay
              gameState={onlineGame.serverGameState}
              onLeave={leaveSpectator}
            />
        )}
        {showWelcome && profile && (
            <WelcomePopup onClose={handleWelcomeClose} onGoOnline={handleWelcomeGoOnline} />
        )}
        {showCountdown && activeGameState && upcomingEvent && (
            <Countdown
                tileNumber={activeGameState.currentTileIndex + 1}
                eventName={upcomingEvent.displayName}
                event={upcomingEvent}
                mastery={profile?.eventMastery?.[upcomingEvent.id]}
                onlineMode={isOnline}
                onComplete={() => {
                    setShowCountdown(false);
                    audioService.playSound('event-start');
                }}
            />
        )}
        {/* Local intervention modal */}
        {!isOnline && gameState?.activeIntervention?.hazardTile && rival && localCurrentTile && (
            <RivalInterventionModal
                rivalName={rival.name}
                standardTile={localCurrentTile!}
                hazardTile={gameState.activeIntervention.hazardTile}
                cpBonus={gameState.activeIntervention.cpBonus}
                interventionType={gameState.activeIntervention.type}
                sabotageStatus={gameState.activeIntervention.sabotageStatus}
                onAccept={() => handleInterventionComplete(true)}
                onDecline={() => handleInterventionComplete(false)}
            />
        )}
        {/* Online intervention modal — host decides, others see waiting overlay */}
        {isOnline && onlineGame.interventionData && onlineCurrentTile && isOnlineHost && (
            <RivalInterventionModal
                rivalName={onlineGame.interventionData.rivalName}
                standardTile={onlineCurrentTile!}
                hazardTile={onlineGame.interventionData.hazardTile}
                cpBonus={onlineGame.interventionData.cpBonus}
                interventionType={onlineGame.interventionData.interventionType}
                sabotageStatus={onlineGame.interventionData.sabotageStatus}
                onAccept={() => handleOnlineInterventionChoice(true)}
                onDecline={() => handleOnlineInterventionChoice(false)}
            />
        )}
        {isOnline && onlineGame.interventionData && !isOnlineHost && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" role="dialog" aria-label="Rival Intervention" aria-modal="true">
                <div className="glass-panel p-6 sm:p-8 text-center max-w-sm mx-4">
                    <div className="text-4xl mb-4" aria-hidden="true">⚔️</div>
                    <h2 className="text-xl font-black text-nebula-pink mb-2">RIVAL INTERVENTION</h2>
                    <p className="text-gray-400 text-sm">Waiting for host to decide...</p>
                </div>
            </div>
        )}
        <RivalTauntOverlay message={rivalTaunt} />
        <div aria-live="polite" aria-atomic="true">
            <ToastContainer toasts={toasts} />
        </div>
    </div>
  );
};

export default App;

