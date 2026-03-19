import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';

type Status = 'ready' | 'aiming' | 'shooting' | 'goal' | 'miss';
type Vector = { x: number; y: number };

const GRAVITY = 0.2;
const FRICTION = 0.99;
const MAX_POWER = 15;

export const AimFlick: React.FC<EventProps> = ({ onComplete, tile, event, settings, isBlurred, isPaused }) => {
    const gameAreaRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const isDoneRef = useRef(false);

    const [status, setStatus] = useState<Status>('ready');
    const [attempts, setAttempts] = useState(2);
    const [projectile, setProjectile] = useState<Vector>({ x: 50, y: 380 });
    const [velocity, setVelocity] = useState<Vector>({ x: 0, y: 0 });
    const [aim, setAim] = useState<{ start: Vector; end: Vector } | null>(null);

    const goal = { x: 700, y: 350, width: 80 - tile.difficulty * 10, height: 50 };

    const finishEvent = useCallback((scoredAttempt: number) => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setStatus(scoredAttempt > 0 ? 'goal' : 'miss');
        onComplete({ primaryMetric: scoredAttempt });
    }, [onComplete]);

    const resetProjectile = () => {
        setProjectile({ x: 50, y: 380 });
        setVelocity({ x: 0, y: 0 });
        setStatus('ready');
    };

    const gameLoop = useCallback(() => {
        if (status !== 'shooting' || !gameAreaRef.current) return;

        const { width, height } = gameAreaRef.current.getBoundingClientRect();
        let newPos = { ...projectile };
        let newVel = { ...velocity };

        newVel.y += GRAVITY;
        newVel.x *= FRICTION;
        newVel.y *= FRICTION;

        newPos.x += newVel.x;
        newPos.y += newVel.y;

        if (newPos.x < 10 || newPos.x > width - 10) newVel.x *= -1;
        if (newPos.y < 10 || newPos.y > height - 10) newVel.y *= -0.8;
        
        setProjectile(newPos);
        setVelocity(newVel);
        
        if (newPos.x > goal.x && newPos.x < goal.x + goal.width && newPos.y > goal.y && newPos.y < goal.y + goal.height) {
            finishEvent(3 - attempts); 
            return;
        }

        if (Math.abs(newVel.x) < 0.1 && Math.abs(newVel.y) < 0.1 && newPos.y > 370) {
            if (attempts > 1) {
                setAttempts(a => a - 1);
                setStatus('miss');
                setTimeout(resetProjectile, 1000);
            } else {
                finishEvent(0);
            }
            return;
        }

        animationFrameRef.current = requestAnimationFrame(gameLoop);
    }, [status, projectile, velocity, attempts, goal, finishEvent]);
    
    useEffect(() => {
        if (isPaused) return;
        if (status === 'shooting') {
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        }
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, [isPaused, status, gameLoop]);
    
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!isDoneRef.current) {
                finishEvent(0);
            }
        }, event.durationSec(tile.difficulty, settings.accessibility) * 1000);
        return () => clearTimeout(timeout);
    }, [event, tile.difficulty, settings.accessibility, finishEvent]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (status !== 'ready') return;
        setStatus('aiming');
        setAim({ start: { x: e.clientX, y: e.clientY }, end: { x: e.clientX, y: e.clientY } });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (status !== 'aiming' || !aim) return;
        setAim({ ...aim, end: { x: e.clientX, y: e.clientY } });
    };

    const handleMouseUp = () => {
        if (status !== 'aiming' || !aim) return;
        
        const dx = aim.start.x - aim.end.x;
        const dy = aim.start.y - aim.end.y;
        
        const power = Math.min(Math.sqrt(dx*dx + dy*dy) / 10, MAX_POWER);
        const angle = Math.atan2(dy, dx);

        setVelocity({ x: Math.cos(angle) * power, y: Math.sin(angle) * power });
        setAim(null);
        setStatus('shooting');
    };
    
    const getStatusMessage = () => {
        if (status === 'goal') return 'GOAL!';
        if (status === 'miss') return 'Miss! Try again.';
        if (isDoneRef.current) return 'Out of time!';
        return `Attempts left: ${attempts}`;
    }

    const aimVector = aim ? { dx: aim.end.x - aim.start.x, dy: aim.end.y - aim.start.y } : null;
    
    // Calculate color based on power
    const getAimColor = () => {
        if (!aimVector) return '#00dffc';
        const dist = Math.sqrt(aimVector.dx*aimVector.dx + aimVector.dy*aimVector.dy);
        const powerRatio = Math.min(dist / 150, 1); // approx max pull
        // Interpolate between Cyan (safe) and Pink (max power)
        return powerRatio > 0.8 ? '#d64f8a' : powerRatio > 0.5 ? '#ffae42' : '#00dffc';
    };

    return (
        <div 
            className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none overflow-hidden ${isBlurred ? 'filter blur-md' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div className="absolute top-4 text-center z-10">
                <h3 className="text-2xl font-bold text-galaxy-cyan">Aim Flick!</h3>
                <p className="font-mono text-lg">{getStatusMessage()}</p>
            </div>
            <div ref={gameAreaRef} className="w-full h-full max-w-4xl max-h-[400px] bg-gray-900/50 rounded-lg relative cursor-crosshair overflow-hidden border border-white/10 shadow-inner">
                {/* Ground */}
                <div className="absolute bottom-0 left-0 w-full h-5 bg-star-purple/50 border-t border-star-purple" />
                {/* Goal */}
                <div style={{ position: 'absolute', left: goal.x, top: goal.y, width: goal.width, height: goal.height, backgroundColor: '#4dffaf', boxShadow: '0 0 15px #4dffaf' }} />
                
                {/* Aiming Line */}
                {aim && (
                    <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none">
                        <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                              <polygon points="0 0, 10 3.5, 0 7" fill={getAimColor()} />
                            </marker>
                        </defs>
                        <line 
                            x1={projectile.x} 
                            y1={projectile.y} 
                            x2={projectile.x - (aimVector?.dx ?? 0)} 
                            y2={projectile.y - (aimVector?.dy ?? 0)} 
                            stroke={getAimColor()} 
                            strokeWidth="3" 
                            strokeDasharray="5,5"
                            markerEnd="url(#arrowhead)"
                            opacity="0.8"
                        />
                    </svg>
                )}

                {/* Projectile */}
                <div className="w-5 h-5 bg-nebula-pink rounded-full shadow-[0_0_10px_#d64f8a]" style={{ position: 'absolute', transform: `translate(${projectile.x - 10}px, ${projectile.y - 10}px)` }} />
            </div>
        </div>
    );
};
