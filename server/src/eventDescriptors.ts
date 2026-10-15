/**
 * server/src/eventDescriptors.ts
 *
 * Server-side event descriptors and star computation functions.
 * Re-exported from the canonical `shared/eventCatalog.ts` so client and server
 * never diverge on metadata, durations, or star scoring.
 */

import { SharedEventDescriptor } from '../../shared/types';
import { EVENT_CATALOG } from '../../shared/eventCatalog';

/** Server-side star computation function type. */
export type StarComputer = (primaryMetric: number, secondaryMetric?: number) => 1 | 2 | 3;

/** Map of eventId -> star computation function derived from shared/eventCatalog. */
export const STAR_COMPUTERS: Record<string, StarComputer> = Object.fromEntries(
  EVENT_CATALOG.map((entry) => [
    entry.id,
    (pm: number, sm?: number) => entry.getStars({ primaryMetric: pm, secondaryMetric: sm }),
  ])
);

/**
 * Server-side event descriptors for run generation.
 * Contains only portable metadata (no React components).
 */
export const EVENT_DESCRIPTORS: SharedEventDescriptor[] = EVENT_CATALOG.map((entry) => ({
  id: entry.id,
  displayName: entry.displayName,
  performanceDimension: entry.performanceDimension,
  isStub: entry.isStub ?? false,
}));
