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
  ChassisId, BotPersonality, RivalIntervention, GameSettings, SharedEventDescriptor
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
import { applySkillEffects, applyLoadoutEffects } from './gameSetup';

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
    let finalStatus = { ...status };
    
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

        let finalResults = { ...results };

        // 1. Handle Overdrive
        state.overdrivingPlayerIds.forEach(pid => {
            const result = finalResults[pid];
            const player = players.find(p => p.id === pid);
            if (!result || !player) return;

            if (result.stars === 3) {
                finalResults[pid] = { ...result, stars: 4 };
                effects.push({ type: 'SOUND', sound: 'overdrive-success' });
                effects.push({ type: 'TOAST', message: `${player.name} Overdrive Success!`, variant: 'success' });
            } else {
                finalResults[pid] = { ...result, stars: 0 };
                players = players.map(p => p.id === pid ? { ...p, statuses: [...p.statuses, { type: 'STUNNED', duration: 1 }] } : p);
                effects.push({ type: 'SOUND', sound: 'overdrive-fail' });
                effects.push({ type: 'TOAST', message: `${player.name} Overdrive Failed!`, variant: 'warning' });
            }
        });

        // 2. Core Loop: Movement & Rewards
        players = players.map(p => {
            const result = finalResults[p.id];
            if (!result) return p;

            let updatedPlayer = { ...p };

            // A. Haptics for Human
            if (!p.isBot && (result.stars >= 2)) {
                effects.push({ type: 'HAPTIC', pattern: 'light' });
            }

            // B. PowerUps
            const shouldAward = currentTile.modifier === 'POWER_SURGE' || (result.stars > 0 && POWERUP_AWARD_RULES[result.stars as 1|2|3]);
            if (shouldAward) {
                let award = POWERUP_AWARD_RULES[result.stars as 1|2|3] ?? 'Clarity';

                // POWER_SURGE tiles have a chance to award from the expanded pool
                if (currentTile.modifier === 'POWER_SURGE') {
                    const expandedPool: PowerUp[] = ['Overcharge', 'Sludge', 'Reflector', 'Shield', 'Clarity'];
                    if (powerUpRng.nextFloat() < 0.4) {
                        award = expandedPool[powerUpRng.nextInt(0, expandedPool.length)];
                    }
                }
                
                // Chassis Bonuses
                const chassis = p.chassisId ?? (p.isBot ? undefined : state.settings.selectedChassis);
                const shieldChance = chassis === ChassisId.Scavenger ? SHIELD_UPGRADE_CHANCE + 0.2 : SHIELD_UPGRADE_CHANCE;
                
                if (result.stars === 3 && powerUpRng.nextFloat() < shieldChance) {
                    award = 'Shield';
                }

                updatedPlayer.powerUps = [...updatedPlayer.powerUps, award];
                updatedPlayer.energy += result.stars + (updatedPlayer._energyPerStarBonus ?? 0);
                
                if (!p.isBot || p.isRival) {
                    effects.push({ type: 'SOUND', sound: 'powerup-get' });
                    if (!p.isBot) effects.push({ type: 'TOAST', message: `Acquired ${award}`, variant: 'info' });
                }
            } else {
                updatedPlayer.energy += result.stars + (updatedPlayer._energyPerStarBonus ?? 0);
            }

            updatedPlayer.tileHistory = [...updatedPlayer.tileHistory, { tileIndex: state.currentTileIndex, stars: result.stars }];

            // C. Movement Calculation
            let moveMult = STAR_MOVEMENT_MULTIPLIERS[result.stars] || 0;
            
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
            
            // v5.0: Movement bonus from loadout modules
            if (updatedPlayer._movementBonus && result.stars > 0) {
                moveMult *= (1 + updatedPlayer._movementBonus);
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
        players = players.map(p => ({
            ...p,
            overdriveCooldown: Math.max(0, p.overdriveCooldown - 1),
            statuses: p.statuses
                .map(s => ({ ...s, duration: s.duration - 1 }))
                .filter(s => s.duration > 0),
            // Only clear scrambled data if the status is gone
            scrambledTileData: p.statuses.some(s => s.type === 'SCRAMBLED') ? p.scrambledTileData : undefined,
        }));

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
                const hazardTile: Tile = {
                    ...nextTile,
                    difficulty: Math.min(3, nextTile.difficulty + 1),
                    isHazard: true,
                };
                
                activeIntervention = { type: 'HAZARD', hazardTile, cpBonus: CP_AWARD_RULES.hazardBonus };
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
        if (currentTile.modifier === 'STATIC_FIELD') {
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
        
        const isQuantum = state.activeAnomaly?.id === 'QUANTUM_ENTANGLEMENT';
        const rng = new SeededRNG(`quantum-${state.currentTileIndex}-${state.settings.seed}-${playerId}`);

        switch (powerUp) {
            case 'Shield':
                players = players.map(p => p.id === playerId ? { ...p, statuses: [...p.statuses, { type: 'SHIELDED', duration: 1 * durationMult }] } : p);
                break;
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
                        const res = applyDebuff(p, { type: 'BLURRED', duration: 1 * durationMult }, state.settings);
                        if (res.effect) effects.push(res.effect);
                        return res.player;
                    }
                    return p;
                });
                break;
            case 'Time Snare':
                const sorted = [...players].sort((a, b) => b.position - a.position);
                // Target leader, or 2nd place if user is leader
                let target = sorted[0].id === playerId ? sorted[1] : sorted[0];
                
                if (isQuantum) {
                    target = players[rng.nextInt(0, players.length)];
                }
                
                if (target) {
                    players = players.map(p => {
                        if (p.id === target.id) {
                            const res = applyDebuff(p, { type: 'FROZEN', duration: 1 * durationMult }, state.settings);
                            if (res.effect) effects.push(res.effect);
                            if (!p.isBot) effects.push({ type: 'SOUND', sound: 'debuff-hit' });
                            return res.player;
                        }
                        return p;
                    });
                }
                break;
            case 'Data Spike':
                let spikeTargetId = targetId;
                if (isQuantum) {
                    spikeTargetId = players[rng.nextInt(0, players.length)].id;
                }
                
                if (spikeTargetId) {
                    players = players.map(p => {
                        if (p.id === spikeTargetId) {
                            const res = applyDebuff(p, { type: 'SCRAMBLED', duration: 1 * durationMult }, state.settings);
                            // Use provided event descriptors for scrambled run, or empty array as fallback
                            const descriptors = eventDescriptors ?? [];
                            const scrambledRun = descriptors.length > 0
                                ? generateRun(`scramble-${state.settings.seed}-${state.currentTileIndex}`, state.settings.runLength, descriptors)
                                : [];
                            if (res.effect) effects.push(res.effect);
                            if (!p.isBot) effects.push({ type: 'SOUND', sound: 'debuff-hit' });
                            return { ...res.player, scrambledTileData: scrambledRun };
                        }
                        return p;
                    });
                }
                break;
            case 'Overcharge':
                players = players.map(p => p.id === playerId ? { ...p, energy: p.energy + 2 } : p);
                if (!user.isBot) effects.push({ type: 'TOAST', message: '+2 Energy!', variant: 'success' });
                break;
            case 'Sludge':
                players = players.map(p => {
                    if (isQuantum ? rng.nextFloat() > 0.5 : p.id !== playerId) {
                        const res = applyDebuff(p, { type: 'SLOWED', duration: 1 * durationMult }, state.settings);
                        if (res.effect) effects.push(res.effect);
                        return res.player;
                    }
                    return p;
                });
                break;
            case 'Reflector':
                players = players.map(p => p.id === playerId ? { ...p, statuses: [...p.statuses, { type: 'IMMUNE', duration: 1 * durationMult }] } : p);
                if (!user.isBot) effects.push({ type: 'TOAST', message: 'Reflector Active!', variant: 'info' });
                break;
        }

        return { newState: { ...state, players }, effects };
    },

    /**
     * Handles Pit Stop actions which cost energy.
     */
    processPitStop: (state: GameState, playerId: number, action: 'scrub' | 'tuneUp' | 'analyze' | 'recharge'): GameUpdate => {
        let players = [...state.players];
        const player = players.find(p => p.id === playerId);
        if (!player) return { newState: state, effects: [] };

        const config = PIT_STOP_CONFIG.actions[action];
        let updatedPlayer = { ...player };

        // Cost check
        if (action !== 'recharge' && updatedPlayer.energy < config.cost) {
             return { newState: state, effects: [{ type: 'TOAST', message: 'Not enough energy!', variant: 'warning' }] };
        }

        if (action !== 'recharge') {
            updatedPlayer.energy -= config.cost;
        }

        const effects: GameEffect[] = [];

        switch (action) {
            case 'scrub':
                const badStatusIdx = updatedPlayer.statuses.findIndex(s => s.type !== 'SHIELDED' && s.type !== 'BOOSTED');
                if (badStatusIdx > -1) {
                    updatedPlayer.statuses.splice(badStatusIdx, 1);
                    effects.push({ type: 'TOAST', message: 'Status Cleared', variant: 'success' });
                }
                break;
            case 'tuneUp':
                const tuneRng = new SeededRNG(`pitstop-${state.currentTileIndex}-${playerId}`);
                const allPowerUps: PowerUp[] = ['Clarity', 'Mist Bomb', 'Time Snare', 'Shield', 'Data Spike', 'Overcharge', 'Sludge', 'Reflector'];
                const award = allPowerUps[tuneRng.nextInt(0, allPowerUps.length)];
                updatedPlayer.powerUps.push(award);
                effects.push({ type: 'TOAST', message: `Tuned Up: ${award}`, variant: 'success' });
                break;
            case 'recharge':
                updatedPlayer.energy += 2;
                effects.push({ type: 'TOAST', message: 'Recharged +2 Energy', variant: 'info' });
                break;
            case 'analyze':
                // UI handles visualization, state just pays cost
                effects.push({ type: 'TOAST', message: 'Analysis Complete', variant: 'info' });
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
            ? { ...p, energy: force ? p.energy : p.energy - OVERDRIVE_ENERGY_COST, overdriveCooldown: force ? p.overdriveCooldown : OVERDRIVE_COOLDOWN + 1 } 
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
        
        let newRun = [...state.run];
        const effects: GameEffect[] = [];
        
        if (accept && state.activeIntervention.hazardTile) {
            newRun[state.currentTileIndex] = state.activeIntervention.hazardTile;
            effects.push({ type: 'TOAST', message: 'Hazard Accepted! +Bonus CP', variant: 'warning' });
        } else {
             effects.push({ type: 'TOAST', message: 'Challenge Declined', variant: 'info' });
        }

        return {
            newState: { ...state, run: newRun, activeIntervention: null },
            effects
        };
    }
};
