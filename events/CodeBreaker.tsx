import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type Guess = {
    code: number[];
    feedback: {
        correctPosition: number;
        correctNumber: number;
    };
};

const generateCode = (rng: SeededRNG, difficulty: number): number[] => {
    const codeLength = 3 + Math.floor(difficulty / 2); // 3 for diff 1,2; 4 for diff 3
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    rng.shuffle(digits);
    return digits.slice(0, codeLength);
};

export const CodeBreaker: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const { secretCode, maxGuesses } = useMemo(() => {
        const rng = new SeededRNG(`codebreaker-${settings.seed}-${tile.tileIndex}`);
        const code = generateCode(rng, tile.difficulty);
        return { secretCode: code, maxGuesses: 10 };
    }, [settings.seed, tile.tileIndex, tile.difficulty]);

    const [guesses, setGuesses] = useState<Guess[]>([]);
    const guessesRef = useRef<Guess[]>([]);
    const [currentGuess, setCurrentGuess] = useState<number[]>([]);
    const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
    const isDoneRef = useRef(false);

    const finishEvent = useCallback((finalGuesses: Guess[], finalStatus: 'won' | 'lost') => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setStatus(finalStatus);
        onComplete({ primaryMetric: finalStatus === 'won' ? finalGuesses.length : 99 });
    }, [onComplete]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => {
            if (!isDoneRef.current) {
                finishEvent(guessesRef.current, 'lost');
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    const handleNumberClick = (num: number) => {
        if (status !== 'playing' || currentGuess.length >= secretCode.length || isDoneRef.current) return;
        setCurrentGuess(g => [...g, num]);
    };
    
    const handleBackspace = () => {
        if (status !== 'playing' || isDoneRef.current) return;
        setCurrentGuess(g => g.slice(0, -1));
    };

    const handleSubmit = useCallback(() => {
        if (status !== 'playing' || currentGuess.length !== secretCode.length || isDoneRef.current) return;

        let correctPosition = 0;
        let correctNumber = 0;
        const secretCopy = [...secretCode];
        const guessCopy = [...currentGuess];

        // First pass: check for correct position
        for (let i = guessCopy.length - 1; i >= 0; i--) {
            if (guessCopy[i] === secretCopy[i]) {
                correctPosition++;
                secretCopy.splice(i, 1);
                guessCopy.splice(i, 1);
            }
        }
        
        // Second pass: check for correct number in wrong position
        for (let i = 0; i < guessCopy.length; i++) {
            const indexInSecret = secretCopy.indexOf(guessCopy[i]);
            if (indexInSecret !== -1) {
                correctNumber++;
                secretCopy.splice(indexInSecret, 1);
            }
        }
        
        const newGuess: Guess = { code: currentGuess, feedback: { correctPosition, correctNumber } };
        const newGuesses = [...guessesRef.current, newGuess];
        guessesRef.current = newGuesses;
        setGuesses(newGuesses);
        setCurrentGuess([]);

        if (correctPosition === secretCode.length) {
            finishEvent(newGuesses, 'won');
        } else if (newGuesses.length >= maxGuesses) {
            finishEvent(newGuesses, 'lost');
        }

    }, [currentGuess, secretCode, maxGuesses, finishEvent]);
    
    const renderFeedback = (feedback: Guess['feedback']) => (
        <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
                 {Array(feedback.correctPosition).fill(0).map((_, i) => <div key={i} className="w-4 h-4 rounded-full bg-hyper-green" title="Correct Digit & Position"></div>)}
            </div>
             <div className="flex items-center space-x-1">
                {Array(feedback.correctNumber).fill(0).map((_, i) => <div key={i} className="w-4 h-4 rounded-full bg-solar-orange" title="Correct Digit, Wrong Position"></div>)}
            </div>
        </div>
    );
    
    const getStatusMessage = () => {
        switch(status) {
            case 'playing': return `Crack the ${secretCode.length}-digit code!`;
            case 'won': return 'Code Cracked!';
            case 'lost': return 'Out of attempts!';
        }
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-2">{getStatusMessage()}</h3>
            <p className="mb-4 text-gray-400">Guess {guesses.length + 1} of {maxGuesses}</p>

            <div className="w-full max-w-md bg-gray-900/50 p-4 rounded-lg space-y-2 mb-4 h-64 overflow-y-auto">
                {guesses.map((g, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-cosmic-blue/50 rounded">
                        <div className="flex space-x-2 font-mono text-2xl">
                            {g.code.map((digit, j) => <span key={j}>{digit}</span>)}
                        </div>
                        {renderFeedback(g.feedback)}
                    </div>
                ))}
            </div>

            <div className="mb-4 h-12 flex items-center justify-center space-x-3 bg-cosmic-blue border-2 border-star-purple p-2 rounded-lg w-full max-w-md">
                {currentGuess.map((digit, i) => <span key={i} className="text-3xl font-mono">{digit}</span>)}
                {Array(secretCode.length - currentGuess.length).fill(0).map((_, i) => <span key={i} className="text-3xl font-mono text-gray-600">_</span>)}
            </div>
            
            <div className="grid grid-cols-5 gap-2 w-full max-w-md">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                    <button key={num} onClick={() => handleNumberClick(num)} disabled={status !== 'playing'} className="p-3 text-2xl font-bold bg-star-purple rounded-lg hover:bg-nebula-pink disabled:opacity-50 transition-colors">
                        {num}
                    </button>
                ))}
                 <button onClick={handleBackspace} disabled={status !== 'playing'} className="col-span-2 p-3 text-xl font-bold bg-gray-600 rounded-lg hover:bg-gray-500 disabled:opacity-50 transition-colors">
                    DEL
                </button>
                <button onClick={handleSubmit} disabled={status !== 'playing' || currentGuess.length !== secretCode.length} className="col-span-3 p-3 text-xl font-bold bg-hyper-green text-cosmic-blue rounded-lg hover:opacity-80 disabled:opacity-50 transition-colors">
                    SUBMIT
                </button>
            </div>
             {status === 'lost' && <p className="mt-4 text-xl font-bold">The code was: <span className="text-solar-orange font-mono">{secretCode.join('')}</span></p>}
        </div>
    );
};
