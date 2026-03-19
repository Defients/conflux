/**
 * services/pathGenerator.ts (Client)
 * Re-exports from shared. GameEvent extends SharedEventDescriptor,
 * so existing call sites using GameEvent[] continue to work.
 */
export { generateRun, generateCustomRun } from '../shared/pathGenerator';
