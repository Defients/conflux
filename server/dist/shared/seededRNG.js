"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeededRNG = void 0;
/**
 * shared/seededRNG.ts
 *
 * A simple mulberry32 pseudo-random number generator.
 * Portable: no browser or React dependencies.
 */
class SeededRNG {
    constructor(seed) {
        this.seed = this.hash(seed);
    }
    // Simple string hash function
    hash(str) {
        let h = 1779033703 ^ str.length;
        for (let i = 0; i < str.length; i++) {
            h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
            h = (h << 13) | (h >>> 19);
        }
        return h;
    }
    // Returns a random float between 0 (inclusive) and 1 (exclusive)
    nextFloat() {
        let t = (this.seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    // Returns a random integer between min (inclusive) and max (exclusive)
    nextInt(min, max) {
        return Math.floor(this.nextFloat() * (max - min)) + min;
    }
    // Returns a random float in a normal distribution (Box-Muller transform)
    nextGaussian(mean = 0, std = 1) {
        let u = 0, v = 0;
        while (u === 0)
            u = this.nextFloat(); //Converting [0,1) to (0,1)
        while (v === 0)
            v = this.nextFloat();
        const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        return z * std + mean;
    }
    // Shuffles an array in place
    shuffle(array) {
        let currentIndex = array.length;
        let randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(this.nextFloat() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }
}
exports.SeededRNG = SeededRNG;
//# sourceMappingURL=seededRNG.js.map