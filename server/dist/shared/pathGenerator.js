"use strict";
/**
 * shared/pathGenerator.ts
 *
 * Deterministic run/tile generation using seeded RNG.
 * Portable: accepts SharedEventDescriptor[] instead of React-dependent GameEvent[].
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRun = generateRun;
exports.generateCustomRun = generateCustomRun;
const types_1 = require("./types");
const seededRNG_1 = require("./seededRNG");
function assignDifficultyAndModifiers(rng, runLength) {
    const difficulties = [];
    const modifiers = {};
    // Determine difficulty bias based on progress
    for (let i = 0; i < runLength; i++) {
        const progress = i / (runLength - 1);
        let difficulty;
        const rand = rng.nextFloat();
        if (progress < 0.33) { // First third
            difficulty = rand < 0.7 ? 1 : 2;
        }
        else if (progress < 0.66) { // Middle third
            difficulty = rand < 0.2 ? 1 : (rand < 0.8 ? 2 : 3);
        }
        else { // Last third
            difficulty = rand < 0.6 ? 2 : 3;
        }
        difficulties.push(difficulty);
    }
    // Place modifiers
    const modifierTypes = ['BOOST_PAD', 'POWER_SURGE', 'STATIC_FIELD', 'FOG_BANK', 'SPONSORED'];
    rng.shuffle(modifierTypes);
    const modifierPositions = new Set();
    // Place 2-4 modifiers in a run, not on the first or last tile
    const numModifiers = rng.nextInt(2, 5);
    if (runLength > 2) {
        while (modifierPositions.size < numModifiers) {
            modifierPositions.add(rng.nextInt(1, runLength - 1));
        }
    }
    Array.from(modifierPositions).forEach((pos, i) => {
        const type = modifierTypes[i % modifierTypes.length];
        const modifier = { type };
        if (type === 'SPONSORED') {
            const corps = Object.values(types_1.CorporationId);
            modifier.corp = corps[rng.nextInt(0, corps.length)];
        }
        modifiers[pos] = modifier;
    });
    return { difficulties, modifiers };
}
function generateRun(seed, runLength, events) {
    const rng = new seededRNG_1.SeededRNG(`run-${seed}`);
    const run = [];
    const workingEvents = events.filter(e => !e.isStub);
    let eventPool = [...workingEvents];
    rng.shuffle(eventPool);
    const { difficulties, modifiers } = assignDifficultyAndModifiers(rng, runLength);
    for (let i = 0; i < runLength; i++) {
        // Pick an event, allowing repeats
        const event = eventPool[rng.nextInt(0, eventPool.length)];
        const modifierInfo = modifiers[i];
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
function generateCustomRun(seed, runLength, events, customEventPoolIds) {
    const rng = new seededRNG_1.SeededRNG(`run-${seed}`);
    const run = [];
    let eventPool = events.filter(e => customEventPoolIds.includes(e.id) && !e.isStub);
    if (eventPool.length === 0) {
        // Fallback to all non-stub events if the custom pool is empty or only has stubs
        eventPool = events.filter(e => !e.isStub);
    }
    rng.shuffle(eventPool);
    const { difficulties, modifiers } = assignDifficultyAndModifiers(rng, runLength);
    for (let i = 0; i < runLength; i++) {
        const event = eventPool[rng.nextInt(0, eventPool.length)];
        const modifierInfo = modifiers[i];
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
//# sourceMappingURL=pathGenerator.js.map