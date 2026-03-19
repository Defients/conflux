import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type Vector = { x: number; y: number };
type Status = 'ready' | 'shooting' | 'waiting' | 'feedback';

const GRAVITY = 0.15;
const GROUND_Y = 380;
const HIDE_TIME = 350; // ms

export const GhostTrajectory: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isDoneRef = useRef(false);
    
    const [status, setStatus] = useState<Status>('ready');
    const [round, setRound] = useState(0);
    const [errors, setErrors] = useState<number[]>([]);
    const errorsRef = useRef<number[]>([]);
    
    // Use refs for physics to avoid closure stale state issues
    const projectileRef = useRef<Vector>({ x: 50, y: GROUND_Y });
    const velocityRef = useRef<Vector>({ x: 0, y: 0 });
    
    const [projectileState, setProjectileState] = useState<Vector>({ x: 50, y: GROUND_Y });
    const [showGhost, setShowGhost] = useState(true);
    
    const [guess, setGuess] = useState<Vector | null>(null);
    const [actualLanding, setActualLanding] = useState<Vector | null>(null);
    
    const rng = useRef(new SeededRNG(`ghost-${settings.seed}-${tile.tileIndex}`));

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        const currentErrors = errorsRef.current;
        const avgError = currentErrors.length > 0 ? currentErrors.reduce((a, b) => a + b, 0) / currentErrors.length : 999;
        onComplete({ primaryMetric: avgError });
    }, [onComplete]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(() => {
            if (!isDoneRef.current) {
                finishEvent();
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    const startRound = useCallback(() => {
        if (round >= 2) {
            finishEvent();
            return;
        }
        
        setGuess(null);
        setActualLanding(null);
        
        projectileRef.current = { x: 50, y: GROUND_Y };
        setProjectileState({ x: 50, y: GROUND_Y });
        setShowGhost(true);
        
        const power = rng.current.nextFloat() * 8 + 10; // 10-18
        const angle = -(Math.PI / 4) - rng.current.nextFloat() * (Math.PI / 4); // -45 to -90 deg
        const wind = (rng.current.nextFloat() - 0.5) * 0.05 * tile.difficulty;

        velocityRef.current = { x: Math.cos(angle) * power, y: Math.sin(angle) * power + wind };
        setStatus('shooting');

        setTimeout(() => setShowGhost(false), HIDE_TIME);

    }, [round, tile.difficulty, finishEvent]);
    
    useEffect(() => {
        const timeout = setTimeout(startRound, 1000);
        return () => clearTimeout(timeout);
    }, [round, startRound]);

    const gameLoop = useCallback(() => {
        let newPos = { ...projectileRef.current };
        let newVel = { ...velocityRef.current };

        newVel.y += GRAVITY;
        newPos.x += newVel.x;
        newPos.y += newVel.y;
        
        projectileRef.current = newPos;
        velocityRef.current = newVel;
        setProjectileState(newPos);
        
        if (newPos.y >= GROUND_Y) {
            setStatus('waiting');
            setActualLanding(newPos);
        } else {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        }
    }, []);

    useEffect(() => {
        if (isPaused) return;
        if (status === 'shooting') {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPaused, status, gameLoop]);

    const handleGuess = (e: React.MouseEvent) => {
        if (status !== 'shooting' && status !== 'waiting') return;
        if (guess) return;

        const rect = gameAreaRef.current!.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        setGuess({ x: clickX, y: GROUND_Y });
    };
    
    // Handle case where user guesses after landing or it lands after guess
    useEffect(() => {
        if (guess && actualLanding && status !== 'feedback') {
             setStatus('feedback');
             const error = Math.abs(guess.x - actualLanding.x);
             const newErrors = [...errorsRef.current, error];
             errorsRef.current = newErrors;
             setErrors(newErrors);
             setTimeout(() => setRound(r => r + 1), 2000);
        }
    }, [guess, actualLanding, status]);


    return (
        <div 
            className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none overflow-hidden ${isBlurred ? 'filter blur-md' : ''}`}
        >
            <div className="absolute top-4 text-center z-10">
                <h3 className="text-2xl font-bold text-galaxy-cyan">Ghost Trajectory</h3>
                <p className="font-mono text-lg">Round {Math.min(2, round + 1)} of 2. Click where it will land!</p>
            </div>
            <div 
                ref={gameAreaRef} 
                className="w-full h-full max-w-4xl max-h-[400px] bg-gray-900/50 rounded-lg relative cursor-crosshair"
                onClick={handleGuess}
            >
                {/* Ground */}
                <div className="absolute left-0 w-full bg-star-purple/50" style={{ top: GROUND_Y, height: '20px' }} />
                
                {/* Projectile */}
                {showGhost && status === 'shooting' &&
                    <div className="w-5 h-5 bg-solar-orange rounded-full" style={{ position: 'absolute', transform: `translate(${projectileState.x - 10}px, ${projectileState.y - 10}px)` }} />
                }

                {/* Guess and Feedback */}
                {status === 'feedback' && (
                    <>
                        {guess && <div className="absolute w-1 h-8 bg-galaxy-cyan" style={{ top: GROUND_Y - 32, transform: `translateX(${guess.x}px)` }}><div className="text-center text-galaxy-cyan -mt-5">YOU</div></div>}
                        {actualLanding && <div className="absolute w-1 h-8 bg-hyper-green" style={{ top: GROUND_Y - 32, transform: `translateX(${actualLanding.x}px)` }}><div className="text-center text-hyper-green -mt-5">✓</div></div>}
                        <p className="absolute text-2xl font-bold text-white text-center w-full" style={{ top: '45%' }}>Error: {errors[errors.length - 1]?.toFixed(0)}px</p>
                    </>
                )}
            </div>
        </div>
    );
};
