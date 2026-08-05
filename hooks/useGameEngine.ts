
import { useState, useCallback } from 'react';
import { GameSettings, GameState, Player, EventResult, PowerUp, BotPersonality, ChassisId, AnomalyId, GhostRun, PilotProfile } from '../types';
import { generateRun, generateCustomRun } from '../services/pathGenerator';
import { eventRegistry } from '../events/eventRegistry';
import { BOT_NAMES, PLAYER_COLORS, CHASSIS_DEFINITIONS, ANOMALY_DEFINITIONS, GAUNTLET_CONFIG } from '../constants';
import { SeededRNG } from '../services/seededRNG';
import { useSound } from './useSound';
import { hapticsService } from '../services/hapticsService';
import { generateNebula } from '../services/nebulaGenerator';
import { PitStopAction } from '../components/PitStopScreen';
import { GameRules, GameEffect } from '../services/gameRules';
import { applySkillEffects, applyLoadoutEffects, applySeasonalModifierToSettings, applySeasonalModifierToPlayer, getSeasonalAnomalyChance } from '../shared/gameSetup';
import { applyRivalTraitsToPlayer } from '../shared/botMind';

export const useGameEngine = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [ghostRun, setGhostRun] = useState<GhostRun | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'info' | 'success' | 'warning' }[]>([]);
  const [rivalTaunt, setRivalTaunt] = useState<string | null>(null);
  const [effectTrigger, setEffectTrigger] = useState(0); // Increments to trigger visual shakes
  const { playSound } = useSound();

  // --- Side Effect Handler ---
  const processEffects = useCallback((effects: GameEffect[]) => {
    effects.forEach(effect => {
        switch (effect.type) {
            case 'TOAST':
                const id = Date.now() + Math.random();
                setToasts(prev => [...prev, { id, message: effect.message, type: effect.variant }]);
                setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
                break;
            case 'RIVAL_TAUNT':
                setRivalTaunt(effect.message);
                setTimeout(() => setRivalTaunt(null), 3000);
                break;
            case 'SOUND':
                playSound(effect.sound as any);
                break;
            case 'HAPTIC':
                hapticsService.trigger(effect.pattern);
                if (effect.pattern === 'medium' || effect.pattern === 'long') {
                    setEffectTrigger(t => t + 1); // Trigger screen shake
                }
                break;
        }
    });
  }, [playSound]);

  const addToast = useCallback((message: string, type: 'info' | 'success' | 'warning' = 'info') => {
      processEffects([{ type: 'TOAST', message, variant: type }]);
  }, [processEffects]);


  // --- Game Initialization ---
  const initializeGame = useCallback((settings: GameSettings, customEventIds?: string[], profile?: PilotProfile | null) => {
    // Apply seasonal modifier to settings (e.g., runLength override)
    const { settings: modSettings, modifier: seasonalModifier } = applySeasonalModifierToSettings(settings);
    const rng = new SeededRNG(`players-${modSettings.seed}`);
    const players: Player[] = [];
    const shuffledBotNames = rng.shuffle([...BOT_NAMES]);

    // Player 1 (Human)
    let humanPlayer: Player = {
      id: 1,
      name: 'Player 1',
      isBot: false,
      isRival: false,
      color: PLAYER_COLORS[0],
      position: 0,
      powerUps: [],
      statuses: [],
      tileHistory: [],
      energy: 0,
      overdriveCooldown: 0,
    };

    // Apply Chassis effects at start
    if (settings.selectedChassis === ChassisId.Aegis) {
        humanPlayer.powerUps.push('Shield');
    }

    // v5.0: Apply skill and loadout effects from pilot profile
    if (profile) {
      if (profile.skills) {
        humanPlayer = applySkillEffects(humanPlayer, profile.skills);
      }
      const chassisId = settings.selectedChassis ?? humanPlayer.chassisId;
      if (chassisId && profile.loadouts && profile.loadouts[chassisId]) {
        humanPlayer = applyLoadoutEffects(humanPlayer, profile.loadouts[chassisId]);
      }
    }

    players.push(humanPlayer);

    // Config Bots
    let botCount = 0;
    const botConfigs: { personality: BotPersonality, count: number }[] = [
        { personality: BotPersonality.Intermediate, count: settings.intermediateBots },
        { personality: BotPersonality.Easy, count: settings.easyBots },
    ];

    botConfigs.forEach(config => {
        for (let i = 0; i < config.count; i++) {
            players.push({
                id: players.length + 1,
                name: shuffledBotNames[botCount++ % shuffledBotNames.length],
                isBot: true,
                isRival: false,
                personality: config.personality,
                color: PLAYER_COLORS[players.length % PLAYER_COLORS.length],
                position: 0,
                powerUps: [],
                statuses: [],
                tileHistory: [],
                energy: 0,
                overdriveCooldown: 0,
            });
        }
    });

    // Config Rival
    const potentialRivals = players.filter(p => p.isBot && p.personality === BotPersonality.Intermediate);
    const rivalBot = potentialRivals.length > 0 ? potentialRivals[0] : players.find(p => p.isBot);

    if (rivalBot) {
        rivalBot.isRival = true;
        rivalBot.personality = BotPersonality.Rival;
        rivalBot.name = `Rival ${rivalBot.name}`;

        const chassisIds = Object.values(ChassisId).filter(id => CHASSIS_DEFINITIONS[id].cost > 0);
        const randomChassisId = chassisIds[rng.nextInt(0, chassisIds.length)];
        rivalBot.chassisId = randomChassisId;
        if(randomChassisId === ChassisId.Aegis) rivalBot.powerUps.push('Shield');

        // v5.0: Apply rival traits from pilot profile (e.g. DebuffResistant gives starting Shield/Clarity)
        if (profile?.rivalData?.traits && profile.rivalData.traits.length > 0) {
            const rivalIdx = players.findIndex(p => p === rivalBot);
            if (rivalIdx >= 0) {
                players[rivalIdx] = applyRivalTraitsToPlayer(rivalBot, profile.rivalData.traits, rng);
            }
        }
    }

    let run = (customEventIds && customEventIds.length > 0)
        ? generateCustomRun(modSettings.seed, modSettings.runLength, eventRegistry, customEventIds)
        : generateRun(modSettings.seed, modSettings.runLength, eventRegistry);

    // Anomaly chance: base 15%, boosted by seasonal modifier if active
    let activeAnomaly = null;
    const anomalyChance = Math.max(0.15, getSeasonalAnomalyChance());
    if (rng.nextFloat() < anomalyChance) {
        const anomalyIds = Object.values(AnomalyId);
        const randomAnomalyId = anomalyIds[rng.nextInt(0, anomalyIds.length)];
        activeAnomaly = { id: randomAnomalyId, ...ANOMALY_DEFINITIONS[randomAnomalyId] };

        if (randomAnomalyId === AnomalyId.ChronosShift) {
            // Scramble the run, keeping the first tile the same so the countdown works smoothly
            const firstTile = run[0];
            const remainingTiles = run.slice(1);
            run = [firstTile, ...rng.shuffle(remainingTiles)];
        } else if (randomAnomalyId === AnomalyId.VoidCollapse) {
            // Reduce track length by 25% (min 4 tiles), increase difficulty of all tiles by 1 (max 3)
            const newLength = Math.max(4, Math.floor(run.length * 0.75));
            run = run.slice(0, newLength).map(tile => ({
                ...tile,
                difficulty: Math.min(3, tile.difficulty + 1)
            }));
        }
    }

    // Apply seasonal modifier to all players (e.g., disablePowerUps removes starting power-ups)
    const finalPlayers = seasonalModifier
      ? players.map(p => applySeasonalModifierToPlayer(p, seasonalModifier))
      : players;

    setGameState({
      settings: modSettings,
      players: finalPlayers,
      run,
      currentTileIndex: 0,
      eventResults: {},
      lastTileResults: null,
      overdrivingPlayerIds: [],
      activeIntervention: null,
      lastHazardInterventionIndex: -99,
      activeAnomaly,
    });

    const canvas = document.getElementById('nebula-canvas') as HTMLCanvasElement;
    if (canvas) generateNebula(canvas, modSettings.seed);

  }, []);

  // --- Gauntlet Initialization ---
  const initializeGauntlet = useCallback((settings: GameSettings) => {
    const rng = new SeededRNG(`gauntlet-${settings.seed}`);
    
    const players: Player[] = [{
      id: 1,
      name: 'Player 1',
      isBot: false,
      isRival: false,
      color: PLAYER_COLORS[0],
      position: 0,
      powerUps: [],
      statuses: [],
      tileHistory: [],
      energy: 0,
      overdriveCooldown: 0,
      lives: GAUNTLET_CONFIG.startingLives,
    }];

    if (settings.selectedChassis === ChassisId.Aegis) {
        players[0].powerUps.push('Shield');
    }

    const workingEvents = eventRegistry.filter(e => !e.isStub);
    const run = [];
    for (let i = 0; i < GAUNTLET_CONFIG.runLength; i++) {
        const event = workingEvents[rng.nextInt(0, workingEvents.length)];
        const escalation = Math.floor(i / GAUNTLET_CONFIG.difficultyEscalationInterval);
        const difficulty = Math.min(GAUNTLET_CONFIG.maxDifficulty, 1 + escalation);
        run.push({
            tileIndex: i + 1,
            eventId: event.id,
            difficulty,
            subSeed: rng.nextFloat().toString(),
        });
    }

    setGameState({
      settings: { ...settings, isGauntlet: true, runLength: GAUNTLET_CONFIG.runLength },
      players,
      run,
      currentTileIndex: 0,
      eventResults: {},
      lastTileResults: null,
      overdrivingPlayerIds: [],
      activeIntervention: null,
      lastHazardInterventionIndex: -99,
      activeAnomaly: null,
    });
    
    const canvas = document.getElementById('nebula-canvas') as HTMLCanvasElement;
    if (canvas) generateNebula(canvas, settings.seed);
  }, []);

  // --- Ghost Race Initialization ---
  const initializeGhostRace = useCallback((settings: GameSettings, ghost: GhostRun) => {
    const rng = new SeededRNG(`ghost-${settings.seed}`);

    const players: Player[] = [{
      id: 1,
      name: 'Player 1',
      isBot: false,
      isRival: false,
      color: PLAYER_COLORS[0],
      position: 0,
      powerUps: [],
      statuses: [],
      tileHistory: [],
      energy: 0,
      overdriveCooldown: 0,
    }];

    if (settings.selectedChassis === ChassisId.Aegis) {
      players[0].powerUps.push('Shield');
    }

    // Ghost player: a bot that uses pre-recorded results instead of simulation.
    players.push({
      id: 2,
      name: ghost.ownerName,
      isBot: true,
      isGhost: true,
      isRival: false,
      color: PLAYER_COLORS[1],
      position: 0,
      powerUps: [],
      statuses: [],
      tileHistory: [],
      energy: 0,
      overdriveCooldown: 0,
    });

    // Use the ghost's seed so the track matches what they played.
    const ghostSeed = ghost.seed;
    const run = generateRun(ghostSeed, ghost.runLength, eventRegistry);

    setGhostRun(ghost);
    setGameState({
      settings: { ...settings, seed: ghostSeed, runLength: ghost.runLength },
      players,
      run,
      currentTileIndex: 0,
      eventResults: {},
      lastTileResults: null,
      overdrivingPlayerIds: [],
      activeIntervention: null,
      lastHazardInterventionIndex: -99,
      activeAnomaly: null,
    });

    const canvas = document.getElementById('nebula-canvas') as HTMLCanvasElement;
    if (canvas) generateNebula(canvas, ghostSeed);
  }, []);

  // --- Get ghost's pre-recorded result for the current tile ---
  const getGhostResultForTile = useCallback((tileIndex: number): EventResult | null => {
    if (!ghostRun) return null;
    const ghostTile = ghostRun.tileResults.find(t => t.tileIndex === tileIndex + 1);
    if (!ghostTile) return null;
    return {
      playerId: 2,
      stars: ghostTile.stars as 0 | 1 | 2 | 3 | 4,
      primaryMetric: ghostTile.primaryMetric,
      secondaryMetric: 0,
    };
  }, [ghostRun]);

  // --- Gauntlet Tile Processing ---
  const processGauntletTile = useCallback((results: { [playerId: number]: EventResult }) => {
    setGameState(current => {
        if (!current) return null;
        const humanResult = results[1];
        const player = { ...current.players[0] };
        const effects: GameEffect[] = [];
        
        player.tileHistory = [...player.tileHistory, { tileIndex: current.currentTileIndex, stars: humanResult.stars }];
        player.energy += humanResult.stars;
        
        if (humanResult.stars <= GAUNTLET_CONFIG.starLossThreshold) {
            const livesLost = humanResult.stars === 0 ? 2 : 1;
            player.lives = Math.max(0, (player.lives ?? 0) - livesLost);
            effects.push({ type: 'HAPTIC', pattern: 'long' });
            effects.push({ type: 'TOAST', message: `Lost ${livesLost} ${livesLost > 1 ? 'lives' : 'life'}! (${player.lives} remaining)`, variant: 'warning' });
        } else if (humanResult.stars >= 3) {
            effects.push({ type: 'TOAST', message: 'Perfect!', variant: 'success' });
        }

        player.overdriveCooldown = Math.max(0, player.overdriveCooldown - 1);
        player.statuses = player.statuses
            .map(s => ({ ...s, duration: s.duration - 1 }))
            .filter(s => s.duration > 0);

        processEffects(effects);

        return {
            ...current,
            players: [player],
            currentTileIndex: current.currentTileIndex + 1,
            lastTileResults: results,
            overdrivingPlayerIds: [],
        };
    });
  }, [processEffects]);

  // --- Actions Consumers ---

  const activateOverdrive = useCallback((playerId: number, force: boolean = false) => {
    setGameState(current => {
        if (!current) return null;
        const { newState, effects } = GameRules.activateOverdrive(current, playerId, force);
        processEffects(effects);
        return newState;
    });
  }, [processEffects]);

  const processTileResults = useCallback((results: { [playerId: number]: EventResult }) => {
    setGameState(current => {
        if (!current) return null;
        const { newState, effects } = GameRules.processRaceStep(current, results);
        processEffects(effects);
        return newState;
    });
  }, [processEffects]);

  const usePowerUp = useCallback((playerId: number, powerUp: PowerUp, targetId?: number) => {
    setGameState(current => {
        if (!current) return null;
        const { newState, effects } = GameRules.applyPowerUp(current, playerId, powerUp, targetId);
        processEffects(effects);
        return newState;
    });
  }, [processEffects]);
  
  const handlePitStopAction = useCallback((playerId: number, action: PitStopAction) => {
    setGameState(current => {
        if (!current) return null;
        const { newState, effects } = GameRules.processPitStop(current, playerId, action);
        processEffects(effects);
        return newState;
    });
  }, [processEffects]);

  const handleInterventionChoice = useCallback((accept: boolean) => {
    setGameState(current => {
        if (!current) return null;
        const { newState, effects } = GameRules.resolveIntervention(current, accept);
        processEffects(effects);
        return newState;
    });
  }, [processEffects]);

  return { 
    gameState, 
    ghostRun,
    toasts, 
    rivalTaunt,
    addToast, 
    initializeGame, 
    initializeGauntlet,
    initializeGhostRace,
    getGhostResultForTile,
    processTileResults, 
    processGauntletTile,
    usePowerUp, 
    activateOverdrive, 
    effectTrigger, 
    handlePitStopAction, 
    handleInterventionChoice 
  };
};
