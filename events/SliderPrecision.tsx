import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EventProps } from '../types';

export const SliderPrecision: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const [position, setPosition] = useState(50);
    const [isStopped, setIsStopped] = useState(false);
    const requestRef = useRef<number | null>(null);
    const stateRef = useRef({
        position: 50,
        direction: 1,
        speed: 0.2 + (tile.difficulty - 1) * 0.15,
    });
    
    const targetPosition = 50; // Always target center for simplicity
    const targetWidth = 12 - (tile.difficulty * 2); // 10, 8, 6

    const animate = useCallback(() => {
        const state = stateRef.current;
        if (state.position > 100 || state.position < 0) {
            state.direction *= -1;
        }
        state.position += state.direction * state.speed;
        setPosition(state.position);
        requestRef.current = requestAnimationFrame(animate);
    }, []);

    useEffect(() => {
        if (isPaused) return;
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [isPaused, animate]);
    
    const stopSlider = useCallback(() => {
        if (isStopped) return;
        setIsStopped(true);
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        const finalPosition = stateRef.current.position;
        const distance = Math.abs(finalPosition - targetPosition);
        onComplete({ primaryMetric: distance });
    }, [isStopped, onComplete, targetPosition]);
    
    useEffect(() => {
        const duration = tile.difficulty === 1 ? 5000 : tile.difficulty === 2 ? 4000 : 3000;
        const timer = setTimeout(() => {
            if (!isStopped) {
                stopSlider();
            }
        }, duration);
        return () => clearTimeout(timer);
    }, [tile.difficulty, isStopped, stopSlider]);
    
    useEffect(() => {
        const handleInteraction = () => stopSlider();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                stopSlider();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleInteraction);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleInteraction);
        };
    }, [stopSlider]);

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-8 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`} onClick={stopSlider}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-4">Stop the Slider in the Target Zone!</h3>
            <div className="w-full max-w-2xl h-12 bg-gray-900/50 rounded-lg relative flex items-center cursor-pointer">
                {/* Target Zone */}
                <div 
                    className="absolute h-full bg-hyper-green/30 top-0 rounded-lg"
                    style={{
                        left: `${targetPosition}%`,
                        width: `${targetWidth}%`,
                        transform: 'translateX(-50%)',
                        border: isStopped ? `2px solid ${Math.abs(position - targetPosition) < targetWidth / 2 ? '#4dffaf' : '#d64f8a'}` : '2px solid #00dffc'
                    }}
                />
                
                {/* Slider Handle */}
                <div 
                    className="absolute w-2 h-16 bg-white rounded-full transition-colors duration-300"
                    style={{
                        left: `${position}%`,
                        transform: 'translateX(-50%)',
                        backgroundColor: isStopped ? '#ffae42' : '#ffffff'
                    }}
                />
            </div>
             {isStopped && (
                <div className="mt-8 text-3xl font-bold animate-fade-in">
                    Distance: <span className="text-solar-orange">{Math.abs(position - targetPosition).toFixed(2)}</span>
                </div>
            )}
        </div>
    );
};
