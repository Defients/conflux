import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';

const BEAM_WIDTH = 400;
const BALL_RADIUS = 12;
const GRAVITY = 0.15;
const FALL_THRESHOLD = BEAM_WIDTH / 2 + 10;

export const BalanceBeam: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const [ballX, setBallX] = useState(0);
    const [beamAngle, setBeamAngle] = useState(0);
    const [timeBalanced, setTimeBalanced] = useState(0);
    const [isFallen, setIsFallen] = useState(false);
    const requestRef = useRef<number | null>(null);
    const startTimeRef = useRef(Date.now());
    const inputRef = useRef(0);

    const stateRef = useRef({
        ballX: 0,
        ballVx: 0,
        beamAngle: 0,
        beamAngularV: 0,
        perturbTimer: 0,
        perturbForce: 0,
        elapsed: 0,
    });

    const difficultyScale = tile.difficulty;
    const perturbStrength = 0.003 + difficultyScale * 0.002;
    const perturbInterval = Math.max(800, 2000 - difficultyScale * 400);
    const maxDuration = tile.difficulty === 1 ? 12000 : tile.difficulty === 2 ? 10000 : 8000;

    const handleFall = useCallback((elapsed: number) => {
        setIsFallen(true);
        setTimeBalanced(elapsed / 1000);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        setTimeout(() => {
            onComplete({ primaryMetric: elapsed / 1000 });
        }, 800);
    }, [onComplete]);

    const animate = useCallback(() => {
        const s = stateRef.current;
        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        s.elapsed = elapsed;

        if (elapsed >= maxDuration) {
            setTimeBalanced(maxDuration / 1000);
            setIsFallen(true);
            onComplete({ primaryMetric: maxDuration / 1000 });
            return;
        }

        s.perturbTimer += 16;
        if (s.perturbTimer > perturbInterval) {
            s.perturbTimer = 0;
            s.perturbForce = (Math.random() - 0.5) * perturbStrength * 2;
        }

        s.beamAngularV += s.perturbForce + inputRef.current * 0.0008;
        s.beamAngularV *= 0.95;
        s.beamAngle += s.beamAngularV;
        s.beamAngle = Math.max(-0.35, Math.min(0.35, s.beamAngle));

        const gravityComponent = Math.sin(s.beamAngle) * GRAVITY;
        s.ballVx += gravityComponent;
        s.ballVx *= 0.985;
        s.ballX += s.ballVx;

        if (Math.abs(s.ballX) > FALL_THRESHOLD) {
            handleFall(elapsed);
            return;
        }

        setBallX(s.ballX);
        setBeamAngle(s.beamAngle);
        setTimeBalanced(elapsed / 1000);

        requestRef.current = requestAnimationFrame(animate);
    }, [handleFall, maxDuration, onComplete, perturbInterval, perturbStrength]);

    useEffect(() => {
        if (isPaused) return;
        startTimeRef.current = Date.now();
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPaused, animate]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') inputRef.current = -1;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') inputRef.current = 1;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(e.code)) inputRef.current = 0;
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        const handleMove = (clientX: number) => {
            const centerX = window.innerWidth / 2;
            const delta = clientX - centerX;
            inputRef.current = Math.max(-1, Math.min(1, delta / 200));
        };
        const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) handleMove(e.touches[0].clientX);
        };
        const handleEnd = () => { inputRef.current = 0; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchend', handleEnd);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('mouseup', handleEnd);
            window.removeEventListener('touchend', handleEnd);
        };
    }, []);

    const beamRotateDeg = (beamAngle * 180) / Math.PI;
    const progressPct = Math.min(100, (timeBalanced / (maxDuration / 1000)) * 100);

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-xl font-bold text-galaxy-cyan mb-2">Keep the Ball Balanced!</h3>
            <p className="text-sm text-gray-400 mb-4">Use Arrow Keys / Mouse to tilt the beam</p>

            <div className="text-3xl font-mono font-black text-hyper-green mb-6">
                {timeBalanced.toFixed(1)}s
            </div>

            <div className="w-full max-w-lg h-2 bg-gray-800 rounded-full mb-8 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-galaxy-cyan to-hyper-green transition-all duration-100"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            <div className="relative" style={{ width: BEAM_WIDTH + 60, height: 120 }}>
                <div
                    className="absolute left-1/2 bottom-4"
                    style={{
                        width: BEAM_WIDTH,
                        height: 6,
                        marginLeft: -BEAM_WIDTH / 2,
                        backgroundColor: isFallen ? '#d64f8a' : '#00dffc',
                        borderRadius: 3,
                        transform: `rotate(${beamRotateDeg}deg)`,
                        transformOrigin: 'center center',
                        transition: isFallen ? 'background-color 0.3s' : 'none',
                        boxShadow: isFallen ? '0 0 20px #d64f8a' : '0 0 12px #00dffc66',
                    }}
                >
                    <div
                        className="absolute rounded-full"
                        style={{
                            width: BALL_RADIUS * 2,
                            height: BALL_RADIUS * 2,
                            backgroundColor: isFallen ? '#ff6b9d' : '#ffffff',
                            left: BEAM_WIDTH / 2 + ballX - BALL_RADIUS,
                            top: -BALL_RADIUS - 3,
                            boxShadow: isFallen ? '0 0 15px #d64f8a' : '0 0 10px rgba(255,255,255,0.5)',
                            transition: isFallen ? 'all 0.3s' : 'none',
                        }}
                    />
                </div>

                <div
                    className="absolute left-1/2 bottom-0"
                    style={{
                        width: 0,
                        height: 0,
                        borderLeft: '10px solid transparent',
                        borderRight: '10px solid transparent',
                        borderBottom: '16px solid #6b21a8',
                        marginLeft: -10,
                    }}
                />
            </div>

            {isFallen && (
                <div className="mt-6 text-2xl font-bold animate-fade-in">
                    {timeBalanced >= maxDuration / 1000 ? (
                        <span className="text-hyper-green">Perfect Balance!</span>
                    ) : (
                        <span className="text-nebula-pink">Fell at {timeBalanced.toFixed(2)}s</span>
                    )}
                </div>
            )}
        </div>
    );
};
