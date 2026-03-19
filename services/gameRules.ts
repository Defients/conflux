/**
 * services/gameRules.ts (Client)
 * 
 * Client-side wrapper around shared GameRules.
 * Automatically injects eventRegistry as SharedEventDescriptor[] for
 * operations that need it (e.g. Data Spike scrambled run generation).
 * 
 * All existing call sites continue to work without changes.
 */

import { GameState, EventResult, PowerUp, SharedEventDescriptor } from '../types';
import { GameRules as SharedGameRules } from '../shared/gameRules';
import { eventRegistry } from '../events/eventRegistry';

// Re-export types from shared
export type { GameEffect, GameUpdate } from '../shared/gameRules';

/** Event descriptors extracted from the client-side eventRegistry for shared use. */
const sharedDescriptors: SharedEventDescriptor[] = eventRegistry.map(e => ({
    id: e.id,
    displayName: e.displayName,
    performanceDimension: e.performanceDimension,
    isStub: e.isStub,
}));

/**
 * Client-side GameRules adapter.
 * Wraps shared GameRules and auto-injects eventDescriptors where needed.
 */
export const GameRules = {
    processRaceStep: (state: GameState, results: { [playerId: number]: EventResult }) => {
        return SharedGameRules.processRaceStep(state, results, sharedDescriptors);
    },

    applyPowerUp: (state: GameState, playerId: number, powerUp: PowerUp, targetId?: number) => {
        return SharedGameRules.applyPowerUp(state, playerId, powerUp, targetId, sharedDescriptors);
    },

    // These don't need eventDescriptors, pass through directly
    processPitStop: SharedGameRules.processPitStop,
    activateOverdrive: SharedGameRules.activateOverdrive,
    resolveIntervention: SharedGameRules.resolveIntervention,
};
