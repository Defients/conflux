import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { EVENT_CATALOG, getCanonicalEventDurationSec } from '../eventCatalog';
import { eventRegistry } from '../../events/eventRegistry';
import { EVENT_DESCRIPTORS, STAR_COMPUTERS } from '../../server/src/eventDescriptors';
import { generateSolvableFlowGrid, rotateConnections } from '../../events/FlowConnect';
import { SeededRNG } from '../seededRNG';

describe('47-Event Canonical Catalog & Contract Suite', () => {
  it('registers all 47 events with 100% parity between client registry and server descriptors', () => {
    expect(EVENT_CATALOG).toHaveLength(47);
    expect(eventRegistry).toHaveLength(47);
    expect(EVENT_DESCRIPTORS).toHaveLength(47);

    for (const entry of EVENT_CATALOG) {
      const clientEvt = eventRegistry.find(e => e.id === entry.id);
      const serverEvt = EVENT_DESCRIPTORS.find(e => e.id === entry.id);
      const serverScorer = STAR_COMPUTERS[entry.id];

      expect(clientEvt).toBeDefined();
      expect(serverEvt).toBeDefined();
      expect(serverScorer).toBeTypeOf('function');
      expect(clientEvt!.performanceDimension).toBe(entry.performanceDimension);
      expect(serverEvt!.performanceDimension).toBe(entry.performanceDimension);
    }
  });

  it('has bounded positive durations across difficulties 1..3 and accessibility modes', () => {
    for (const entry of EVENT_CATALOG) {
      for (const diff of [1, 2, 3]) {
        for (const acc of [false, true]) {
          const sec = getCanonicalEventDurationSec(entry.id, diff, acc);
          expect(sec).toBeGreaterThanOrEqual(4);
          expect(sec).toBeLessThanOrEqual(45);
          const dilated = getCanonicalEventDurationSec(entry.id, diff, acc, 'TIME_DILATION');
          expect(dilated).toBeCloseTo(sec * 0.8, 5);
        }
      }
    }
  });

  it('can attain 1★, 2★, and 3★ within metricBounds for every event', () => {
    for (const entry of EVENT_CATALOG) {
      const { pmMin, pmMax, smMin, smMax } = entry.bounds;
      const seenStars = new Set<number>();

      // Sample across primary and secondary metric ranges
      const pmSamples = [
        pmMin,
        0,
        1,
        2,
        3,
        4,
        5,
        7,
        8,
        10,
        12,
        15,
        20,
        35,
        45,
        50,
        60,
        75,
        85,
        90,
        95,
        100,
        150,
        250,
        350,
        3500,
        5000,
        10000,
        14000,
        18000,
        22000,
        35000,
        99999,
        pmMax,
      ].filter(v => v >= pmMin && v <= pmMax);

      const smSamples = smMin !== undefined && smMax !== undefined
        ? [smMin, 0, 1, 2, 3, 4, 6, 8, 10, 12, 5000, 10000, 13000, 16000, 19000, 25000, smMax].filter(v => v >= smMin && v <= smMax)
        : [undefined];

      for (const pm of pmSamples) {
        for (const sm of smSamples) {
          const stars = entry.getStars({ primaryMetric: pm, secondaryMetric: sm });
          seenStars.add(stars);
        }
      }

      expect(seenStars.has(1), `${entry.id} must be able to score 1★`).toBe(true);
      expect(seenStars.has(2), `${entry.id} must be able to score 2★`).toBe(true);
      expect(seenStars.has(3), `${entry.id} must be able to score 3★`).toBe(true);
    }
  });

  it('BalanceBeam can attain 3★ at all difficulties (12s, 10s, 8s)', () => {
    const balanceBeam = EVENT_CATALOG.find(e => e.id === 'balance-beam')!;
    expect(balanceBeam.getStars({ primaryMetric: 11, secondaryMetric: 12 })).toBe(3);
    expect(balanceBeam.getStars({ primaryMetric: 9, secondaryMetric: 10 })).toBe(3);
    expect(balanceBeam.getStars({ primaryMetric: 7, secondaryMetric: 8 })).toBe(3);
    expect(balanceBeam.getStars({ primaryMetric: 5, secondaryMetric: 10 })).toBe(2);
    expect(balanceBeam.getStars({ primaryMetric: 2, secondaryMetric: 8 })).toBe(1);
  });

  it('FlowConnect generates a guaranteed solvable puzzle across 50 seeds for 3x3 and 4x4 grids', () => {
    for (const gridSize of [3, 4]) {
      for (let s = 0; s < 25; s++) {
        const rng = new SeededRNG(`flow-test-${gridSize}-${s}`);
        const grid = generateSolvableFlowGrid(gridSize, rng);
        expect(grid).toHaveLength(gridSize * gridSize);

        // Restoring interior tiles to rotation=0 (baseConnections) must connect (0,0) to (gridSize-1, gridSize-1)
        const unscrambled = grid.map(t =>
          t.type === 'empty'
            ? { ...t, rotation: 0, connections: rotateConnections(t.baseConnections, 0) }
            : t
        );

        // BFS from 0 to gridSize*gridSize - 1
        const visited = new Set<number>([0]);
        const queue = [0];
        let reachedDest = false;
        const dirs = [
          { dir: 0, dr: -1, dc: 0, opp: 2 },
          { dir: 1, dr: 0, dc: 1, opp: 3 },
          { dir: 2, dr: 1, dc: 0, opp: 0 },
          { dir: 3, dr: 0, dc: -1, opp: 1 },
        ];
        while (queue.length > 0) {
          const idx = queue.shift()!;
          const r = Math.floor(idx / gridSize);
          const c = idx % gridSize;
          for (const d of dirs) {
            if (!unscrambled[idx].connections[d.dir]) continue;
            const nr = r + d.dr;
            const nc = c + d.dc;
            if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue;
            const nIdx = nr * gridSize + nc;
            if (visited.has(nIdx)) continue;
            if (unscrambled[nIdx].connections[d.opp]) {
              visited.add(nIdx);
              queue.push(nIdx);
              if (unscrambled[nIdx].type === 'dest') reachedDest = true;
            }
          }
        }
        expect(reachedDest).toBe(true);
      }
    }
  });

  it('enforces zero Math.random() calls across all 47 event component files', () => {
    const eventsDir = path.resolve(__dirname, '../../events');
    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.tsx') && f !== 'EventStub.tsx');
    expect(files.length).toBe(47);

    for (const file of files) {
      const content = fs.readFileSync(path.join(eventsDir, file), 'utf-8');
      expect(content.includes('Math.random'), `${file} must use SeededRNG instead of Math.random`).toBe(false);
    }
  });
});
