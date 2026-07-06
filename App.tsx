

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GameScreen, GameSettings, GameState, GameEvent, PilotProfile, EventTelemetry, PowerUp, EventResult } from './types';
import { MatchSummary, computeMatchSummary, applyMatchSummaryToProfile } from './shared/matchSummary';
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

/** Extended screen enum for online-specific screens. */
type AppScreen = GameScreen | 'ONLINE_LOBBY';

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

  const { gameState, toasts, rivalTaunt, addToast, initializeGame, initializeGauntlet, processTileResults, processGauntletTile, usePowerUp, activateOverdrive, effectTrigger, handlePitStopAction, handleInterventionChoice } = useGameEngine();
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
    initializeGame(settings, customEventIds);
    setActiveContracts(generateContracts(settings.seed));
    setScreen(GameScreen.Event);
    setShowCountdown(true);
    setMatchSummary(null);
  }, [initializeGame]);

  const handleStartGauntlet = useCallback((settings: GameSettings) => {
    initializeGauntlet(settings);
    setScreen(GameScreen.Event);
    setShowCountdown(true);
    setMatchSummary(null);
  }, [initializeGauntlet]);

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
      } else {
        syncProfileMerge(updatedProfile);
      }
    }
  }, [profile, eventDimensionMap, handleAuthoritativeMatchSummary]);

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
      if(gameState) {
          initializeGame(gameState.settings, activeEventIds);
          setActiveContracts(generateContracts(gameState.settings.seed));
          setScreen(GameScreen.Event);
          setShowCountdown(true);
          setMatchSummary(null);
      }
  }, [gameState, initializeGame, activeEventIds]);

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

  useEffect(() => {
    if (!isOnline) return;
    if (onlineGame.matchSummary) {
      handleAuthoritativeMatchSummary(onlineGame.matchSummary);
    }
  }, [isOnline, onlineGame.matchSummary, handleAuthoritativeMatchSummary]);

  // Resolve the "active" game state — server-authoritative when online
  const activeGameState = isOnline ? onlineGame.serverGameState : gameState;

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
    if (!profile) {
        return <PilotProfileSetup onProfileCreated={handleProfileCreated} existingProfiles={savedProfiles} onSelectProfile={handleSelectExistingProfile} onDeleteProfile={handleDeleteExistingProfile} />;
    }

    const renderLobby = () => <Lobby profile={profile} setProfile={setProfile} onStartGame={handleStartGame} onStartGauntlet={handleStartGauntlet} onGoToEventList={handleGoToEventList} onGoToAccolades={handleGoToAccolades} onGoToOnline={handleGoToOnline} onGoToLeaderboard={handleGoToLeaderboard} onGoToMatchHistory={handleGoToMatchHistory} onSwitchPilot={handleSwitchPilot} />;

    switch (screen) {
      case 'ONLINE_LOBBY':
        return <OnlineLobby profile={profile} online={onlineGame} onBack={() => { onlineGame.setMode('local'); setScreen(GameScreen.Lobby); }} />;
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
          isPaused={showCountdown}
        />;
      case GameScreen.TileResults:
        if (!activeGameState) return renderLobby();
        return <TileResultsScreen gameState={activeGameState} onContinue={isOnline ? () => { /* server auto-advances */ } : handleContinueAfterResults} />;
      case GameScreen.PitStop:
        if (!activeGameState) return renderLobby();
        return <PitStopScreen gameState={activeGameState} onAction={isOnline
          ? (_pid: number, action: PitStopAction) => { onlineGame.sendPitStopAction(action); }
          : handlePitStopComplete
        } />;
      case GameScreen.Results:
        if (!activeGameState) return renderLobby();
        return <ResultsScreen profile={profile} gameState={activeGameState} matchSummary={matchSummary} summaryPending={isOnline && isSignedIn && matchSummary === null} onRematch={isOnline ? () => { onlineGame.sendRequestRematch(); } : handleRematch} onNewRun={isOnline ? () => { onlineGame.leaveRoom(); onlineGame.setMode('local'); setScreen(GameScreen.Lobby); } : handleNewRun} onCopySeed={handleCopySeed} onShareRun={handleShareRun} />;
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
  }, [profile]);

  return (
    <div className={`w-full min-h-screen bg-cosmic-blue text-gray-200 transition-transform duration-500 ${isShaking ? 'animate-shake' : ''}`} role="application" aria-label="Conflux Circuit Game">
        <main id="main-content" className="w-full min-h-screen">
        {renderScreen()}
        </main>
        {showWelcome && profile && (
            <WelcomePopup onClose={handleWelcomeClose} onGoOnline={handleWelcomeGoOnline} />
        )}
        {showCountdown && activeGameState && upcomingEvent && (
            <Countdown
                tileNumber={activeGameState.currentTileIndex + 1}
                eventName={upcomingEvent.displayName}
                event={upcomingEvent}
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
