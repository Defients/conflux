import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

const EMOJI_POOL = ['🚀', '🌟', '🛰️', '🪐', '☄️', '❤️', '💎', '💡', '🔑', '⚙️', '⚡️', '☀️', '🌙', '🌊', '🔥'];
const WORD_POOL = ["CODE", "RACE", "STAR", "BEAM", "TIME", "DATA", "LINK", "NODE"];

const generateCipher = (rng: SeededRNG, word: string): { cipher: Map<string, string>, legend: Map<string, string> } => {
    const letters = Array.from(new Set(word.split('')));
    const shuffledEmojis = rng.shuffle([...EMOJI_POOL]);
    const cipher = new Map<string, string>();
    letters.forEach((letter, i) => {
        cipher.set(letter, shuffledEmojis[i]);
    });
    
    // Create a legend (a subset of the cipher)
    rng.shuffle(letters);
    const legendSize = Math.max(1, Math.floor(letters.length / 2)); // Reveal about half
    const legend = new Map<string, string>();
    for(let i=0; i<legendSize; i++) {
        const letter = letters[i];
        legend.set(letter, cipher.get(letter)!);
    }

    return { cipher, legend };
};

export const EmojiCipher: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const { secretWord, cipher, legend } = useMemo(() => {
        const rng = new SeededRNG(`cipher-${settings.seed}-${tile.tileIndex}`);
        const word = WORD_POOL[rng.nextInt(0, WORD_POOL.length)];
        const { cipher, legend } = generateCipher(rng, word);
        return { secretWord: word, cipher, legend };
    }, [settings.seed, tile.tileIndex]);
    
    const [userInput, setUserInput] = useState('');
    const userInputRef = useRef('');
    const [isDone, setIsDone] = useState(false);
    const isDoneRef = useRef(false);
    const startTimeRef = useRef(performance.now());
    const inputRef = useRef<HTMLInputElement>(null);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setIsDone(true);
        const currentInput = userInputRef.current;
        const timeTakenMs = performance.now() - startTimeRef.current;
        let correctCount = 0;
        for(let i=0; i < secretWord.length; i++) {
            if(i < currentInput.length && currentInput[i] === secretWord[i]) {
                correctCount++;
            }
        }
        const accuracy = correctCount / secretWord.length;
        onComplete({ primaryMetric: accuracy * 100, secondaryMetric: timeTakenMs });
    }, [onComplete, secretWord]);
    
    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(finishEvent, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isDoneRef.current) return;
        const newText = e.target.value.toUpperCase();
        userInputRef.current = newText;
        setUserInput(newText);
        if (newText === secretWord) {
            finishEvent();
        }
    };
    
    const encodedWord = secretWord.split('').map(char => cipher.get(char)).join('');

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">Decode the Emoji Cipher!</h3>
            
            <div className="mb-4 glass-panel p-4 rounded-lg">
                <p className="text-lg font-semibold mb-2 text-center text-gray-300">Legend</p>
                <div className="flex justify-center space-x-4">
                    {Array.from(legend.entries()).map(([letter, emoji]) => (
                        <div key={letter} className="text-center font-mono">
                            <span className="text-3xl">{emoji}</span>
                            <p className="text-xl text-hyper-green">{letter}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-6 text-center">
                <p className="text-5xl tracking-[0.2em]">{encodedWord}</p>
            </div>
            
            <input
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={handleChange}
                maxLength={secretWord.length}
                disabled={isDone}
                className="w-full max-w-sm p-4 text-center text-3xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan tracking-[0.2em]"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
            />
            {isDone && <p className="mt-4 text-2xl font-bold text-hyper-green animate-fade-in">{userInput === secretWord ? "Decoded!" : "Time's up!"}</p>}
        </div>
    );
};
