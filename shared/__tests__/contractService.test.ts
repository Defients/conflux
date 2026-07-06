import { describe, it, expect } from 'vitest';
import { generateContracts, evaluateContracts, allObjectivesComplete } from '../contractService';
import { GameState, GameSettings, Player, ChassisId, CorporationId, Contract } from '../types';

const MOCK_SETTINGS: GameSettings = {
  playerCount: 4,
  easyBots: 2,
  intermediateBots: 1,
  seed: 'contract-test',
  runLength: 8,
  sound: true,
  accessibility: false,
  uiEffects: true,
  colorBlindMode: false,
  selectedChassis: ChassisId.Standard,
};

const MOCK_RUN = [
  { tileIndex: 1, eventId: 'reaction-tap', difficulty: 1, subSeed: '0.1' },
  { tileIndex: 2, eventId: 'aim-flick', difficulty: 2, subSeed: '0.2' },
  { tileIndex: 3, eventId: 'quick-math', difficulty: 3, subSeed: '0.3' },
];

const MOCK_PLAYERS: Player[] = [
  {
    id: 1, name: 'Human', isBot: false, isRival: false, color: '#00dffc',
    position: 100, powerUps: [], statuses: [], tileHistory: [
      { tileIndex: 1, stars: 3 },
      { tileIndex: 2, stars: 2 },
      { tileIndex: 3, stars: 3 },
    ], energy: 0, overdriveCooldown: 0,
  },
  {
    id: 2, name: 'Bot', isBot: true, isRival: false, color: '#d64f8a',
    position: 80, powerUps: [], statuses: [], tileHistory: [
      { tileIndex: 1, stars: 1 },
      { tileIndex: 2, stars: 2 },
      { tileIndex: 3, stars: 1 },
    ], energy: 0, overdriveCooldown: 0,
  },
];

const MOCK_GAME_STATE: GameState = {
  settings: MOCK_SETTINGS,
  players: MOCK_PLAYERS,
  run: MOCK_RUN as any,
  currentTileIndex: 3,
  eventResults: {},
  lastTileResults: null,
  overdrivingPlayerIds: [],
  activeIntervention: null,
  lastHazardInterventionIndex: -99,
  activeAnomaly: null,
};

const EVENT_DIMENSION_MAP: Record<string, string> = {
  'reaction-tap': 'reaction',
  'aim-flick': 'precision',
  'quick-math': 'logic',
};

describe('generateContracts', () => {
  it('generates contracts for all corporations', () => {
    const contracts = generateContracts('test-seed');
    expect(contracts).toHaveLength(3);
    const corpIds = contracts.map(c => c.corporationId);
    expect(corpIds).toContain(CorporationId.Cyberex);
    expect(corpIds).toContain(CorporationId.Zenith);
    expect(corpIds).toContain(CorporationId.Rogue);
  });

  it('is deterministic', () => {
    const c1 = generateContracts('det-seed');
    const c2 = generateContracts('det-seed');
    expect(c1).toEqual(c2);
  });

  it('generates at least 1 objective per contract', () => {
    const contracts = generateContracts('obj-seed');
    contracts.forEach(c => {
      expect(c.objectives.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('assigns positive rewards', () => {
    const contracts = generateContracts('reward-seed');
    contracts.forEach(c => {
      expect(c.cpReward).toBeGreaterThan(0);
      expect(c.repReward).toBeGreaterThan(0);
    });
  });
});

describe('evaluateContracts', () => {
  it('marks FINISH_RACE_IN_POS complete when human places high enough', () => {
    const contracts: Contract[] = [{
      corporationId: CorporationId.Cyberex,
      objectives: [{
        type: 'FINISH_RACE_IN_POS',
        description: 'Finish in top 1',
        targetValue: 1,
        isComplete: false,
      }],
      cpReward: 20,
      repReward: 3,
    }];
    const evaluated = evaluateContracts(contracts, MOCK_GAME_STATE, EVENT_DIMENSION_MAP);
    expect(evaluated[0].objectives[0].isComplete).toBe(true);
  });

  it('marks AVG_STARS_ABOVE complete when average is high enough', () => {
    const contracts: Contract[] = [{
      corporationId: CorporationId.Zenith,
      objectives: [{
        type: 'AVG_STARS_ABOVE',
        description: 'Average 2+ stars',
        targetValue: 2.0,
        isComplete: false,
      }],
      cpReward: 15,
      repReward: 2,
    }];
    const evaluated = evaluateContracts(contracts, MOCK_GAME_STATE, EVENT_DIMENSION_MAP);
    expect(evaluated[0].objectives[0].isComplete).toBe(true);
  });

  it('marks GET_STARS_IN_DIMENSION complete when matching stars achieved', () => {
    const contracts: Contract[] = [{
      corporationId: CorporationId.Rogue,
      objectives: [{
        type: 'GET_STARS_IN_DIMENSION',
        description: 'Get 3+ stars in reaction',
        targetValue: 3,
        dimension: 'reaction',
        isComplete: false,
      }],
      cpReward: 25,
      repReward: 4,
    }];
    const evaluated = evaluateContracts(contracts, MOCK_GAME_STATE, EVENT_DIMENSION_MAP);
    expect(evaluated[0].objectives[0].isComplete).toBe(true);
  });
});

describe('allObjectivesComplete', () => {
  it('returns true when all objectives are complete', () => {
    const contract: Contract = {
      corporationId: CorporationId.Cyberex,
      objectives: [
        { type: 'FINISH_RACE_IN_POS', description: 'x', targetValue: 1, isComplete: true },
        { type: 'AVG_STARS_ABOVE', description: 'y', targetValue: 2, isComplete: true },
      ],
      cpReward: 10,
      repReward: 2,
    };
    expect(allObjectivesComplete(contract)).toBe(true);
  });

  it('returns false when any objective is incomplete', () => {
    const contract: Contract = {
      corporationId: CorporationId.Cyberex,
      objectives: [
        { type: 'FINISH_RACE_IN_POS', description: 'x', targetValue: 1, isComplete: true },
        { type: 'AVG_STARS_ABOVE', description: 'y', targetValue: 2, isComplete: false },
      ],
      cpReward: 10,
      repReward: 2,
    };
    expect(allObjectivesComplete(contract)).toBe(false);
  });
});
