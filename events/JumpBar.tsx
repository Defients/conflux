import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';

const JUMP_VELOCITY = 20;
const GRAVITY = 1.2;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 40;
const BAR_WIDTH = 20;
const BAR_HEIGHT = 60;

type GameStatus = 'ready' | 'playing' | 'hit' | 'cleared' | 'done';

export const JumpBar: React.FC<EventProps> = ({ onComplete, tile, event, settings, isBlurred , isPaused }) => {
    const [status, setStatus] = useState<GameStatus>('ready');
    const [playerY, setPlayerY] = useState(0);
    const [barX, setBarX] = useState(window.innerWidth);
    const [jumps, setJumps] = useState({ successful: 0, total: 0 });

    const totalRounds = 2 + tile.difficulty;
    const barSpeed = 4 + tile.difficulty * 2;

    const gameLoopRef = useRef<number | null>(null);
    const playerState = useRef({ y: 0, vy: 0, isJumping: false });
    const barState = useRef({ x: window.innerWidth });
    const isDoneRef = useRef(false);
    
    // Add a master unmount cleanup effect
    useEffect(() => {
        return () => {
            isDoneRef.current = true;
            if (gameLoopRef.current) {
                cancelAnimationFrame(gameLoopRef.current);
            }
        }
    }, []);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
        }
        setStatus('done');
        onComplete({ primaryMetric: jumps.successful, secondaryMetric: totalRounds });
    }, [onComplete, totalRounds, jumps.successful]);

    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings?.accessibility ?? false) * 1000;
        const timer = setTimeout(finishEvent, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings, finishEvent, isPaused]);

    const resetRound = useCallback(() => {
        if (isDoneRef.current) return;
        playerState.current = { y: 0, vy: 0, isJumping: false };
        setPlayerY(0);
        const startX = window.innerWidth + Math.random() * 200;
        barState.current = { x: startX };
        setBarX(startX);
        setStatus('playing');
    }, []);

    const gameLoop = useCallback(() => {
        if (isDoneRef.current) return;

        // Player physics
        if (playerState.current.isJumping) {
            playerState.current.y += playerState.current.vy;
            playerState.current.vy -= GRAVITY;
            if (playerState.current.y < 0) {
                playerState.current.y = 0;
                playerState.current.isJumping = false;
            }
            setPlayerY(playerState.current.y);
        }

        // Bar movement
        barState.current.x -= barSpeed;
        setBarX(barState.current.x);

        // Collision detection
        const playerLeft = 50;
        const playerRight = playerLeft + PLAYER_WIDTH;
        const barLeft = barState.current.x;
        const barRight = barLeft + BAR_WIDTH;

        if (barRight > playerLeft && barLeft < playerRight) {
            const playerBottom = playerState.current.y;
            if (playerBottom < BAR_HEIGHT) { // Hit
                setStatus('hit');
                setJumps(j => ({ ...j, total: j.total + 1 }));
                return;
            }
        }
        
        // Bar passed
        if (barState.current.x < -BAR_WIDTH) {
            setStatus('cleared');
            setJumps(j => ({ successful: j.successful + 1, total: j.total + 1 }));
            return;
        }
        
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [barSpeed]);

    useEffect(() => {
        if (isPaused) return;
        if (status === 'playing') {
            gameLoopRef.current = requestAnimationFrame(gameLoop);
        } else if (gameLoopRef.current) {
            cancelAnimationFrame(gameLoopRef.current);
            if (status === 'hit' || status === 'cleared') {
                if (jumps.total >= totalRounds) {
                    finishEvent();
                } else {
                    setTimeout(() => {
                        if (!isDoneRef.current) resetRound();
                    }, 800);
                }
            }
        }
        return () => {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        };
    }, [isPaused, status, gameLoop, jumps.total, totalRounds, finishEvent, resetRound]);
    
    useEffect(() => {
        const timeoutId = setTimeout(resetRound, 1000);
        return () => clearTimeout(timeoutId);
    }, [resetRound]);
    
    const handleJump = useCallback(() => {
        if (status === 'playing' && !playerState.current.isJumping) {
            playerState.current.isJumping = true;
            playerState.current.vy = JUMP_VELOCITY;
        }
    }, [status]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                handleJump();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleJump]);
    
    const getStatusMessage = () => {
        switch(status) {
            case 'ready': return 'Get Ready!';
            case 'playing': return 'Jump!';
            case 'hit': return 'Hit!';
            case 'cleared': return 'Cleared!';
            case 'done': return `Finished!`;
        }
    };

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none overflow-hidden ${isBlurred ? 'filter blur-md' : ''}`} onClick={handleJump}>
            <div className="absolute top-4 text-center z-10">
                 <h3 className="text-2xl font-bold text-galaxy-cyan">Time Your Jumps!</h3>
                 <p className="text-xl font-bold" style={{color: status === 'hit' ? '#d64f8a' : status === 'cleared' ? '#4dffaf' : '#e0e0e0'}}>{getStatusMessage()}</p>
                 <p className="font-mono">Score: {jumps.successful} / {totalRounds}</p>
            </div>
            
            <div className="w-full h-1/2 relative">
                {/* Ground */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-star-purple" />
                
                {/* Player */}
                <div className="absolute bottom-0" style={{ left: 50, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, transform: `translateY(-${playerY}px)`, backgroundColor: '#00dffc', borderRadius: '4px' }}/>
                
                {/* Bar */}
                {(status === 'playing' || status === 'hit') && <div className="absolute bottom-0" style={{ left: barX, width: BAR_WIDTH, height: BAR_HEIGHT, backgroundColor: '#d64f8a' }} />}
            </div>
        </div>
    );
};
