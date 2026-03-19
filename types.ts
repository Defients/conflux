/**
 * types.ts (Client)
 * 
 * Re-exports all shared types and adds client-only types that depend on React.
 * Existing imports from './types' continue to work unchanged.
 */

import React from 'react';
import type { EventResult, GameSettings, Tile, PerformanceDimension } from './shared/types';

// Re-export everything from shared types
export * from './shared/types';

// ─── Client-Only Types (React-dependent) ─────────────────────────────────────

export interface GameEvent {
  id: string;
  displayName: string;
  instructions: string;
  interactionHint: string;
  scoringHint: string;
  durationSec: (difficulty: number, accessibility: boolean) => number;
  performanceDimension: PerformanceDimension;
  Component: React.FC<EventProps>;
  getStars: (result: Omit<EventResult, 'stars' | 'playerId'>) => 1 | 2 | 3;
  isStub?: boolean;
}

export interface EventProps {
  tile: Tile;
  event: GameEvent;
  settings: GameSettings;
  onComplete: (result: Omit<EventResult, 'playerId' | 'stars'>) => void;
  isBlurred: boolean;
  isOverdriving: boolean;
  isPaused?: boolean;
}
