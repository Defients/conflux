import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type Problem = {
    text: string;
    answer: number;
};

const generateProblem = (rng: SeededRNG, difficulty: number): Problem => {
    const d1 = rng.nextInt(5, 20);
    const d2 = rng.nextInt(5, 20);
    const d3 = rng.nextInt(2, 9);
    const d4 = rng.nextInt(2, 9);

    if (difficulty === 1) {
        if (rng.nextFloat() > 0.5) {
            return { text: `${d1} + ${d2}`, answer: d1 + d2 };
        } else {
            const [max, min] = [Math.max(d1, d2), Math.min(d1, d2)];
            return { text: `${max} - ${min}`, answer: max - min };
        }
    } else if (difficulty === 2) {
        const type = rng.nextInt(0, 3);
        if (type === 0) {
            return { text: `${d1} + ${d2}`, answer: d1 + d2 };
        } else if (type === 1) {
            const [max, min] = [Math.max(d1, d2), Math.min(d1, d2)];
            return { text: `${max} - ${min}`, answer: max - min };
        } else {
            return { text: `${d3} × ${d4}`, answer: d3 * d4 };
        }
    } else { // difficulty 3
        const type = rng.nextInt(0, 2);
         if (type === 0) {
            return { text: `${d1} + ${d3} × ${d4}`, answer: d1 + (d3*d4) };
        } else {
            const mult = d3 * d4;
            return { text: `${mult} ÷ ${d3}`, answer: d4 };
        }
    }
};


export const QuickMath: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const rng = useMemo(() => new SeededRNG(`quickmath-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
    
    const [problem, setProblem] = useState<Problem>(() => generateProblem(rng, tile.difficulty));
    const [answer, setAnswer] = useState('');
    const [score, setScore] = useState(0);
    const scoreRef = useRef(0);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isDoneRef = useRef(false);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        onComplete({ primaryMetric: scoreRef.current });
    }, [onComplete]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(finishEvent, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);
    
    useEffect(() => {
        inputRef.current?.focus();
    }, [problem]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isDoneRef.current) return;

        const userAnswer = parseInt(answer, 10);
        if (userAnswer === problem.answer) {
            scoreRef.current += 1;
            setScore(scoreRef.current);
            setFeedback('correct');
        } else {
            setFeedback('incorrect');
        }
        
        setAnswer('');
        setProblem(generateProblem(rng, tile.difficulty));
        
        setTimeout(() => setFeedback(null), 300);
    };
    
    const getFeedbackColor = () => {
        if (feedback === 'correct') return 'bg-hyper-green/30 border-hyper-green';
        if (feedback === 'incorrect') return 'bg-nebula-pink/30 border-nebula-pink';
        return 'border-star-purple';
    }

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <div className="absolute top-4 text-center z-10">
                 <h3 className="text-2xl font-bold text-galaxy-cyan">Quick Math!</h3>
                 <p className="font-mono text-xl">Score: {score}</p>
            </div>
            
            <div className="text-center">
                <div className={`p-8 rounded-lg border-2 transition-colors duration-200 ${getFeedbackColor()}`}>
                    <p className="text-6xl font-black text-white font-mono tracking-wider">{problem.text}</p>
                </div>
                
                <form onSubmit={handleSubmit} className="mt-6">
                    <input
                        ref={inputRef}
                        type="number"
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        className="w-full max-w-xs p-4 text-center text-3xl font-mono bg-gray-900/50 border-2 border-star-purple rounded-lg text-galaxy-cyan focus:outline-none focus:ring-2 focus:ring-galaxy-cyan"
                        autoComplete="off"
                    />
                </form>
            </div>
        </div>
    );
};
