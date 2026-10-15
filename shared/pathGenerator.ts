/**
 * shared/pathGenerator.ts
 * 
 * Deterministic run/tile generation using seeded RNG.
 * Portable: accepts SharedEventDescriptor[] instead of React-dependent GameEvent[].
 */

import { SharedEventDescriptor, Tile, TileModifier, CorporationId } from './types';
import { SeededRNG } from './seededRNG';

const FALLBACK_EVENT: SharedEventDescriptor = {
    id: 'reaction-tap',
    displayName: 'Reaction Tap',
    performanceDimension: 'reaction',
};

function clampRunLength(runLength: number): number {
    if (typeof runLength !== 'number' || !Number.isFinite(runLength)) return 8;
    return Math.max(1, Math.min(100, Math.floor(runLength)));
}

function assignDifficultyAndModifiers(
    rng: SeededRNG,
    runLength: number
): { difficulties: number[]; modifiers: { [index: number]: { type: TileModifier, corp?: CorporationId } } } {
    const difficulties: number[] = [];
    const modifiers: { [index: number]: { type: TileModifier, corp?: CorporationId } } = {};

    // Determine difficulty bias based on progress
    for (let i = 0; i < runLength; i++) {
        const progress = runLength > 1 ? i / (runLength - 1) : 0;
        let difficulty: number;
        const rand = rng.nextFloat();

        if (progress < 0.33) { // First third
            difficulty = rand < 0.7 ? 1 : 2;
        } else if (progress < 0.66) { // Middle third
            difficulty = rand < 0.2 ? 1 : (rand < 0.8 ? 2 : 3);
        } else { // Last third
            difficulty = rand < 0.6 ? 2 : 3;
        }
        difficulties.push(difficulty);
    }

    // Place modifiers on interior tiles [1 .. runLength - 2] without unbounded loops
    const modifierTypes: TileModifier[] = ['BOOST_PAD', 'POWER_SURGE', 'STATIC_FIELD', 'FOG_BANK', 'SPONSORED', 'ICE_PATCH', 'NEBULA_DRIFT'];
    rng.shuffle(modifierTypes);
    const eligibleCount = Math.max(0, runLength - 2);
    const desiredModifiers = rng.nextInt(2, Math.max(3, Math.min(5, runLength - 1)));
    const targetModifiers = Math.min(eligibleCount, desiredModifiers);

    const eligiblePositions = Array.from({ length: eligibleCount }, (_, idx) => idx + 1);
    rng.shuffle(eligiblePositions);
    const selectedPositions = eligiblePositions.slice(0, targetModifiers);
    
    selectedPositions.forEach((pos, i) => {
        const type = modifierTypes[i % modifierTypes.length];
        const modifier: { type: TileModifier, corp?: CorporationId } = { type };
        if (type === 'SPONSORED') {
            const corps = Object.values(CorporationId);
            modifier.corp = corps[rng.nextInt(0, corps.length)];
        }
        modifiers[pos] = modifier;
    });

    // ICE_PATCH: increase difficulty by 1 (capped at 3) for harder 3★ threshold
    for (const [posStr, mod] of Object.entries(modifiers)) {
        if (mod.type === 'ICE_PATCH') {
            const pos = parseInt(posStr);
            difficulties[pos] = Math.min(3, difficulties[pos] + 1);
        }
    }

    return { difficulties, modifiers };
}


export function generateRun(
  seed: string,
  runLength: number,
  events: SharedEventDescriptor[]
): Tile[] {
  const safeLength = clampRunLength(runLength);
  const rng = new SeededRNG(`run-${seed}`);
  const run: Tile[] = [];

  const workingEvents = Array.isArray(events) ? events.filter(e => e && !e.isStub) : [];
  const eventPool = workingEvents.length > 0 ? [...workingEvents] : [FALLBACK_EVENT];
  
  rng.shuffle(eventPool);
  
  const { difficulties, modifiers } = assignDifficultyAndModifiers(rng, safeLength);

  for (let i = 0; i < safeLength; i++) {
    // Pick an event, allowing repeats
    let event = eventPool[rng.nextInt(0, eventPool.length)];
    const modifierInfo = modifiers[i];

    // NEBULA_DRIFT: replace the event with a different random one (cosmic chaos)
    if (modifierInfo?.type === 'NEBULA_DRIFT' && eventPool.length > 1) {
      let driftEvent = event;
      let attempts = 0;
      while (driftEvent.id === event.id && attempts < 10) {
        driftEvent = eventPool[rng.nextInt(0, eventPool.length)];
        attempts++;
      }
      event = driftEvent;
    }

    run.push({
      tileIndex: i + 1,
      eventId: event.id,
      difficulty: difficulties[i],
      modifier: modifierInfo?.type,
      sponsoringCorp: modifierInfo?.corp,
      subSeed: rng.nextFloat().toString(),
    });
  }

  return run;
}

export function generateCustomRun(
  seed: string,
  runLength: number,
  events: SharedEventDescriptor[],
  customEventPoolIds: string[]
): Tile[] {
    const safeLength = clampRunLength(runLength);
    const rng = new SeededRNG(`run-${seed}`);
    const run: Tile[] = [];
    const safeEvents = Array.isArray(events) ? events : [];
    const safeCustomIds = Array.isArray(customEventPoolIds) ? customEventPoolIds : [];

    let eventPool = safeEvents.filter(e => e && safeCustomIds.includes(e.id) && !e.isStub);
    if (eventPool.length === 0) {
        // Fallback to all non-stub events if the custom pool is empty or only has stubs
        eventPool = safeEvents.filter(e => e && !e.isStub);
    }
    if (eventPool.length === 0) {
        eventPool = [FALLBACK_EVENT];
    }
    
    rng.shuffle(eventPool);

    const { difficulties, modifiers } = assignDifficultyAndModifiers(rng, safeLength);

    for (let i = 0; i < safeLength; i++) {
        let event = eventPool[rng.nextInt(0, eventPool.length)];
        const modifierInfo = modifiers[i];

        // NEBULA_DRIFT: replace the event with a different random one (cosmic chaos)
        if (modifierInfo?.type === 'NEBULA_DRIFT' && eventPool.length > 1) {
          let driftEvent = event;
          let attempts = 0;
          while (driftEvent.id === event.id && attempts < 10) {
            driftEvent = eventPool[rng.nextInt(0, eventPool.length)];
            attempts++;
          }
          event = driftEvent;
        }

        run.push({
            tileIndex: i + 1,
            eventId: event.id,
            difficulty: difficulties[i],
            modifier: modifierInfo?.type,
            sponsoringCorp: modifierInfo?.corp,
            subSeed: rng.nextFloat().toString(),
        });
    }

    return run;
}
