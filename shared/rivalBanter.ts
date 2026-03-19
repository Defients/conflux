/**
 * shared/rivalBanter.ts
 * 
 * Deterministic rival banter generation.
 * Portable: no browser or React dependencies.
 */

import { RIVAL_BANTER } from './constants';
import { SeededRNG } from './seededRNG';

export type BanterEvent = 'takeLead' | 'usePowerUp' | 'win';

export function getRivalBanter(event: BanterEvent, seed: string): string {
    const rng = new SeededRNG(`banter-${event}-${seed}`);
    const lines = RIVAL_BANTER[event];
    return lines[rng.nextInt(0, lines.length)];
}
