/**
 * shared/gameRules.ts
 * 
 * Authoritative game rules engine used by both client (local mode) and server.
 * Portable: no React, no browser APIs, no eventRegistry import.
 * 
 * Where the original used `eventRegistry` (e.g. for Data Spike scrambled runs),
 * callers must pass in a SharedEventDescriptor[] or the relevant function.
 */

import {
  GameState, Player, EventResult, Tile, PowerUp, PlayerStatus,
  ChassisId, RivalIntervention, GameSettings, SharedEventDescriptor
} from './types';
import {
  STAR_MOVEMENT_MULTIPLIERS, RUBBER_BAND_THRESHOLD, RUBBER_BAND_BOOST,
  POWERUP_AWARD_RULES, SHIELD_UPGRADE_CHANCE, DEBUFF_PRIORITY,
  IMMUNITY_DURATION, OVERDRIVE_COOLDOWN, OVERDRIVE_ENERGY_COST,
  CP_AWARD_RULES, PIT_STOP_CONFIG
} from './constants';
import { SeededRNG } from './seededRNG';
import { generateRun } from './pathGenerator';
import { getRivalBanter } from './rivalBanter';
import { getSeasonalEnergyMultiplier, isSeasonalPowerUpsDisabled } from './gameSetup';

// --- Types ---

export type GameEffect = 
    | { type: 'TOAST'; message: string; variant: 'info' | 'success' | 'warning' }
    | { type: 'RIVAL_TAUNT'; message: string }
    | { type: 'SOUND'; sound: string }
    | { type: 'HAPTIC'; pattern: 'light' | 'medium' | 'long' };

export interface GameUpdate {
    newState: GameState;
    effects: GameEffect[];
}

// --- Helper Functions ---

const applyDebuff = (player: Player, status: PlayerStatus, settings: GameSettings): { player: Player; effect?: GameEffect } => {
    // 1. Check Immunity
    if (player.statuses.some(s => s.type === 'IMMUNE')) {
        return { 
            player, 
            effect: !player.isBot ? { type: 'TOAST', message: 'Immune!', variant: 'info' } : undefined 
        };
    }

    // 2. Check Shield
    if (player.statuses.some(s => s.type === 'SHIELDED')) {
        if (player._fortifiedShield) {
            const newStatuses = [...player.statuses, { type: 'IMMUNE' as const, duration: IMMUNITY_DURATION + 1 }];
            const effect: GameEffect | undefined = (!player.isBot || player.isRival)
                ? { type: 'TOAST', message: `${player.name}'s Fortified Shield absorbed the hit (1 charge left)!`, variant: 'success' }
                : undefined;
            return { player: { ...player, _fortifiedShield: false, statuses: newStatuses }, effect };
        }

        const newStatuses = player.statuses.filter(s => s.type !== 'SHIELDED');
        // Add temporary immunity after shield break
        newStatuses.push({ type: 'IMMUNE', duration: IMMUNITY_DURATION + 1 });
        
        const effect: GameEffect | undefined = (!player.isBot || player.isRival) 
            ? { type: 'TOAST', message: `${player.name}'s Shield blocked the hit!`, variant: 'success' }
            : undefined;
            
        return { player: { ...player, statuses: newStatuses }, effect };
    }

    // 3. Priority Check
    const newPriority = DEBUFF_PRIORITY[status.type] || 0;
    const currentPriority = Math.max(0, ...player.statuses.map(s => DEBUFF_PRIORITY[s.type] || 0));
    
    if (newPriority < currentPriority) {
        return { player }; // Higher priority debuff exists
    }

    // 4. Apply Debuff
    const chassis = player.chassisId ?? (player.isBot ? undefined : settings.selectedChassis);
    const finalStatus = { ...status };
    
    // Glass Cannon penalty
    if (chassis === ChassisId.GlassCannon) {
        finalStatus.duration += 1;
    }

    // v5.0: Debuff resistance from skills/loadout (reduce duration)
    // Check for player-level debuff resistance markers
    if (player._debuffResistance && finalStatus.duration > 0) {
        finalStatus.duration = Math.max(0, finalStatus.duration - player._debuffResistance);
        if (finalStatus.duration === 0) {
            return { player, effect: !player.isBot ? { type: 'TOAST', message: 'Debuff resisted!', variant: 'success' } : undefined };
        }
    }

    return { 
        player: { ...player, statuses: [...player.statuses, finalStatus] },
        effect: !player.isBot ? { type: 'HAPTIC', pattern: 'medium' } : undefined
    };
};

// --- Core Rules Engine ---

export const GameRules = {
    
    /**
     * Processes the results of a race tile for all players.
     * Calculates movement, rubber banding, power-ups, and rival events.
     * 
     * @param eventDescriptors - Required for Data Spike scramble generation.
     *   Pass the shared event descriptors so generateRun can work without React.
     */
    processRaceStep: (
        state: GameState,
        results: { [playerId: number]: EventResult },
        eventDescriptors?: SharedEventDescriptor[]
    ): GameUpdate => {
        let players = [...state.players];
        const effects: GameEffect[] = [];
        const currentTile = state.run[state.currentTileIndex];
        const runLength = state.settings.runLength;
        const baseStep = 100 / runLength;
        const powerUpRng = new SeededRNG(`powerup-award-${state.currentTileIndex}-${state.settings.seed}`);

        const finalResults = { ...results };

        // 1. Handle Overdrive
        state.overdrivingPlayerIds.forEach(pid => {
            const result = finalResults[pid];
            const player = players.find(p => p.id === pid);
            if (!result || !player) return;

            if (result.stars === 3) {
                finalResults[pid] = { ...result, stars: 4 };
                effects.push({ type: 'SOUND', sound: 'overdrive-success' });
                effects.push({ type: 'TOAST', message: `${player.name} Overdrive Success!`, variant: 'success' });
            } else if (player._lastStandAvailable) {
                finalResults[pid] = { ...result, stars: 1 };
                players = players.map(p => p.id === pid ? { ...p, _lastStandAvailable: false } : p);
                effects.push({ type: 'TOAST', message: `${player.name}'s Last Stand saved Overdrive (1★)!`, variant: 'info' });
            } else {
                finalResults[pid] = { ...result, stars: 0 };
                players = players.map(p => p.id === pid ? { ...p, statuses: [...p.statuses, { type: 'STUNNED', duration: 1 }] } : p);
                effects.push({ type: 'SOUND', sound: 'overdrive-fail' });
                effects.push({ type: 'TOAST', message: `${player.name} Overdrive Failed!`, variant: 'warning' });
            }
        });

        // 2. Core Loop: Movement & Rewards
        players = players.map(p => {
            let result = finalResults[p.id];
            if (!result) return p;

            const updatedPlayer = { ...p };

            // v5.0: Last Stand (endurance-t5) — once per race, upgrade 0★ to 1★
            if (result.stars === 0 && updatedPlayer._lastStandAvailable) {
                result = { ...result, stars: 1 };
                finalResults[p.id] = result;
                updatedPlayer._lastStandAvailable = false;
                updatedPlayer.statuses = updatedPlayer.statuses.filter(s => s.type !== 'STUNNED');
                if (!p.isBot) {
                    effects.push({ type: 'TOAST', message: 'Last Stand! 0★ upgraded to 1★!', variant: 'success' });
                }
            }

            // A. Haptics for Human
            if (!p.isBot && (result.stars >= 2)) {
                effects.push({ type: 'HAPTIC', pattern: 'light' });
            }

            // B. PowerUps & Energy
            const hardcoreNoPowerUps = isSeasonalPowerUpsDisabled(state.settings.activeSeasonId);
            const seasonEnergyMult = getSeasonalEnergyMultiplier(state.settings.activeSeasonId);
            const energyGain = result.stars > 0
                ? Math.round(result.stars * (1 + (updatedPlayer._energyPerStarBonus ?? 0)) * seasonEnergyMult)
                : 0;
            const shouldAward = !hardcoreNoPowerUps && (currentTile.modifier === 'POWER_SURGE' || (result.stars > 0 && POWERUP_AWARD_RULES[result.stars as 1|2|3]));
            if (shouldAward) {
                let award: PowerUp = POWERUP_AWARD_RULES[result.stars as 1|2|3] ?? 'Clarity';

                // POWER_SURGE tiles have a chance to award from the expanded pool
                if (currentTile.modifier === 'POWER_SURGE') {
                    const expandedPool: PowerUp[] = state.settings.teamMode
                        ? ['Overcharge', 'Sludge', 'Reflector', 'Shield', 'Clarity', 'Rally', 'Shield Wall']
                        : ['Overcharge', 'Sludge', 'Reflector', 'Shield', 'Clarity'];
                    if (powerUpRng.nextFloat() < 0.4) {
                        award = expandedPool[powerUpRng.nextInt(0, expandedPool.length)];
                    }
                } else if (state.settings.teamMode && result.stars >= 3 && powerUpRng.nextFloat() < 0.35) {
                    award = powerUpRng.nextFloat() < 0.5 ? 'Rally' : 'Shield Wall';
                }
                
                // Chassis Bonuses
                const chassis = p.chassisId ?? (p.isBot ? undefined : state.settings.selectedChassis);
                const shieldChance = chassis === ChassisId.Scavenger ? SHIELD_UPGRADE_CHANCE + 0.2 : SHIELD_UPGRADE_CHANCE;
                
                if (result.stars === 3 && powerUpRng.nextFloat() < shieldChance) {
                    award = 'Shield';
                }

                updatedPlayer.powerUps = [...updatedPlayer.powerUps, award];
                updatedPlayer.energy += energyGain;
                
                if (!p.isBot || p.isRival) {
                    effects.push({ type: 'SOUND', sound: 'powerup-get' });
                    if (!p.isBot) effects.push({ type: 'TOAST', message: `Acquired ${award}`, variant: 'info' });
                }
            } else {
                updatedPlayer.energy += energyGain;
            }

            updatedPlayer.tileHistory = [...updatedPlayer.tileHistory, { tileIndex: state.currentTileIndex, stars: result.stars, primaryMetric: result.primaryMetric }];

            // C. Movement Calculation
            let moveMult = STAR_MOVEMENT_MULTIPLIERS[result.stars] || 0;

            // v5.0: Iron Will (endurance-t3) — 1★ results grant 2★ movement speed
            if (result.stars === 1 && updatedPlayer._ironWill) {
                moveMult = STAR_MOVEMENT_MULTIPLIERS[2];
                if (!p.isBot) effects.push({ type: 'TOAST', message: 'Iron Will! Full stride on 1★', variant: 'info' });
            }

            // v5.0: Hyperdrive (speed-t3) — +25% movement surge on 4★ Overdrive success
            if (result.stars === 4 && updatedPlayer._hyperdriveBonus) {
                moveMult *= 1.25;
                if (!p.isBot) effects.push({ type: 'TOAST', message: 'Hyperdrive Surge! +25% Speed', variant: 'success' });
            }
            
            // Apply Status/Chassis Modifiers
            const chassis = updatedPlayer.chassisId ?? (updatedPlayer.isBot ? undefined : state.settings.selectedChassis);
            
            if (chassis === ChassisId.Momentum && updatedPlayer.statuses.some(s => s.type === 'BOOSTED')) moveMult *= 1.1;
            if (chassis === ChassisId.GlassCannon) moveMult *= 1.15;
            
            if (updatedPlayer.statuses.some(s => s.type === 'SLOWED')) moveMult *= 0.8;
            if (updatedPlayer.statuses.some(s => s.type === 'FROZEN' || s.type === 'STUNNED')) moveMult = 0;
            
            if (currentTile.modifier === 'BOOST_PAD' && result.stars >= 3) {
                moveMult *= 2;
                if (!p.isBot) effects.push({ type: 'TOAST', message: 'Boost Pad Hit!', variant: 'success' });
            }

            if (currentTile.modifier === 'ICE_PATCH' && result.stars >= 3) {
                moveMult *= 1.5;
                if (!p.isBot) effects.push({ type: 'TOAST', message: 'Ice Patch Bonus!', variant: 'success' });
            }
            
            // Anomaly: Gravity Well
            if (state.activeAnomaly?.id === 'GRAVITY_WELL') {
                moveMult *= 0.5;
            } else if (state.activeAnomaly?.id === 'WARP_DRIVE') {
                moveMult *= 2.0;
            }
            
            // v5.0: Movement bonus from loadout modules / Zenith Syndicate
            if (updatedPlayer._movementBonus && result.stars > 0) {
                moveMult *= (1 + updatedPlayer._movementBonus);
            }

            // v5.0: 3★ movement bonus from Cyberex Syndicate
            if (updatedPlayer._threeStarMovementBonus && result.stars >= 3) {
                moveMult *= (1 + updatedPlayer._threeStarMovementBonus);
            }
            
            // Momentum Activation
            if (chassis === ChassisId.Momentum && result.stars >= 3 && !updatedPlayer.statuses.some(s => s.type === 'BOOSTED')) {
                updatedPlayer.statuses = [...updatedPlayer.statuses, { type: 'BOOSTED', duration: 999 }];
                if(!p.isBot) effects.push({ type: 'TOAST', message: 'Momentum Charged!', variant: 'success' });
            }

            const distance = baseStep * moveMult;
            updatedPlayer.position = Math.min(100, updatedPlayer.position + distance);

            return updatedPlayer;
        });

        // 3. Rubber Banding
        const leader = [...players].sort((a, b) => b.position - a.position)[0];
        const leaderTiles = leader.position / baseStep;
        
        players = players.map(p => {
            const playerTiles = p.position / baseStep;
            if (leaderTiles - playerTiles >= RUBBER_BAND_THRESHOLD) {
                if (!p.isBot) effects.push({ type: 'TOAST', message: 'Catch-up Boost Active', variant: 'info' });
                return { ...p, position: Math.min(100, p.position + baseStep * RUBBER_BAND_BOOST) };
            }
            return p;
        });

        // 4. Status Management
        players = players.map(p => {
            const nextStatuses = p.statuses
                .map(s => ({ ...s, duration: s.duration - 1 }))
                .filter(s => s.duration > 0);
            const stillImmune = nextStatuses.some(s => s.type === 'IMMUNE');
            const nextScan = p._sensorScanTiles && p._sensorScanTiles > 1 ? p._sensorScanTiles - 1 : undefined;
            return {
                ...p,
                overdriveCooldown: Math.max(0, p.overdriveCooldown - 1),
                statuses: nextStatuses,
                _reflectActive: stillImmune ? p._reflectActive : undefined,
                _sensorScanTiles: nextScan,
                // Only clear scrambled data if the status is gone
                scrambledTileData: p.statuses.some(s => s.type === 'SCRAMBLED') ? p.scrambledTileData : undefined,
            };
        });

        // 5. Rival Logic & Interventions
        const oldLeaderId = [...state.players].sort((a, b) => b.position - a.position)[0].id;
        const newLeader = [...players].sort((a, b) => b.position - a.position)[0];
        
        if (newLeader.id !== oldLeaderId) {
            if (newLeader.isRival) {
                const banter = getRivalBanter('takeLead', `${state.settings.seed}-${state.currentTileIndex}`);
                effects.push({ type: 'RIVAL_TAUNT', message: `"${banter}"` });
            } else if (!newLeader.isBot) {
                effects.push({ type: 'TOAST', message: "You took the lead!", variant: 'success' });
            }
        }

        let activeIntervention: RivalIntervention | null = null;
        let lastHazardIndex = state.lastHazardInterventionIndex;
        const rival = players.find(p => p.isRival);
        
        if (rival) {
            const human = players.find(p => !p.isBot)!;
            const sorted = [...players].sort((a,b) => b.position - a.position);
            const humanRank = sorted.findIndex(p => p.id === human.id);
            
            // Adaptive Probability
            let chance = 0.4; 
            if (humanRank <= 1) chance = 0.6;
            if (humanRank >= players.length - 2) chance = 0.2;

            const rng = new SeededRNG(`intervention-${state.currentTileIndex}-${state.settings.seed}`);
            const nextIndex = state.currentTileIndex + 1;
            const canTrigger = (state.currentTileIndex - lastHazardIndex) > 1;

            if (nextIndex < state.run.length && canTrigger && rng.nextFloat() < chance) {
                const nextTile = state.run[nextIndex];
                const modeRoll = rng.nextFloat();

                // Select among HAZARD, SABOTAGE, and VETO
                const altEventCandidates = (eventDescriptors ?? [])
                    .filter(e => !e.isStub && e.id !== nextTile.eventId)
                    .map(e => e.id);
                const runAltEvents = state.run
                    .map(t => t.eventId)
                    .filter(id => id !== nextTile.eventId);
                const availableVetoEvents = altEventCandidates.length > 0 ? altEventCandidates : runAltEvents;

                if (modeRoll < 0.45) {
                    const hazardTile: Tile = {
                        ...nextTile,
                        difficulty: Math.min(3, nextTile.difficulty + 1),
                        isHazard: true,
                    };
                    activeIntervention = { type: 'HAZARD', hazardTile, cpBonus: CP_AWARD_RULES.hazardBonus };
                } else if (modeRoll < 0.78 || availableVetoEvents.length === 0) {
                    const sabotageStatus: PlayerStatus['type'] = rng.nextFloat() < 0.5 ? 'BLURRED' : 'SLOWED';
                    const hazardTile: Tile = {
                        ...nextTile,
                        isHazard: true,
                    };
                    activeIntervention = {
                        type: 'SABOTAGE',
                        hazardTile,
                        sabotageStatus,
                        cpBonus: CP_AWARD_RULES.sabotageBonus,
                    };
                } else {
                    const altEventId = availableVetoEvents[rng.nextInt(0, availableVetoEvents.length)];
                    const hazardTile: Tile = {
                        ...nextTile,
                        eventId: altEventId,
                        difficulty: Math.min(3, nextTile.difficulty + 1),
                        isHazard: true,
                    };
                    activeIntervention = {
                        type: 'VETO',
                        hazardTile,
                        vetoSelection: [nextTile.eventId, altEventId],
                        cpBonus: 35,
                    };
                }

                lastHazardIndex = state.currentTileIndex;
                
                effects.push({ type: 'SOUND', sound: 'rival-tell' });
                effects.push({ type: 'TOAST', message: `${rival.name} is plotting something...`, variant: 'warning' });
            }
        }

        let newRun = [...state.run];
        if (state.activeAnomaly?.id === 'CHRONOS_SHIFT') {
            const nextIndex = state.currentTileIndex + 1;
            if (nextIndex < newRun.length - 1) {
                const rng = new SeededRNG(`chronos-${state.currentTileIndex}-${state.settings.seed}`);
                const remainingTiles = newRun.slice(nextIndex);
                newRun = [...newRun.slice(0, nextIndex), ...rng.shuffle(remainingTiles)];
            }
        }

        return {
            newState: {
                ...state,
                players,
                run: newRun,
                currentTileIndex: state.currentTileIndex + 1,
                lastTileResults: finalResults,
                overdrivingPlayerIds: [],
                activeIntervention,
                lastHazardInterventionIndex: lastHazardIndex,
            },
            effects
        };
    },

    /**
     * Activates a player power-up and applies effects to targets.
     * 
     * @param eventDescriptors - Required for Data Spike scrambled run generation.
     */
    applyPowerUp: (
        state: GameState,
        playerId: number,
        powerUp: PowerUp,
        targetId?: number,
        eventDescriptors?: SharedEventDescriptor[]
    ): GameUpdate => {
        const currentTile = state.run[state.currentTileIndex];
        if (!currentTile) {
            return { newState: state, effects: [] };
        }
        if (currentTile.modifier === 'STATIC_FIELD' || isSeasonalPowerUpsDisabled(state.settings.activeSeasonId)) {
             return { newState: state, effects: [{ type: 'TOAST', message: 'Power-ups Disabled!', variant: 'warning' }]};
        }

        let players = [...state.players];
        const effects: GameEffect[] = [];
        
        const user = players.find(p => p.id === playerId);
        if (!user || !user.powerUps.includes(powerUp)) return { newState: state, effects: [] };

        // Remove Powerup
        const pIdx = user.powerUps.indexOf(powerUp);
        const newPowerUps = [...user.powerUps];
        newPowerUps.splice(pIdx, 1);
        players = players.map(p => p.id === playerId ? { ...p, powerUps: newPowerUps, powerUpsUsed: (p.powerUpsUsed ?? 0) + 1 } : p);

        effects.push({ type: 'SOUND', sound: 'powerup-use' });
        
        if (user.isRival) {
            const banter = getRivalBanter('usePowerUp', `${state.settings.seed}-${state.currentTileIndex}`);
            effects.push({ type: 'RIVAL_TAUNT', message: `"${banter}"` });
        } else if (!user.isBot) {
            effects.push({ type: 'TOAST', message: `Used ${powerUp}`, variant: 'info' });
        }

        // Apply Effects
        const isHyperFlux = state.activeAnomaly?.id === 'HYPER_FLUX';
        const durationMult = isHyperFlux ? 2 : 1;
        const powerUpBonus = user._powerUpBonus ?? 0;
        const baseDuration = 1 * durationMult + powerUpBonus;
        
        const isQuantum = state.activeAnomaly?.id === 'QUANTUM_ENTANGLEMENT';
        const rng = new SeededRNG(`quantum-${state.currentTileIndex}-${state.settings.seed}-${playerId}`);

        const bouncedDebuffs: { status: PlayerStatus; fromName: string; scrambledData?: Tile[] }[] = [];

        const applyOffensiveWithReflect = (
            targetPlayer: Player,
            status: PlayerStatus,
            scrambledData?: Tile[]
        ): Player => {
            if (targetPlayer.statuses.some(s => s.type === 'IMMUNE') && targetPlayer._reflectActive) {
                bouncedDebuffs.push({ status, fromName: targetPlayer.name, scrambledData });
                return { ...targetPlayer, _reflectActive: false };
            }
            const res = applyDebuff(targetPlayer, status, state.settings);
            if (res.effect) effects.push(res.effect);
            if (scrambledData && res.player.statuses.some(s => s.type === 'SCRAMBLED')) {
                return { ...res.player, scrambledTileData: scrambledData };
            }
            return res.player;
        };

        switch (powerUp) {
            case 'Shield':
                players = players.map(p => p.id === playerId ? {
                    ...p,
                    _fortifiedShield: p._fortifiedShield !== undefined ? true : undefined,
                    statuses: [...p.statuses, { type: 'SHIELDED', duration: baseDuration, charges: p._fortifiedShield !== undefined ? 2 : 1 }],
                } : p);
                break;
            case 'Rally': {
                const userTeam = user.teamId;
                players = players.map(p => {
                    if (userTeam ? (p.teamId === userTeam && p.id !== playerId) : p.id === playerId) {
                        return { ...p, statuses: [...p.statuses, { type: 'BOOSTED', duration: baseDuration + 1 }] };
                    }
                    return p;
                });
                if (!user.isBot) effects.push({ type: 'TOAST', message: 'Rally! Teammate velocity boosted!', variant: 'success' });
                break;
            }
            case 'Shield Wall': {
                const userTeam = user.teamId;
                players = players.map(p => {
                    if (userTeam ? p.teamId === userTeam : p.id === playerId) {
                        return {
                            ...p,
                            _fortifiedShield: p._fortifiedShield !== undefined ? true : undefined,
                            statuses: [...p.statuses, { type: 'SHIELDED', duration: baseDuration, charges: p._fortifiedShield !== undefined ? 2 : 1 }],
                        };
                    }
                    return p;
                });
                if (!user.isBot) effects.push({ type: 'TOAST', message: 'Shield Wall! Team shielded!', variant: 'success' });
                break;
            }
            case 'Clarity':
                players = players.map(p => {
                    if (p.id === playerId) {
                        const hasBlur = p.statuses.some(s => s.type === 'BLURRED');
                        if (hasBlur && !p.isBot) effects.push({ type: 'TOAST', message: 'Vision Restored', variant: 'success' });
                        return { ...p, statuses: p.statuses.filter(s => s.type !== 'BLURRED') };
                    }
                    return p;
                });
                break;
            case 'Mist Bomb':
                players = players.map(p => {
                    if (isQuantum ? rng.nextFloat() > 0.5 : p.id !== playerId) {
                        return applyOffensiveWithReflect(p, { type: 'BLURRED', duration: baseDuration });
                    }
                    return p;
                });
                break;
            case 'Time Snare': {
                const sorted = [...players].sort((a, b) => b.position - a.position);
                // Target leader, or 2nd place if user is leader
                let target = sorted[0].id === playerId ? sorted[1] : sorted[0];
                
                if (isQuantum) {
                    target = players[rng.nextInt(0, players.length)];
                }
                
                if (target) {
                    players = players.map(p => {
                        if (p.id === target.id) {
                            const updatedTarget = applyOffensiveWithReflect(p, { type: 'FROZEN', duration: baseDuration });
                            if (!p.isBot) effects.push({ type: 'SOUND', sound: 'debuff-hit' });
                            return updatedTarget;
                        }
                        return p;
                    });
                }
                break;
            }
            case 'Data Spike': {
                let spikeTargetId = targetId;
                if (isQuantum) {
                    spikeTargetId = players[rng.nextInt(0, players.length)].id;
                }
                if (!spikeTargetId) {
                    const opponents = players.filter(p => p.id !== playerId);
                    if (opponents.length > 0) {
                        spikeTargetId = [...opponents].sort((a, b) => b.position - a.position)[0].id;
                    }
                }
                
                if (spikeTargetId) {
                    const spikeDuration = baseDuration + (user._dataSpikeBonus ?? 0);
                    const descriptors = eventDescriptors ?? [];
                    const scrambledRun = descriptors.length > 0
                        ? generateRun(`scramble-${state.settings.seed}-${state.currentTileIndex}`, state.settings.runLength, descriptors)
                        : [];
                    players = players.map(p => {
                        if (p.id === spikeTargetId) {
                            const updatedTarget = applyOffensiveWithReflect(p, { type: 'SCRAMBLED', duration: spikeDuration }, scrambledRun);
                            if (!p.isBot) effects.push({ type: 'SOUND', sound: 'debuff-hit' });
                            return updatedTarget;
                        }
                        return p;
                    });
                }
                break;
            }
            case 'Overcharge': {
                const overchargeGain = Math.round((2 + powerUpBonus) * getSeasonalEnergyMultiplier(state.settings.activeSeasonId));
                players = players.map(p => p.id === playerId ? { ...p, energy: p.energy + overchargeGain } : p);
                if (!user.isBot) effects.push({ type: 'TOAST', message: `+${overchargeGain} Energy!`, variant: 'success' });
                break;
            }
            case 'Sludge':
                players = players.map(p => {
                    if (isQuantum ? rng.nextFloat() > 0.5 : p.id !== playerId) {
                        return applyOffensiveWithReflect(p, { type: 'SLOWED', duration: baseDuration });
                    }
                    return p;
                });
                break;
            case 'Reflector':
                players = players.map(p => p.id === playerId ? { ...p, _reflectActive: true, statuses: [...p.statuses, { type: 'IMMUNE', duration: baseDuration }] } : p);
                if (!user.isBot) effects.push({ type: 'TOAST', message: 'Reflector Active! Next debuff will bounce!', variant: 'info' });
                break;
        }

        // Process any debuffs bounced back by Reflector onto the sender
        if (bouncedDebuffs.length > 0) {
            players = players.map(p => {
                if (p.id !== playerId) return p;
                let bouncedSender = { ...p };
                for (const bounce of bouncedDebuffs) {
                    const res = applyDebuff(bouncedSender, bounce.status, state.settings);
                    bouncedSender = res.player;
                    if (bounce.scrambledData && bouncedSender.statuses.some(s => s.type === 'SCRAMBLED')) {
                        bouncedSender = { ...bouncedSender, scrambledTileData: bounce.scrambledData };
                    }
                    effects.push({
                        type: 'TOAST',
                        message: `${bounce.fromName}'s Reflector bounced ${bounce.status.type} back at ${user.name}!`,
                        variant: 'warning',
                    });
                }
                return bouncedSender;
            });
        }

        return { newState: { ...state, players }, effects };
    },

    /**
     * Handles Pit Stop actions which cost energy.
     */
    processPitStop: (state: GameState, playerId: number, action: 'scrub' | 'tuneUp' | 'analyze' | 'recharge'): GameUpdate => {
        if (!action || typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(PIT_STOP_CONFIG.actions, action)) {
            return { newState: state, effects: [] };
        }
        let players = [...state.players];
        const player = players.find(p => p.id === playerId);
        if (!player) return { newState: state, effects: [] };

        if (action === 'tuneUp' && isSeasonalPowerUpsDisabled(state.settings.activeSeasonId)) {
            return { newState: state, effects: [{ type: 'TOAST', message: 'Hardcore Season: Power-ups Disabled!', variant: 'warning' }] };
        }

        const config = PIT_STOP_CONFIG.actions[action];
        const updatedPlayer = { ...player, statuses: [...player.statuses], powerUps: [...player.powerUps] };
        const effectiveCost = (action === 'analyze' && updatedPlayer._freeScanner) ? 0 : config.cost;

        // Cost check
        if (action !== 'recharge' && updatedPlayer.energy < effectiveCost) {
             return { newState: state, effects: [{ type: 'TOAST', message: 'Not enough energy!', variant: 'warning' }] };
        }

        if (action !== 'recharge') {
            updatedPlayer.energy -= effectiveCost;
        }

        const effects: GameEffect[] = [];

        switch (action) {
            case 'scrub': {
                const badStatusIdx = updatedPlayer.statuses.findIndex(s => s.type !== 'SHIELDED' && s.type !== 'BOOSTED' && s.type !== 'IMMUNE');
                if (badStatusIdx > -1) {
                    updatedPlayer.statuses.splice(badStatusIdx, 1);
                    effects.push({ type: 'TOAST', message: 'Status Cleared', variant: 'success' });
                }
                break;
            }
            case 'tuneUp': {
                const tuneRng = new SeededRNG(`pitstop-${state.currentTileIndex}-${playerId}`);
                const allPowerUps: PowerUp[] = state.settings.teamMode
                    ? ['Clarity', 'Mist Bomb', 'Time Snare', 'Shield', 'Data Spike', 'Overcharge', 'Sludge', 'Reflector', 'Rally', 'Shield Wall']
                    : ['Clarity', 'Mist Bomb', 'Time Snare', 'Shield', 'Data Spike', 'Overcharge', 'Sludge', 'Reflector'];
                const award = allPowerUps[tuneRng.nextInt(0, allPowerUps.length)];
                updatedPlayer.powerUps.push(award);
                effects.push({ type: 'TOAST', message: `Tuned Up: ${award}`, variant: 'success' });
                break;
            }
            case 'recharge': {
                const rechargeAmount = Math.round((2 + (updatedPlayer._rechargeBonus ?? 0)) * getSeasonalEnergyMultiplier(state.settings.activeSeasonId));
                updatedPlayer.energy += rechargeAmount;
                effects.push({ type: 'TOAST', message: `Recharged +${rechargeAmount} Energy`, variant: 'info' });
                break;
            }
            case 'analyze':
                updatedPlayer._sensorScanTiles = 4;
                effects.push({ type: 'TOAST', message: 'Sensor Forecast Active: Next 4 Tiles Revealed', variant: 'info' });
                break;
        }

        players = players.map(p => p.id === playerId ? updatedPlayer : p);
        return { newState: { ...state, players }, effects };
    },
    
    /**
     * Activates Overdrive state for a player.
     */
    activateOverdrive: (state: GameState, playerId: number, force: boolean = false): GameUpdate => {
        const player = state.players.find(p => p.id === playerId);
        if (!player) return { newState: state, effects: [] };
        if (state.overdrivingPlayerIds.includes(playerId)) {
            return { newState: state, effects: [] };
        }
        
        if (!force) {
            if (player.overdriveCooldown > 0) {
                 return { newState: state, effects: [{ type: 'TOAST', message: 'Overdrive Cooling Down', variant: 'warning' }] };
            }
            if (player.energy < OVERDRIVE_ENERGY_COST) {
                 return { newState: state, effects: [{ type: 'TOAST', message: 'Insufficient Energy', variant: 'warning' }] };
            }
        }

        const players = state.players.map(p =>
            p.id === playerId
            ? { ...p, energy: force ? p.energy : p.energy - OVERDRIVE_ENERGY_COST, overdriveCooldown: force ? p.overdriveCooldown : Math.max(0, OVERDRIVE_COOLDOWN + 1 - (p._overdriveCooldownReduction ?? 0)) }
            : p
        );
        
        return {
            newState: { ...state, players, overdrivingPlayerIds: [...state.overdrivingPlayerIds, playerId] },
            effects: [
                { type: 'SOUND', sound: 'overdrive-activate' },
                { type: 'TOAST', message: `${player.name} Overdrive Engaged!`, variant: 'info' }
            ]
        };
    },

    /**
     * Resolves a Rival Intervention choice.
     */
    resolveIntervention: (state: GameState, accept: boolean): GameUpdate => {
        if (!state.activeIntervention) return { newState: state, effects: [] };
        
        const newRun = [...state.run];
        let players = [...state.players];
        const effects: GameEffect[] = [];
        const intervention = state.activeIntervention;
        
        if (accept && intervention.hazardTile) {
            newRun[state.currentTileIndex] = intervention.hazardTile;
            if (intervention.type === 'SABOTAGE' && intervention.sabotageStatus) {
                players = players.map(p => {
                    if (!p.isBot) {
                        return { ...p, statuses: [...p.statuses, { type: intervention.sabotageStatus!, duration: 1 }] };
                    }
                    return p;
                });
                effects.push({ type: 'TOAST', message: `Sabotage Accepted! Racing under ${intervention.sabotageStatus} for +${intervention.cpBonus} CP`, variant: 'warning' });
            } else if (intervention.type === 'VETO') {
                effects.push({ type: 'TOAST', message: `Veto Challenge Accepted! +${intervention.cpBonus} CP Bonus`, variant: 'warning' });
            } else {
                effects.push({ type: 'TOAST', message: 'Hazard Accepted! +Bonus CP', variant: 'warning' });
            }
        } else {
             effects.push({ type: 'TOAST', message: 'Challenge Declined', variant: 'info' });
        }

        return {
            newState: { ...state, players, run: newRun, activeIntervention: null },
            effects
        };
    }
};
