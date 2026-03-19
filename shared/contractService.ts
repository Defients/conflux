import { Contract, ContractObjective, CorporationId, GameState, ObjectiveType, PerformanceDimension } from '../types';
import { SeededRNG } from './seededRNG';

const OBJECTIVE_TEMPLATES: { type: ObjectiveType; generator: (rng: SeededRNG, difficulty: number) => ContractObjective }[] = [
    {
        type: 'FINISH_RACE_IN_POS',
        generator: (rng, difficulty) => {
            const pos = difficulty <= 1 ? 3 : difficulty === 2 ? 2 : 1;
            return {
                type: 'FINISH_RACE_IN_POS',
                description: `Finish in the top ${pos}`,
                targetValue: pos,
                dimension: undefined,
                isComplete: false,
            };
        },
    },
    {
        type: 'AVG_STARS_ABOVE',
        generator: (rng, difficulty) => {
            const target = difficulty <= 1 ? 1.5 : difficulty === 2 ? 2.0 : 2.5;
            return {
                type: 'AVG_STARS_ABOVE',
                description: `Average ${target}+ stars across the run`,
                targetValue: target,
                dimension: undefined,
                isComplete: false,
            };
        },
    },
    {
        type: 'GET_STARS_IN_DIMENSION',
        generator: (rng, difficulty) => {
            const dimensions: PerformanceDimension[] = ['reaction', 'typing', 'precision', 'memory', 'rhythm', 'logic'];
            const dim = dimensions[rng.nextInt(0, dimensions.length)];
            const stars = difficulty <= 1 ? 2 : 3;
            return {
                type: 'GET_STARS_IN_DIMENSION',
                description: `Get ${stars}+ stars in a ${dim} event`,
                targetValue: stars,
                dimension: dim,
                isComplete: false,
            };
        },
    },
];

export function generateContracts(seed: string): Contract[] {
    const rng = new SeededRNG(`contracts-${seed}`);
    const corps = Object.values(CorporationId);
    const contracts: Contract[] = [];

    for (const corpId of corps) {
        const difficulty = rng.nextInt(1, 4);
        const numObjectives = rng.nextInt(1, 3);
        const shuffledTemplates = rng.shuffle([...OBJECTIVE_TEMPLATES]);
        const objectives: ContractObjective[] = [];

        for (let i = 0; i < numObjectives; i++) {
            objectives.push(shuffledTemplates[i % shuffledTemplates.length].generator(rng, difficulty));
        }

        const cpReward = 10 + difficulty * 5 + numObjectives * 5;
        const repReward = 1 + difficulty;

        contracts.push({
            corporationId: corpId,
            objectives,
            cpReward,
            repReward,
        });
    }

    return contracts;
}

export function evaluateContracts(contracts: Contract[], gameState: GameState, eventDimensionMap: { [eventId: string]: string }): Contract[] {
    const humanPlayer = gameState.players.find(p => !p.isBot);
    if (!humanPlayer) return contracts;

    const sortedPlayers = [...gameState.players].sort((a, b) => b.position - a.position);
    const humanRank = sortedPlayers.indexOf(humanPlayer) + 1;
    const avgStars = humanPlayer.tileHistory.length > 0
        ? humanPlayer.tileHistory.reduce((s, h) => s + h.stars, 0) / humanPlayer.tileHistory.length
        : 0;

    return contracts.map(contract => ({
        ...contract,
        objectives: contract.objectives.map(obj => {
            let isComplete = false;

            switch (obj.type) {
                case 'FINISH_RACE_IN_POS':
                    isComplete = humanRank <= obj.targetValue;
                    break;
                case 'AVG_STARS_ABOVE':
                    isComplete = avgStars >= obj.targetValue;
                    break;
                case 'GET_STARS_IN_DIMENSION':
                    if (obj.dimension) {
                        isComplete = humanPlayer.tileHistory.some((h, i) => {
                            const tile = gameState.run[h.tileIndex];
                            if (!tile) return false;
                            const eventDim = eventDimensionMap[tile.eventId];
                            return eventDim === obj.dimension && h.stars >= obj.targetValue;
                        });
                    }
                    break;
            }

            return { ...obj, isComplete };
        }),
    }));
}

export function allObjectivesComplete(contract: Contract): boolean {
    return contract.objectives.every(o => o.isComplete);
}
