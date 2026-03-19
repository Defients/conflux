/**
 * services/botMind.ts
 * 
 * Client-side adapter for the shared bot simulation logic.
 * Converts GameEvent (React-dependent) to BotEventInfo (portable) and delegates
 * to shared/botMind.ts. Re-exports decideBotPowerUp and decideBotOverdrive directly.
 */

import { EventResult, GameEvent, GameSettings, Player, RivalTraitId, BotEventInfo } from '../types';
import {
  simulateBotPerformance as sharedSimulateBotPerformance,
  decideBotPowerUp,
  decideBotOverdrive,
} from '../shared/botMind';

/** Convert a client-side GameEvent to a portable BotEventInfo. */
function toBotEventInfo(event: GameEvent): BotEventInfo {
    return {
        id: event.id,
        performanceDimension: event.performanceDimension,
        isStub: event.isStub,
        getStars: event.getStars,
    };
}

/**
 * Client-side simulateBotPerformance that accepts GameEvent (with React Component).
 * Delegates to the shared implementation after stripping React-specific fields.
 */
export function simulateBotPerformance(
    bot: Player,
    event: GameEvent,
    difficulty: number,
    settings: GameSettings,
    rivalTraits?: RivalTraitId[],
): Omit<EventResult, 'playerId'> {
    return sharedSimulateBotPerformance(bot, toBotEventInfo(event), difficulty, settings, rivalTraits);
}

// Re-export shared functions that don't need GameEvent adaptation
export { decideBotPowerUp, decideBotOverdrive };
