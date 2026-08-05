
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GameState, EventResult, PowerUp, EventTelemetry, RivalTraitId } from '../types';
import { eventRegistry } from '../events/eventRegistry';
import { RaceTrackHUD } from './RaceTrackHUD';
import { simulateBotPerformance, decideBotPowerUp, decideBotOverdrive } from '../services/botMind';
import { PowerUpIcon } from './PowerUpIcon';
import { DebugPanel } from './DebugPanel';
import { ExplainEventModal } from './ExplainEventModal';
import { OVERDRIVE_ENERGY_COST } from '../constants';
import { TimerBar } from './TimerBar';

interface EventRunnerProps {
  gameState: GameState;
  onTileComplete: (results: { [playerId: number]: EventResult }) => void;
  onUsePowerUp: (playerId: number, powerUp: PowerUp, targetId?: number) => void;
  onActivateOverdrive: (playerId: number, force?: boolean) => void;
  /** When true, skip local bot sim and star computation; submit telemetry instead. */
  onlineMode?: boolean;
  /** Called in online mode to submit raw metrics to server. */
  onSubmitTelemetry?: (telemetry: EventTelemetry) => void;
  /** Returns pre-recorded result for ghost players, or null if not a ghost race. */
  getGhostResultForTile?: (tileIndex: number) => EventResult | null;
  isPaused?: boolean;
  /** Rival traits from the pilot profile, used for bot simulation and power-up decisions. */
  rivalTraits?: RivalTraitId[];
}

export const EventRunner: React.FC<EventRunnerProps> = ({ gameState, onTileComplete, onUsePowerUp, onActivateOverdrive, onlineMode, onSubmitTelemetry, getGhostResultForTile, isPaused, rivalTraits }) => {
  const { settings, run, currentTileIndex, players, overdrivingPlayerIds, activeAnomaly } = gameState;
  const currentTile = run[currentTileIndex];
  const event = useMemo(() => eventRegistry.find(e => e.id === currentTile.eventId)!, [currentTile.eventId]);
  
  // Apply Time Dilation
  const baseDuration = useMemo(() => event.durationSec(currentTile.difficulty, settings.accessibility), [event, currentTile.difficulty, settings.accessibility]);
  const eventDuration = activeAnomaly?.id === 'TIME_DILATION' ? baseDuration * 0.8 : baseDuration;

  const [isEventOver, setIsEventOver] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);

  // Reset event state when tile changes (fixes stale isEventOver blocking subsequent tiles)
  useEffect(() => {
    setIsEventOver(false);
  }, [currentTileIndex]);

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const [isActivelyBlurred, setIsActivelyBlurred] = useState(false);

  const humanPlayer = players.find(p => !p.isBot);
  const hasBlurStatus = humanPlayer?.statuses.some(s => s.type === 'BLURRED') ?? false;
  const hasStunStatus = humanPlayer?.statuses.some(s => s.type === 'STUNNED') ?? false;
  const hasFrozenStatus = humanPlayer?.statuses.some(s => s.type === 'FROZEN') ?? false;
  const isPlayerOverdriving = humanPlayer ? overdrivingPlayerIds.includes(humanPlayer.id) : false;
  
  const arePowerupsDisabled = currentTile.modifier === 'STATIC_FIELD';
  const isDataCorrupted = activeAnomaly?.id === 'DATA_CORRUPTION';

  // Blur Logic
  useEffect(() => {
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    if (isPaused) {
        setIsActivelyBlurred(false);
        return () => {
            if (blurTimer) clearTimeout(blurTimer);
        };
    }
    if (hasBlurStatus) {
        setIsActivelyBlurred(true);
        const blurDurationMs = Math.min((eventDuration * 1000) / 2, 8000);
        blurTimer = setTimeout(() => {
            setIsActivelyBlurred(false);
        }, blurDurationMs);
    } else {
        setIsActivelyBlurred(false);
    }
    return () => {
        if (blurTimer) clearTimeout(blurTimer);
    };
  }, [hasBlurStatus, eventDuration, currentTileIndex, isPaused]);

  const handleEventComplete = useCallback((result: Omit<EventResult, 'playerId' | 'stars'>) => {
    if (isEventOver) return;
    setIsEventOver(true);

    // ─── Online Mode: submit raw telemetry, server computes stars ─────
    if (onlineMode && onSubmitTelemetry) {
      const telemetry: EventTelemetry = {
        tileIndex: currentTileIndex,
        eventId: currentTile.eventId,
        seed: currentTile.subSeed || settings.seed,
        primaryMetric: result.primaryMetric,
        secondaryMetric: result.secondaryMetric,
        completionTimestamp: Date.now(),
      };
      onSubmitTelemetry(telemetry);
      return;
    }

    // ─── Local Mode: compute stars and simulate bots locally ──────────
    if (!humanPlayer) return;
    const humanResult: EventResult = {
      ...result,
      stars: event.getStars(result),
      playerId: humanPlayer.id
    };

    const allResults: { [playerId: number]: EventResult } = { [humanPlayer.id]: humanResult };
    
    players.forEach(player => {
      if (player.isBot) {
        if (player.isGhost && getGhostResultForTile) {
          const ghostResult = getGhostResultForTile(currentTileIndex);
          if (ghostResult) {
            allResults[player.id] = { ...ghostResult, playerId: player.id };
          }
        } else {
          const botResult = simulateBotPerformance(player, event, currentTile.difficulty, settings, player.isRival ? rivalTraits : undefined);
          allResults[player.id] = { ...botResult, playerId: player.id };
        }
      }
    });

    setTimeout(() => {
      onTileComplete(allResults);
    }, 1500);
  }, [isEventOver, onlineMode, onSubmitTelemetry, currentTileIndex, currentTile.eventId, currentTile.subSeed, settings.seed, event, humanPlayer, players, onTileComplete, rivalTraits]);
  
  // Bot Logic (local mode only — server handles bots in online mode)
  useEffect(() => {
    if (onlineMode || isPaused) return;
    const gs = gameStateRef.current;
    const botDecisionTimeout = setTimeout(() => {
        gs.players.forEach(player => {
            if (player.isBot && !player.isGhost) {
                if (decideBotOverdrive(player, gs)) {
                    onActivateOverdrive(player.id);
                }
                const decision = decideBotPowerUp(player, gs, gs.run[gs.currentTileIndex], player.isRival ? rivalTraits : undefined);
                if (decision) {
                    onUsePowerUp(player.id, decision.use, decision.targetId);
                }
            }
        });
    }, Math.random() * 2000 + 500);

    return () => clearTimeout(botDecisionTimeout);
  }, [currentTileIndex, onlineMode, isPaused]);

  // Cosmic Storm Anomaly Effect
  useEffect(() => {
    if (isPaused) return undefined;
    if (activeAnomaly?.id === 'COSMIC_STORM' && !isEventOver) {
        const stormInterval = setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every second
                const randomPlayer = players[Math.floor(Math.random() * players.length)];
                if (!gameState.overdrivingPlayerIds.includes(randomPlayer.id)) {
                    onActivateOverdrive(randomPlayer.id, true);
                }
            }
        }, 1000);
        return () => clearInterval(stormInterval);
    }
    return undefined;
  }, [activeAnomaly, isEventOver, players, gameState.overdrivingPlayerIds, onActivateOverdrive, isPaused]);


  const EventComponent = event.Component;
  // Memoize the event component to avoid re-renders from parent state changes unrelated to the game loop
  const MemoizedEventComponent = useMemo(() => React.memo(EventComponent), [EventComponent]);
  const LazyFallback = useMemo(() => () => (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm animate-pulse">
      Loading event…
    </div>
  ), []);

  if (!humanPlayer) return <div className="flex items-center justify-center h-screen text-gray-500">No human player found.</div>;

  const canAffordOverdrive = humanPlayer.energy >= OVERDRIVE_ENERGY_COST;
  const isOverdriveOnCooldown = humanPlayer.overdriveCooldown > 0;
  const canUseOverdrive = !isPlayerOverdriving && !isOverdriveOnCooldown && canAffordOverdrive;
  
  // Visual Feedback for Damage/Debuffs
  const showDamageOverlay = hasStunStatus || hasFrozenStatus;

  return (
    <div className="w-full h-screen flex flex-col p-1 sm:p-2 md:p-4 bg-cosmic-blue animate-fade-in overflow-hidden relative event-container no-overscroll" role="region" aria-label={`Event: ${event.displayName}`}>
        {/* Damage/Debuff Vignette */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-500 z-50 ${showDamageOverlay ? 'opacity-100' : 'opacity-0'}`} 
             style={{ background: 'radial-gradient(circle, transparent 60%, rgba(214, 79, 138, 0.4) 100%)', boxShadow: 'inset 0 0 50px rgba(214, 79, 138, 0.5)' }}>
        </div>

        {isExplainModalOpen && <ExplainEventModal event={event} onClose={() => setIsExplainModalOpen(false)} />}
        {import.meta.env.DEV && <button onClick={() => setShowDebug(s => !s)} className="absolute top-1 right-1 sm:top-2 sm:right-2 text-xs bg-gray-900/80 p-2 sm:p-1 rounded z-[60] text-gray-500 active:text-white sm:hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center" aria-label="Toggle debug panel">DBG</button>}
        {import.meta.env.DEV && showDebug && <DebugPanel gameState={gameState} />}
        
        {/* Top HUD */}
        <div className={`flex-shrink-0 mb-1 sm:mb-3 glass-panel p-2 sm:p-3 relative overflow-hidden event-top-hud ${isDataCorrupted ? 'glitch-effect' : ''}`} data-text={event.displayName}>
            {activeAnomaly && (
                <div className="absolute top-0 right-0 px-2 sm:px-3 py-1 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-2 rounded-bl-lg" style={{ backgroundColor: activeAnomaly.color + '40', color: activeAnomaly.color }} role="status" aria-label={`Active anomaly: ${activeAnomaly.name}`}>
                    <span className="animate-pulse" aria-hidden="true">{activeAnomaly.icon}</span>
                    <span className="hidden sm:inline">{activeAnomaly.name}</span>
                </div>
            )}
            <div className="flex justify-between items-center relative z-10 gap-2 sm:gap-4 mt-1 sm:mt-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
                     <button 
                        onClick={() => setIsExplainModalOpen(true)}
                        className="w-10 h-10 sm:w-8 sm:h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 sm:hover:bg-white/20 text-galaxy-cyan font-bold transition-colors"
                        title="Instructions"
                        aria-label="Show event instructions"
                    >
                        ?
                    </button>
                    <div className="min-w-0">
                        <h2 className={`text-sm sm:text-lg md:text-xl font-bold text-white tracking-tight truncate ${isDataCorrupted ? 'font-mono' : ''}`}>{isDataCorrupted ? event.displayName.replace(/[aeiou]/g, 'x') : event.displayName}</h2>
                        <div className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 sm:gap-2">
                            <span>TILE {currentTile.tileIndex}/{run.length}</span>
                            <span className="text-star-purple">•</span>
                            <span aria-label={`Difficulty ${currentTile.difficulty} of 3`}>{'★'.repeat(currentTile.difficulty).padEnd(3, '☆')}</span>
                        </div>
                    </div>
                </div>

                {/* Optimized Timer */}
                <TimerBar duration={eventDuration} totalDuration={eventDuration} isPaused={isPaused} />
            </div>
        </div>
        
        {/* Main Event Area */}
        <div 
          className={`flex-grow w-full relative rounded-xl overflow-hidden glass-panel transition-all duration-300 border border-white/5 shadow-2xl ${isPlayerOverdriving ? 'ring-2 ring-nebula-pink shadow-nebula-pink/20' : ''} ${isDataCorrupted ? 'animate-pulse' : ''}`}
        >
          <React.Suspense fallback={<LazyFallback />}>
          <MemoizedEventComponent
            tile={currentTile}
            event={event}
            settings={settings}
            onComplete={handleEventComplete}
            isBlurred={isActivelyBlurred}
            isOverdriving={isPlayerOverdriving}
            isPaused={isPaused}
          />
          </React.Suspense>
        </div>

        {/* Bottom Controls & Track */}
        <div className="flex-shrink-0 mt-1 sm:mt-3 event-bottom-controls">
            <div className="flex gap-2 sm:gap-3 mb-1 sm:mb-3">
                {/* Power Ups Panel */}
                <div className="glass-panel p-1.5 sm:p-2 flex-grow flex items-center justify-between" role="toolbar" aria-label="Power-ups">
                     <div className="flex items-center gap-1.5 sm:gap-2 px-1 sm:px-2">
                        {arePowerupsDisabled ? (
                             <span className="text-xs text-gray-500 italic" role="status">🚫 Static Field Active</span>
                        ) : (
                            <>
                                {humanPlayer.powerUps.map((p, i) => (
                                    <PowerUpIcon 
                                        key={i} 
                                        powerUp={p} 
                                        onClick={() => onUsePowerUp(humanPlayer.id, p)} 
                                        isDisabled={arePowerupsDisabled}
                                        shouldGlow={p === 'Clarity' && isActivelyBlurred}
                                    />
                                ))}
                                {humanPlayer.powerUps.length === 0 && <span className="text-xs text-gray-600">No Power-ups</span>}
                            </>
                        )}
                     </div>
                </div>

                {/* Overdrive Button */}
                 <button 
                    onClick={() => onActivateOverdrive(humanPlayer.id)}
                    disabled={!canUseOverdrive}
                    aria-label={isPlayerOverdriving ? 'Overdrive active' : isOverdriveOnCooldown ? `Overdrive cooldown ${humanPlayer.overdriveCooldown}` : `Activate Overdrive, costs ${OVERDRIVE_ENERGY_COST} energy`}
                    className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm uppercase tracking-wider transition-all relative overflow-hidden group flex flex-col items-center justify-center min-w-[80px] sm:min-w-[100px]
                                ${canUseOverdrive 
                                    ? 'bg-gradient-to-br from-nebula-pink to-purple-700 text-white shadow-lg shadow-nebula-pink/30 active:scale-95 sm:hover:scale-105' 
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                >
                    {isPlayerOverdriving ? (
                        <span className="animate-pulse">ACTIVE!</span>
                    ) : isOverdriveOnCooldown ? (
                        <>
                            <span>COOLDOWN</span>
                            <span className="text-xs">{humanPlayer.overdriveCooldown}</span>
                        </>
                    ) : (
                        <>
                            <span>OVERDRIVE</span>
                            <span className="text-xs opacity-70">{OVERDRIVE_ENERGY_COST}⚡</span>
                        </>
                    )}
                </button>
            </div>

            {/* Track */}
            <RaceTrackHUD
                players={players}
                run={run}
                currentTileIndex={currentTileIndex}
                overdrivingPlayerIds={overdrivingPlayerIds}
                activeAnomaly={activeAnomaly}
            />
        </div>
    </div>
  );
};
