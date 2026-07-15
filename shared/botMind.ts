/**
 * shared/botMind.ts
 * 
 * Portable bot simulation logic used by both client and server.
 * Uses BotEventInfo instead of GameEvent to avoid React dependencies.
 */

import {
  BotEventInfo, BotProfile, EventResult, GameSettings, GameState,
  Player, PowerUp, Tile, RivalTraitId, BotPersonality,
} from './types';
import { SeededRNG } from './seededRNG';
import { BOT_PROFILES } from './constants';

function applyRivalTraits(baseProfile: BotProfile, traits: RivalTraitId[], dimension: string): BotProfile {
    let profile = { ...baseProfile, reaction: { ...baseProfile.reaction }, typing: { ...baseProfile.typing }, precision: { ...baseProfile.precision } };
    for (const trait of traits) {
        switch (trait) {
            case RivalTraitId.PrecisionFocus:
                if (dimension === 'precision') {
                    profile.precision.star3Chance = Math.min(0.85, profile.precision.star3Chance + 0.15);
                }
                break;
            case RivalTraitId.ReactionPro:
                if (dimension === 'reaction' || dimension === 'rhythm') {
                    profile.reaction.mean = Math.max(100, profile.reaction.mean - 30);
                }
                break;
            case RivalTraitId.TypingAce:
                if (dimension === 'typing') {
                    profile.typing.wpm += 10;
                }
                break;
            case RivalTraitId.DebuffResistant:
                break;
            case RivalTraitId.AggressivePowerups:
                break;
        }
    }
    return profile;
}

function getBotResult(
    event: BotEventInfo, 
    difficulty: number, 
    botProfile: BotProfile, 
    rng: SeededRNG
): Omit<EventResult, 'playerId'> {
    let primaryMetric = 0;
    let secondaryMetric = 0;

    switch (event.performanceDimension) {
        case 'reaction': {
            if (event.id === 'asteroid-dodge') {
                const totalDuration = 12000;
                const spawnInterval = 500 - difficulty * 100;
                const numWaves = Math.floor(totalDuration / spawnInterval);
                
                const { mean, std } = botProfile.reaction;
                const reactionWindow = 600; 

                let hits = 0;
                for (let i = 0; i < numWaves; i++) {
                    const botReactionTime = rng.nextGaussian(mean, std);
                    if (botReactionTime > reactionWindow) {
                         if (rng.nextFloat() < 0.5) {
                            hits++;
                        }
                    }
                }
                primaryMetric = hits;
            } else if (event.id === 'burst-clicks') {
                const { mean, std } = botProfile.reaction;
                const baseCPS = 1000 / (mean * 0.8);
                const cpsStd = 1000 / std;
                let simulatedCPS = rng.nextGaussian(baseCPS, cpsStd * 0.2);
                
                simulatedCPS *= (botProfile.reaction.mean < 250) ? 1.2 : 0.9;
                
                primaryMetric = Math.max(3, Math.min(14, simulatedCPS));

            } else if (event.id === 'whack-a-mole') {
                const totalDuration = 12000;
                const moleDuration = 1200 - difficulty * 200;
                const spawnInterval = 700 - difficulty * 100;
                const totalMoles = Math.floor(totalDuration / (moleDuration + spawnInterval));
                
                const { mean, std } = botProfile.reaction;
                const { star3Chance, star2Chance } = botProfile.precision;
                const hitChance = star3Chance + star2Chance * 0.7 + (1 - star3Chance - star2Chance) * 0.4;
                
                let hits = 0;
                for (let i = 0; i < totalMoles; i++) {
                    const reactionTime = rng.nextGaussian(mean, std);
                    if (reactionTime < moleDuration) {
                        if (rng.nextFloat() < hitChance) hits++;
                    }
                }
                primaryMetric = hits;
                secondaryMetric = totalMoles;
            } else if (event.id === 'stop-the-clock') {
                const { star3Chance, star2Chance } = botProfile.precision;
                const { mean, std } = botProfile.reaction;
                let totalError = 0;
                for (let i = 0; i < 3; i++) {
                    const baseError = rng.nextFloat() < star3Chance ? 30 : rng.nextFloat() < star2Chance ? 100 : 300;
                    const noise = Math.abs(rng.nextGaussian(0, std * 0.3));
                    totalError += baseError + noise;
                }
                primaryMetric = totalError / 3;
            } else { // Reaction Tap
                const { mean, std, clamp } = botProfile.reaction;
                const adjustedMean = mean + (difficulty - 1) * 20;
                let rt = rng.nextGaussian(adjustedMean, std);
                rt = Math.max(clamp[0], Math.min(clamp[1], rt));
                primaryMetric = rt;
            }
            break;
        }
        case 'typing': {
            if (event.id === 'system-purge') {
                const numWords = 8 + difficulty * 2;
                const corruptionChance = 0.2 + difficulty * 0.1;
                const validWords = Math.floor(numWords * (1 - corruptionChance));
                const { star3Chance, star2Chance } = botProfile.precision;
                
                const identificationAccuracy = star3Chance + star2Chance * 0.8;
                let score = 0;

                for(let i=0; i<numWords; i++) {
                    const isCorrupted = rng.nextFloat() < corruptionChance;
                    const botIdentifiesCorrectly = rng.nextFloat() < identificationAccuracy;

                    if (botIdentifiesCorrectly) {
                        score++;
                    } else {
                        score--;
                    }
                }
                primaryMetric = score;
                secondaryMetric = validWords;
            } else if (event.id === 'type-racer-snippet') {
                const phraseLength = 25;
                const { wpm, std } = botProfile.typing;
                const simulatedWPM = rng.nextGaussian(wpm, std);
                const baseTimeMs = (phraseLength / 5) / simulatedWPM * 60000;
                const noise = rng.nextGaussian(0, 200);
                primaryMetric = Math.max(1000, baseTimeMs + noise);
            } else if (event.id === 'word-storm') {
                const totalDuration = (15 - difficulty) * 1000;
                const spawnInterval = 2500 - difficulty * 400;
                const totalWords = Math.floor(totalDuration / spawnInterval);
                
                const { wpm, std } = botProfile.typing;
                const avgWordLen = 6;
                const timePerWord = (avgWordLen / 5) / wpm * 60000;
                const wordsBotCanType = Math.floor(totalDuration / timePerWord);
                
                const { star3Chance, star2Chance } = botProfile.precision;
                const accuracy = star3Chance + star2Chance * 0.7 + (1 - star3Chance - star2Chance) * 0.4;
                
                let destroyed = 0;
                for (let i = 0; i < Math.min(totalWords, wordsBotCanType); i++) {
                    if (rng.nextFloat() < accuracy) destroyed++;
                }
                primaryMetric = destroyed;
                secondaryMetric = totalWords;
            } else if (event.id === 'anagram-rush') {
                const totalDuration = (12 + difficulty) * 1000;
                const { wpm, std } = botProfile.typing;
                const { star3Chance, star2Chance } = botProfile.precision;
                const solveChance = star3Chance + star2Chance * 0.6 + (1 - star3Chance - star2Chance) * 0.3;
                
                const avgSolveTime = 3000 + (60 / wpm) * 1000;
                const maxSolves = Math.floor(totalDuration / avgSolveTime);
                
                let correct = 0;
                for (let i = 0; i < maxSolves; i++) {
                    if (rng.nextFloat() < solveChance) correct++;
                }
                primaryMetric = correct;
            } else { // Type Burst
                const { wpm, std, errorRate } = botProfile.typing;
                const adjustedWPM = wpm - (difficulty - 1) * 5;
                const simulatedWPM = rng.nextGaussian(adjustedWPM, std);
                const simulatedErrorRate = rng.nextFloat() * (errorRate[1] - errorRate[0]) + errorRate[0];
                primaryMetric = simulatedWPM;
                secondaryMetric = Math.round(simulatedErrorRate * 100);
            }
            break;
        }
        case 'precision': {
            if (event.id === 'find-pixel') {
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const successChance = isIntermediate ? 0.85 : 0.60;
                const roll = rng.nextFloat();
                
                if (roll < successChance) {
                    const { mean, std } = botProfile.reaction;
                    const baseSearchTime = isIntermediate ? 1500 : 2200;
                    const searchTime = baseSearchTime + rng.nextGaussian(mean, std) * 3;
                    primaryMetric = Math.max(500, searchTime);
                } else {
                    primaryMetric = 99999;
                }
            } else if (event.id === 'target-practice') {
                const { mean, std } = botProfile.reaction;
                const { star2Chance, star3Chance } = botProfile.precision;
                const totalDuration = 10000;
                const spawnInterval = 600 - difficulty * 100;
                const totalTargets = Math.floor(totalDuration / spawnInterval);
                
                const hitChance = star3Chance + star2Chance * 0.7 + (1 - star3Chance - star2Chance) * 0.4;
                let hits = 0;
                
                for (let i = 0; i < totalTargets; i++) {
                    const reactionTime = rng.nextGaussian(mean, std);
                    if (reactionTime < 1500) { 
                        if (rng.nextFloat() < hitChance) {
                            hits++;
                        }
                    }
                }
                primaryMetric = hits;
                secondaryMetric = totalTargets;
            } else if (event.id === 'path-tracer') {
                const { star2Chance, star3Chance } = botProfile.precision;
                const failChance = (1 - (star2Chance + star3Chance)) * 0.5;
                if (rng.nextFloat() < failChance) {
                    primaryMetric = rng.nextFloat() * 70;
                } else {
                    primaryMetric = 95 + rng.nextFloat() * 5;
                }
            } else if (event.id === 'aim-flick') {
                const { star2Chance, star3Chance } = botProfile.precision;
                const firstTryChance = star3Chance;
                const secondTryChance = star2Chance;
                
                let attempts = 0;
                const roll1 = rng.nextFloat();
                if (roll1 < firstTryChance) {
                    attempts = 1;
                } else {
                    const roll2 = rng.nextFloat();
                    if (roll2 < secondTryChance) {
                        attempts = 2;
                    }
                }
                primaryMetric = attempts;
            } else if (event.id === 'color-math') {
                const { star2Chance, star3Chance } = botProfile.precision;
                const roll = rng.nextFloat();
                let meanDeltaE, stdDeltaE;
        
                if (roll < star3Chance) {
                    meanDeltaE = 2;
                    stdDeltaE = 1.5;
                } else if (roll < star3Chance + star2Chance) {
                    meanDeltaE = 6;
                    stdDeltaE = 1.5;
                } else {
                    meanDeltaE = 12;
                    stdDeltaE = 3;
                }
                primaryMetric = Math.max(0, rng.nextGaussian(meanDeltaE, stdDeltaE));
            } else if (event.id === 'angle-nudge') {
                const { star2Chance, star3Chance } = botProfile.precision;
                const roll = rng.nextFloat();
                let meanError, stdError;
        
                if (roll < star3Chance) {
                    meanError = 1.0;
                    stdError = 0.8;
                } else if (roll < star3Chance + star2Chance) {
                    meanError = 3.5;
                    stdError = 1.0;
                } else {
                    meanError = 7.0;
                    stdError = 2.0;
                }
                primaryMetric = Math.max(0.1, rng.nextGaussian(meanError, stdError));
            } else if (event.id === 'ghost-trajectory') {
                 const { star2Chance, star3Chance } = botProfile.precision;
                 const roll = rng.nextFloat();
                 let meanError, stdError;
         
                 if (roll < star3Chance) {
                     meanError = 10;
                     stdError = 8;
                 } else if (roll < star3Chance + star2Chance) {
                     meanError = 30;
                     stdError = 10;
                 } else {
                     meanError = 60;
                     stdError = 20;
                 }
                 primaryMetric = Math.max(1, rng.nextGaussian(meanError, stdError));
            } else if (event.id === 'dial-lock') {
                const { star3Chance, star2Chance } = botProfile.precision;
                let totalError = 0;
                for (let i = 0; i < 3; i++) {
                    const roll = rng.nextFloat();
                    let meanError, stdError;
                    if (roll < star3Chance) { meanError = 3; stdError = 2; }
                    else if (roll < star3Chance + star2Chance) { meanError = 12; stdError = 5; }
                    else { meanError = 30; stdError = 15; }
                    totalError += Math.max(0.5, rng.nextGaussian(meanError, stdError));
                }
                primaryMetric = totalError;
            } else if (event.id === 'pixel-push') {
                const { star3Chance, star2Chance } = botProfile.precision;
                let successCount = 0;
                for (let i = 0; i < 3; i++) {
                    const roll = rng.nextFloat();
                    if (roll < star3Chance) successCount++;
                    else if (roll < star3Chance + star2Chance * 0.7) successCount++;
                }
                primaryMetric = successCount;
            } else if (event.id === 'mirror-draw') {
                const { star3Chance, star2Chance } = botProfile.precision;
                const roll = rng.nextFloat();
                let meanCompletion, stdCompletion;
                if (roll < star3Chance) { meanCompletion = 92; stdCompletion = 5; }
                else if (roll < star3Chance + star2Chance) { meanCompletion = 75; stdCompletion = 8; }
                else { meanCompletion = 55; stdCompletion = 15; }
                primaryMetric = Math.max(0, Math.min(100, rng.nextGaussian(meanCompletion, stdCompletion)));
            } else { // slider-precision
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const mean = isIntermediate ? 5 : 10;
                const std = isIntermediate ? 4 : 6;
                let distance = Math.abs(rng.nextGaussian(mean, std));
                distance = Math.max(0, Math.min(30, distance));
                primaryMetric = distance;
            }
            break;
        }
        case 'memory': {
            if (event.id === 'snapshot-memory') {
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const correctChance = isIntermediate ? 0.95 : 0.70;
                let correctCount = 0;
                for (let i = 0; i < 3; i++) {
                    if (rng.nextFloat() < correctChance) {
                        correctCount++;
                    }
                }
                primaryMetric = correctCount;
            } else if (event.id === 'memory-flip') {
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                
                const memoryChance = isIntermediate ? 0.95 : 0.75;
                let knownPairs = 0;
                let errors = 0;
                let clicks = 0;
                
                const initialKnownPairs = Math.floor(6 * (isIntermediate ? 0.5 : 0.2));
                
                let pairsToFind = 6 - initialKnownPairs;
                
                while(pairsToFind > 0) {
                    clicks += 2;
                    if (rng.nextFloat() < memoryChance && knownPairs > 0) {
                        pairsToFind--;
                        knownPairs--;
                    } else {
                        if (rng.nextFloat() < 0.2) {
                           pairsToFind--;
                        } else {
                           errors++;
                           if(rng.nextFloat() < memoryChance * 1.5) knownPairs++;
                        }
                    }
                    if (clicks > 30) break;
                }

                const { mean, std } = botProfile.reaction;
                const thinkingTimePerClick = rng.nextGaussian(mean, std) + 100;
                const totalTimeMs = clicks * thinkingTimePerClick;
                
                primaryMetric = errors;
                secondaryMetric = Math.max(5000, Math.min(20000, totalTimeMs));

            } else if (event.id === 'sequence-sort') {
                const sequenceLength = 4 + difficulty;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const correctChance = isIntermediate ? 0.98 : 0.85;
                let correctSteps = 0;
                for (let i = 0; i < sequenceLength; i++) {
                    if (rng.nextFloat() < correctChance) {
                        correctSteps++;
                    } else {
                        break;
                    }
                }
                primaryMetric = correctSteps;
                secondaryMetric = sequenceLength;
            } else if (event.id === 'number-stack') {
                const sequenceLength = 4 + difficulty;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const correctChance = isIntermediate ? 0.90 : 0.70;
                let correctCount = 0;
                for (let i = 0; i < sequenceLength; i++) {
                    if (rng.nextFloat() < correctChance) {
                        correctCount++;
                    } else {
                        break;
                    }
                }
                primaryMetric = correctCount;
                secondaryMetric = sequenceLength;
            } else if (event.id === 'symbol-match') {
                const setCount = 3 + difficulty;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const correctChance = isIntermediate ? 0.95 : 0.75;
                const wrongChance = isIntermediate ? 0.05 : 0.20;
                
                let correct = 0;
                let wrong = 0;
                for (let i = 0; i < setCount; i++) {
                    if (rng.nextFloat() < correctChance) correct++;
                }
                const distractors = 12 - setCount;
                for (let i = 0; i < distractors; i++) {
                    if (rng.nextFloat() < wrongChance) wrong++;
                }
                primaryMetric = correct;
                secondaryMetric = wrong;
            } else { // pattern-recall
                const sequenceLength = 3 + difficulty;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const correctChance = isIntermediate ? 0.95 : 0.80;
                let correctSteps = 0;
                for (let i = 0; i < sequenceLength; i++) {
                    if (rng.nextFloat() < correctChance) {
                        correctSteps++;
                    } else {
                        break;
                    }
                }
                primaryMetric = correctSteps;
                secondaryMetric = sequenceLength;
            }
            break;
        }
        case 'rhythm': {
            if (event.id === 'jump-bar') {
                const totalRounds = 2 + difficulty;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const successChance = isIntermediate ? 0.90 : 0.70;
                let successfulJumps = 0;
                for (let i = 0; i < totalRounds; i++) {
                    if (rng.nextFloat() < successChance) {
                        successfulJumps++;
                    }
                }
                primaryMetric = successfulJumps;
                secondaryMetric = totalRounds;
            } else if (event.id === 'rhythm-tap') {
                const totalBeats = 12;
                const bpm = 100 + difficulty * 25;
                const beatDuration = 60000 / bpm;
                const perfectWindow = beatDuration * 0.1;
                const goodWindow = beatDuration * 0.2;
                
                const timingStd = botProfile.reaction.std / 2;
                
                let score = 0;
                for (let i = 0; i < totalBeats; i++) {
                    const timingError = rng.nextGaussian(0, timingStd);
                    const diff = Math.abs(timingError);
                    if (diff <= perfectWindow) {
                        score += 3;
                    } else if (diff <= goodWindow) {
                        score += 1;
                    } else {
                        score -= 1;
                    }
                }
                primaryMetric = score;
                secondaryMetric = totalBeats;
            } else if (event.id === 'sprint-mash') {
                 const { mean, std } = botProfile.reaction;
                 const baseCadenceHz = 4 + (250 / mean) * 2;
                 const cadenceStd = std / mean * 0.5;
                 
                 const targetCadence = rng.nextGaussian(baseCadenceHz, cadenceStd);
                 const progress = (targetCadence - 2) / (9 - 2);
                 const finalProgress = Math.max(0, Math.min(1, progress + rng.nextGaussian(0, 0.15)));
                 
                 primaryMetric = finalProgress * 100;
            } else if (event.id === 'audio-beat') {
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const correctChance = isIntermediate ? 0.9 : 0.6;
                const isCorrect = rng.nextFloat() < correctChance;
                
                const { mean, std } = botProfile.reaction;
                const decisionTime = rng.nextGaussian(mean, std) * 4 + 1000;
                
                primaryMetric = isCorrect ? 1 : 0;
                secondaryMetric = Math.max(500, Math.min(12000, decisionTime));
            } else if (event.id === 'drum-echo') {
                const totalHits = 6;
                const bpm = 90 + difficulty * 20;
                const beatInterval = 60000 / bpm;
                const timingStd = botProfile.reaction.std / 2;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const padAccuracy = isIntermediate ? 0.95 : 0.75;
                
                let score = 0;
                for (let i = 0; i < totalHits; i++) {
                    if (rng.nextFloat() < padAccuracy) {
                        const timingError = Math.abs(rng.nextGaussian(0, timingStd));
                        if (timingError < beatInterval * 0.1) score += 3;
                        else if (timingError < beatInterval * 0.25) score += 2;
                        else if (timingError < beatInterval * 0.5) score += 1;
                    }
                }
                primaryMetric = score;
                secondaryMetric = totalHits;
            } else if (event.id === 'wave-ride') {
                const { star3Chance, star2Chance } = botProfile.precision;
                const timingStd = botProfile.reaction.std;
                const roll = rng.nextFloat();
                let meanPct, stdPct;
                if (roll < star3Chance) { meanPct = 88; stdPct = 5; }
                else if (roll < star3Chance + star2Chance) { meanPct = 65; stdPct = 8; }
                else { meanPct = 45; stdPct = 15; }
                primaryMetric = Math.max(0, Math.min(100, rng.nextGaussian(meanPct, stdPct)));
            } else { // EvadeGrid, etc.
                const totalRounds = 4 + difficulty;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const hitChancePerRound = isIntermediate ? 0.15 : 0.30;
                let hits = 0;
                for (let i = 0; i < totalRounds; i++) {
                    if (rng.nextFloat() < hitChancePerRound) {
                        hits++;
                    }
                }
                primaryMetric = hits;
            }
            break;
        }
        case 'logic': {
            if (event.id === 'quick-quiz') {
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const accuracy = isIntermediate ? 0.90 : 0.70;
                
                const { mean, std } = botProfile.reaction;
                let correctCount = 0;
                let totalTimeMs = 0;
                
                for (let i = 0; i < 3; i++) {
                    const decisionTime = rng.nextGaussian(mean, std) * 3 + 500;
                    const clampedTime = Math.max(300, Math.min(3800, decisionTime));
                    totalTimeMs += clampedTime;
                    
                    if (rng.nextFloat() < accuracy) {
                        correctCount++;
                    }
                }
                primaryMetric = correctCount;
                secondaryMetric = totalTimeMs;

            } else if (event.id === 'wire-link') {
                const { mean, std } = botProfile.reaction;
                const baseTime = 8000 + difficulty * 7000;
                const thinkingFactor = 10 + difficulty * 5;
                const thinkingTime = rng.nextGaussian(mean, std) * thinkingFactor;
                let completionTime = baseTime + thinkingTime;
                
                completionTime *= rng.nextGaussian(1, 0.15);

                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                if (!isIntermediate && rng.nextFloat() < 0.1) {
                    completionTime = 99999;
                }

                primaryMetric = Math.max(3000, completionTime);
            } else if (event.id === 'code-breaker') {
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const meanGuesses = isIntermediate ? 3.5 : 6;
                const stdGuesses = isIntermediate ? 1 : 1.5;
                let guesses = Math.round(rng.nextGaussian(meanGuesses, stdGuesses));
                guesses = Math.max(1, Math.min(10, guesses));
                primaryMetric = guesses;
            } else if (event.id === 'quick-math') {
                const { mean, std } = botProfile.reaction;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                
                const baseTimePerProblem = 1800 - difficulty * 200;
                const totalTime = 15000;
                let timeUsed = 0;
                let score = 0;
                
                const accuracy = isIntermediate ? 0.95 : 0.80;

                while(timeUsed < totalTime) {
                    const thinkingTime = rng.nextGaussian(mean, std) * 1.5;
                    timeUsed += baseTimePerProblem + Math.max(100, thinkingTime);
                    if (timeUsed < totalTime) {
                        if (rng.nextFloat() < accuracy) {
                            score++;
                        }
                    }
                }
                primaryMetric = score;
            } else if (event.id === 'maze-micro') {
                const { mean, std } = botProfile.reaction;
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                
                const baseTime = 9000 - difficulty * 1500;
                const thinkingPenalty = isIntermediate ? 0.8 : 1.5;
                
                const timeTaken = baseTime + rng.nextGaussian(mean, std) * 5 * thinkingPenalty;
                
                if (!isIntermediate && rng.nextFloat() < 0.05) {
                    primaryMetric = 99999;
                } else {
                    primaryMetric = Math.max(2000, timeTaken);
                }
            } else if (event.id === 'emoji-cipher') {
                const { star3Chance } = botProfile.precision;
                const isIntermediate = star3Chance > 0.2;
                const solveChance = isIntermediate ? 0.95 : 0.7;

                const { mean, std } = botProfile.reaction;
                const thinkingTime = rng.nextGaussian(mean, std) * 10 + 2000;
                const typingTime = 2000;
                
                let accuracy = 0;
                if (rng.nextFloat() < solveChance) {
                    accuracy = 100;
                } else {
                    accuracy = rng.nextFloat() * 50 + 40;
                }

                primaryMetric = accuracy;
                secondaryMetric = Math.max(3000, thinkingTime + typingTime);
            } else if (event.id === 'color-sort') {
                const totalDuration = 12000;
                const spawnInterval = 2000 - difficulty * 300;
                const totalOrbs = Math.floor(totalDuration / spawnInterval);
                
                const { mean, std } = botProfile.reaction;
                const { star3Chance, star2Chance } = botProfile.precision;
                const accuracy = star3Chance + star2Chance * 0.7 + (1 - star3Chance - star2Chance) * 0.4;
                
                let correct = 0;
                for (let i = 0; i < totalOrbs; i++) {
                    const reactionTime = rng.nextGaussian(mean, std);
                    if (reactionTime < spawnInterval * 0.8) {
                        if (rng.nextFloat() < accuracy) correct++;
                    }
                }
                primaryMetric = correct;
                secondaryMetric = totalOrbs;
            } else if (event.id === 'flow-connect') {
                const { star3Chance, star2Chance } = botProfile.precision;
                const { mean, std } = botProfile.reaction;
                const gridSize = difficulty >= 3 ? 4 : 3;
                const baseTime = gridSize * gridSize * 2000;
                const thinkingTime = rng.nextGaussian(mean, std) * (gridSize * 3);
                let completionTime = baseTime + thinkingTime;
                completionTime *= rng.nextGaussian(1, 0.15);
                
                const solveChance = star3Chance + star2Chance * 0.5;
                if (rng.nextFloat() > solveChance) {
                    primaryMetric = 99999;
                } else {
                    primaryMetric = Math.max(3000, completionTime);
                }
            } else if (event.id === 'logic-gates') {
                const totalDuration = (12 + difficulty) * 1000;
                const { mean, std } = botProfile.reaction;
                const { star3Chance, star2Chance } = botProfile.precision;
                const accuracy = star3Chance + star2Chance * 0.7 + (1 - star3Chance - star2Chance) * 0.4;
                
                const avgTimePerQ = rng.nextGaussian(mean, std) * 2 + 1500;
                const totalQ = Math.floor(totalDuration / avgTimePerQ);
                
                let correct = 0;
                for (let i = 0; i < totalQ; i++) {
                    if (rng.nextFloat() < accuracy) correct++;
                }
                primaryMetric = correct;
                secondaryMetric = totalQ;
            } else {
                 // Fallback for other logic stubs
                const { star2Chance, star3Chance } = botProfile.precision;
                const roll = rng.nextFloat();
                if (roll < star3Chance) primaryMetric = 3;
                else if (roll < star3Chance + star2Chance) primaryMetric = 2;
                else primaryMetric = 1;
            }
            break;
        }
        default: {
            // Generic performance for any other stubs
            const { star2Chance, star3Chance } = botProfile.precision;
            const roll = rng.nextFloat();
            if (roll < star3Chance) primaryMetric = 3;
            else if (roll < star3Chance + star2Chance) primaryMetric = 2;
            else primaryMetric = 1;
        }
    }

    const result = { primaryMetric, secondaryMetric };
    const stars = event.getStars(result);
    
    // For stubbed events, the primaryMetric was the star rating itself
    if (event.isStub) {
        return { stars: primaryMetric as (1|2|3), primaryMetric: 0 };
    }

    return { stars, ...result };
}

export function simulateBotPerformance(
    bot: Player,
    event: BotEventInfo,
    difficulty: number,
    settings: GameSettings,
    rivalTraits?: RivalTraitId[],
): Omit<EventResult, 'playerId'> {
    if (!bot.personality) {
        return { stars: 1, primaryMetric: 0 };
    }
    let profile = BOT_PROFILES[bot.personality];
    if (bot.isRival && rivalTraits && rivalTraits.length > 0) {
        profile = applyRivalTraits(profile, rivalTraits, event.performanceDimension);
    }
    const rng = new SeededRNG(`bot-${bot.id}-tile-${event.id}-${settings.seed}`);
    return getBotResult(event, difficulty, profile, rng);
}

export function decideBotPowerUp(
    bot: Player,
    gameState: GameState,
    currentTile: Tile,
): { use: PowerUp; targetId: number; } | null {
    if (bot.powerUps.length === 0 || currentTile.modifier === 'STATIC_FIELD') return null;

    const rng = new SeededRNG(`powerup-${bot.id}-tile-${gameState.currentTileIndex}-${gameState.settings.seed}`);
    
    // Easy bot misfire chance
    if (bot.personality === BotPersonality.Easy && rng.nextFloat() < 0.1) {
        return null;
    }

    const playersSorted = [...gameState.players].sort((a, b) => b.position - a.position);
    const leader = playersSorted[0];
    const humanPlayer = gameState.players.find(p => !p.isBot)!;
    
    // Shield logic
    if (bot.powerUps.includes('Shield')) {
        if (leader.id === humanPlayer.id && (leader.position - bot.position) < (100 / gameState.settings.runLength)) {
            if (rng.nextFloat() < 0.6) {
                 return { use: 'Shield', targetId: bot.id };
            }
        }
    }

    // Overcharge: use when low on energy
    if (bot.powerUps.includes('Overcharge') && bot.energy < 3) {
        if (rng.nextFloat() < 0.5) {
            return { use: 'Overcharge', targetId: bot.id };
        }
    }

    // Reflector: use when behind and likely to be targeted
    if (bot.powerUps.includes('Reflector') && leader.id !== bot.id) {
        if (rng.nextFloat() < 0.3) {
            return { use: 'Reflector', targetId: bot.id };
        }
    }

    // Offensive logic — exclude self-buff/defensive power-ups
    const offensivePowerUp = bot.powerUps.find(p => p !== 'Shield' && p !== 'Clarity' && p !== 'Overcharge' && p !== 'Reflector');
    if (offensivePowerUp) {
        let targetId = leader.id;
        const distanceToHuman = Math.abs(bot.position - humanPlayer.position);
        if (distanceToHuman < (200 / gameState.settings.runLength) && rng.nextFloat() < 0.7) {
            targetId = humanPlayer.id;
        } else if (leader.id === bot.id && playersSorted.length > 1) {
            targetId = playersSorted[1].id;
        }

        // Adaptive Rival aggression (boosted by AggressivePowerups trait)
        let riskBias = bot.personality === BotPersonality.Intermediate ? 0.4 : 0.7;
        if (bot.isRival) {
            const humanRank = playersSorted.findIndex(p => p.id === humanPlayer.id);
            if (humanRank !== -1) {
                if (humanRank <= 1) {
                    riskBias = 0.85;
                } else if (humanRank >= playersSorted.length - 2) {
                    riskBias = 0.5;
                }
            }
        }
        
        if (rng.nextFloat() < riskBias) {
            return { use: offensivePowerUp, targetId: targetId };
        }
    }

    return null;
}

export function decideBotOverdrive(
    bot: Player,
    gameState: GameState,
): boolean {
    if (!bot.personality || bot.energy < 5 || bot.overdriveCooldown > 0) return false;
    const rng = new SeededRNG(`overdrive-${bot.id}-tile-${gameState.currentTileIndex}-${gameState.settings.seed}`);
    
    const playersSorted = [...gameState.players].sort((a, b) => b.position - a.position);
    const leader = playersSorted[0];
    
    // Don't use if already winning
    if (leader.id === bot.id) {
        return false;
    }

    // Intermediate bots are more aggressive
    if (bot.personality === BotPersonality.Intermediate) {
        const positionDifference = leader.position - bot.position;
        if (positionDifference > (100 / gameState.settings.runLength)) {
            return rng.nextFloat() < 0.75;
        }
        return rng.nextFloat() < 0.40;
    }
    
    // Easy bots are cautious
    if (bot.personality === BotPersonality.Easy) {
        const positionDifference = leader.position - bot.position;
        if (positionDifference > (200 / gameState.settings.runLength)) {
             return rng.nextFloat() < 0.30;
        }
        return false;
    }

    return false;
}
