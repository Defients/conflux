
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';
import { TYPING_GLITCH_WORDS } from '../constants';

type Word = { text: string; isCorrupted: boolean };

const generateWordList = (rng: SeededRNG, difficulty: number): Word[] => {
    const list: Word[] = [];
    const numWords = 8 + difficulty * 2; // 10, 12, 14 words
    const corruptionChance = 0.2 + difficulty * 0.1; // 30%, 40%, 50%

    for (let i = 0; i < numWords; i++) {
        const isCorrupted = rng.nextFloat() < corruptionChance;
        if (isCorrupted) {
            const word = TYPING_GLITCH_WORDS.corrupted[rng.nextInt(0, TYPING_GLITCH_WORDS.corrupted.length)];
            list.push({ text: word, isCorrupted: true });
        } else {
            const word = TYPING_GLITCH_WORDS.valid[rng.nextInt(0, TYPING_GLITCH_WORDS.valid.length)];
            list.push({ text: word, isCorrupted: false });
        }
    }
    return list;
};

export const SystemPurge: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const wordList = useMemo(() => {
        const rng = new SeededRNG(`systempurge-${settings.seed}-${tile.tileIndex}`);
        return generateWordList(rng, tile.difficulty);
    }, [settings.seed, tile.tileIndex, tile.difficulty]);
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userInput, setUserInput] = useState('');
    const [score, setScore] = useState(0);
    const scoreRef = useRef(0);
    const isDoneRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: scoreRef.current, secondaryMetric: wordList.filter(w => !w.isCorrupted).length });
    }, [onComplete, wordList]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(finishEvent, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    useEffect(() => {
        inputRef.current?.focus();
    }, [currentIndex]);

    const advanceWord = (points: number) => {
        scoreRef.current += points;
        setScore(scoreRef.current);
        setUserInput('');
        if (currentIndex + 1 >= wordList.length) {
            finishEvent();
        } else {
            setCurrentIndex(i => i + 1);
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const currentWord = wordList[currentIndex];
        if (currentWord.isCorrupted) {
             advanceWord(-2); // Penalty for typing a corrupted word
        } else {
            if (userInput === currentWord.text) {
                advanceWord(1);
            } else {
                 advanceWord(-1); // Penalty for typo
            }
        }
    };
    
    const handleSkip = () => {
        const currentWord = wordList[currentIndex];
        if (currentWord.isCorrupted) {
            advanceWord(1); // Correctly skipped
        } else {
            advanceWord(-1); // Skipped a valid word
        }
    };

    const currentWord = wordList[currentIndex];
    
    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
             <div className="absolute top-4 text-center z-10">
                 <h3 className="text-2xl font-bold text-galaxy-cyan">System Purge</h3>
                 <p className="font-mono text-xl">Score: {score}</p>
            </div>
            <div className="w-full max-w-lg text-center">
                <div className="relative h-24 mb-4 glass-panel p-4 flex items-center justify-center">
                    <p className={`text-5xl font-mono tracking-widest ${currentWord?.isCorrupted ? 'glitch' : ''}`} data-text={currentWord?.text}>
                        {currentWord?.text}
                    </p>
                </div>
                <form onSubmit={handleSubmit}>
                     <input
                        ref={inputRef}
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value.toUpperCase())}
                        disabled={isDoneRef.current || currentWord?.isCorrupted}
                        className="w-full p-4 text-center text-3xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan disabled:opacity-50"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                    />
                </form>
                 <button onClick={handleSkip} disabled={isDoneRef.current} className="mt-4 w-full p-3 bg-solar-orange text-cosmic-blue font-bold text-lg rounded-lg hover:opacity-90 transition-opacity">
                    SKIP (Spacebar)
                </button>
            </div>
             <style>{`
                .glitch {
                    animation: glitch 1s linear infinite;
                }
                @keyframes glitch {
                    2%, 64% { transform: translate(2px, 0) skew(0deg); }
                    4%, 60% { transform: translate(-2px, 0) skew(0deg); }
                    62% { transform: translate(0, 0) skew(5deg); }
                }
                .glitch:before, .glitch:after {
                    content: attr(data-text);
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                }
                .glitch:before {
                    left: 2px;
                    text-shadow: -2px 0 #d64f8a;
                    clip: rect(44px, 450px, 56px, 0);
                    animation: glitch 2s infinite linear alternate-reverse;
                }
                 .glitch:after {
                    left: -2px;
                    text-shadow: -2px 0 #00dffc, 2px 2px #d64f8a;
                    clip: rect(85px, 450px, 90px, 0);
                    animation: glitch 3s infinite linear alternate-reverse;
                }
            `}</style>
        </div>
    );
};
