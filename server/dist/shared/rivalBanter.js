"use strict";
/**
 * shared/rivalBanter.ts
 *
 * Deterministic rival banter generation.
 * Portable: no browser or React dependencies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRivalBanter = getRivalBanter;
const constants_1 = require("./constants");
const seededRNG_1 = require("./seededRNG");
function getRivalBanter(event, seed) {
    const rng = new seededRNG_1.SeededRNG(`banter-${event}-${seed}`);
    const lines = constants_1.RIVAL_BANTER[event];
    return lines[rng.nextInt(0, lines.length)];
}
//# sourceMappingURL=rivalBanter.js.map