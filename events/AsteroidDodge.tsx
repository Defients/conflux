import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';

type GameObject = {
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
};

const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 20;
const GAME_DURATION = 12000; // 12 seconds

export const AsteroidDodge: React.FC<EventProps> = ({ onComplete, tile, isBlurred, event, settings, isPaused }) => {
    const [playerX, setPlayerX] = useState(50); // percentage
    const [asteroids, setAsteroids] = useState<GameObject[]>([]);
    const [hits, setHits] = useState(0);
    const hitsRef = useRef(0);
    const [isGameOver, setIsGameOver] = useState(false);

    const gameAreaRef = useRef<HTMLDivElement>(null);
    const gameLoopRef = useRef<number | null>(null);
    const lastSpawnTime = useRef(0);
    const nextAsteroidId = useRef(0);
    const keysPressed = useRef<{ [key: string]: boolean }>({});
    const isDoneRef = useRef(false);

    const spawnInterval = 500 - tile.difficulty * 100; // 400, 300, 200 ms
    const asteroidSpeed = 2 + tile.difficulty; // 3, 4, 5
    const playerSpeed = 1.5;

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setIsGameOver(true);
        onComplete({ primaryMetric: hitsRef.current });
    }, [onComplete]);
    
    useEffect(() => {
        if (isPaused) return;
        const duration = event.durationSec(tile.difficulty, settings.accessibility) * 1000;
        const timer = setTimeout(finishEvent, duration);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent, isPaused]);

    const gameLoop = useCallback((timestamp: number) => {
        if (isDoneRef.current || !gameAreaRef.current) return;

        const { width: gameWidth } = gameAreaRef.current.getBoundingClientRect();

        // Player movement
        setPlayerX(prevX => {
            let newX = prevX;
            if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
                newX -= playerSpeed;
            }
            if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
                newX += playerSpeed;
            }
            return Math.max(0, Math.min(100, newX));
        });
        
        // Spawn asteroids
        if (timestamp - lastSpawnTime.current > spawnInterval) {
            lastSpawnTime.current = timestamp;
            const newAsteroid: GameObject = {
                id: nextAsteroidId.current++,
                x: Math.random() * 100, // percentage
                y: -20,
                size: Math.random() * 20 + 20, // 20px to 40px
                speed: asteroidSpeed + Math.random() * 2,
            };
            setAsteroids(a => [...a, newAsteroid]);
        }
        
        // Update and check collisions
        setAsteroids(prevAsteroids => {
            const updatedAsteroids = [];
            const playerLeft = (playerX / 100) * gameWidth - PLAYER_WIDTH / 2;
            const playerRight = playerLeft + PLAYER_WIDTH;

            for (const ast of prevAsteroids) {
                ast.y += ast.speed;

                // Collision detection
                if (ast.y + ast.size > gameAreaRef.current!.offsetHeight - PLAYER_HEIGHT) {
                    const astLeft = (ast.x / 100) * gameWidth - ast.size / 2;
                    const astRight = astLeft + ast.size;

                    if (astRight > playerLeft && astLeft < playerRight) {
                        hitsRef.current += 1;
                        setHits(hitsRef.current);
                        continue; // Remove hit asteroid
                    }
                }

                if (ast.y < gameAreaRef.current!.offsetHeight) {
                    updatedAsteroids.push(ast);
                }
            }
            return updatedAsteroids;
        });
        
        gameLoopRef.current = requestAnimationFrame(gameLoop);
    }, [spawnInterval, asteroidSpeed, playerSpeed, playerX]);
    
    useEffect(() => {
        if (isPaused) return;
        gameLoopRef.current = requestAnimationFrame(gameLoop);
        
        const handleKeyDown = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
        const handleKeyUp = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isPaused, gameLoop]);

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 bg-cosmic-blue/50 select-none overflow-hidden ${isBlurred ? 'filter blur-md' : ''}`}>
             <div className="absolute top-4 text-center z-10">
                 <h3 className="text-2xl font-bold text-galaxy-cyan">Asteroid Dodge!</h3>
                 <p className={`font-mono text-xl ${hits > 0 ? 'text-nebula-pink' : 'text-white'}`}>Hits: {hits}</p>
                 {isGameOver && <p className="text-2xl font-bold text-hyper-green animate-fade-in">Event Over!</p>}
            </div>
            <div ref={gameAreaRef} className="w-full h-full relative border-b-4 border-star-purple">
                {/* Player */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: `${playerX}%`,
                    transform: 'translateX(-50%)',
                    width: PLAYER_WIDTH,
                    height: PLAYER_HEIGHT,
                    backgroundColor: '#00dffc',
                    clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', // Triangle shape
                }} />

                {/* Asteroids */}
                {asteroids.map(ast => (
                    <div key={ast.id} style={{
                        position: 'absolute',
                        top: ast.y,
                        left: `${ast.x}%`,
                        transform: 'translateX(-50%)',
                        width: ast.size,
                        height: ast.size,
                        backgroundColor: '#ffae42',
                        borderRadius: '50%',
                    }}/>
                ))}
            </div>
        </div>
    );
};
