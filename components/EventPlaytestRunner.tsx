


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GameEvent, EventResult, GameSettings, Tile, ChassisId } from '../types';

interface EventPlaytestRunnerProps {
  event: GameEvent;
  difficulty: number;
  onExit: () => void;
}

const ResultsModal: React.FC<{ result: Omit<EventResult, 'playerId'>, onReplay: () => void, onExit: () => void }> = ({ result, onReplay, onExit }) => {
    return (
        <div className="absolute inset-0 bg-cosmic-blue/80 sm:backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Playtest Results">
            <div className="glass-panel p-5 sm:p-8 text-center animate-slide-in-up max-w-md w-full">
                <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-hyper-green">Playtest Complete</h2>
                <div className="text-xl sm:text-2xl font-mono mb-2">
                    Stars: <span className="text-solar-orange">{'★'.repeat(result.stars).padEnd(3, '☆')}</span>
                </div>
                <div className="text-base sm:text-lg font-mono mb-1">Primary: <span className="text-white">{result.primaryMetric.toFixed(2)}</span></div>
                {result.secondaryMetric !== undefined && (
                    <div className="text-base sm:text-lg font-mono mb-6">Secondary: <span className="text-white">{result.secondaryMetric.toFixed(2)}</span></div>
                )}
                <div className="flex gap-3 sm:gap-4">
                    <button onClick={onReplay} className="flex-1 px-5 sm:px-6 py-3 sm:py-2 bg-star-purple font-semibold rounded-md active:bg-nebula-pink sm:hover:bg-nebula-pink transition-colors">Replay</button>
                    <button onClick={onExit} className="flex-1 px-5 sm:px-6 py-3 sm:py-2 bg-hyper-green text-cosmic-blue font-bold rounded-md active:opacity-80 sm:hover:opacity-90 transition-opacity">Back to List</button>
                </div>
            </div>
        </div>
    );
};

export const EventPlaytestRunner: React.FC<EventPlaytestRunnerProps> = ({ event, difficulty, onExit }) => {
    const [result, setResult] = useState<Omit<EventResult, 'playerId'> | null>(null);
    const [key, setKey] = useState(0); // Used to force re-mount for replays
    
    // Create mock objects that the event component expects
    const mockTile: Tile = useMemo(() => ({
        tileIndex: 1,
        eventId: event.id,
        difficulty: difficulty,
    }), [event.id, difficulty]);

    const mockSettings: GameSettings = useMemo(() => ({
        playerCount: 1,
        easyBots: 0,
        intermediateBots: 0,
        seed: String(Math.random()),
        runLength: 1,
        sound: true,
        accessibility: false,
        uiEffects: true,
// FIX: Add missing colorBlindMode property to satisfy the GameSettings type.
        colorBlindMode: false,
        selectedChassis: ChassisId.Standard,
    }), []);
    
    const eventDuration = event.durationSec(difficulty, mockSettings.accessibility);
    const [timeLeft, setTimeLeft] = useState(eventDuration);

    useEffect(() => {
        if (result) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => Math.max(0, prev - 0.1));
        }, 100);
        return () => clearInterval(timer);
    }, [result, key]);

    const handleComplete = (res: Omit<EventResult, 'playerId' | 'stars'>) => {
        const stars = event.getStars(res);
        setResult({ ...res, stars });
    };

    const handleReplay = () => {
        setResult(null);
        setTimeLeft(eventDuration);
        setKey(k => k + 1);
    };

    const EventComponent = event.Component;

    return (
        <div className="w-full h-screen flex flex-col p-2 sm:p-4 md:p-6 bg-cosmic-blue animate-fade-in overflow-hidden" role="region" aria-label={`Playtest: ${event.displayName}`}>
            {result && <ResultsModal result={result} onReplay={handleReplay} onExit={onExit} />}
            {/* Top Bar */}
            <div className="flex-shrink-0 mb-2 sm:mb-4 glass-panel p-2 sm:p-3">
                <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-2xl font-bold text-galaxy-cyan truncate">Playtest: {event.displayName}</h2>
                        <p className="text-star-purple text-xs sm:text-base">Difficulty: {'★'.repeat(difficulty).padEnd(3, '☆')}</p>
                    </div>
                     <div className="text-right flex-shrink-0">
                        <div className="text-2xl sm:text-4xl font-black text-solar-orange" role="timer" aria-label={`${timeLeft.toFixed(0)} seconds remaining`}>{timeLeft.toFixed(1)}</div>
                    </div>
                </div>
            </div>

            {/* Event Panel */}
            <div className="flex-grow w-full relative rounded-lg overflow-hidden glass-panel">
                <EventComponent
                    key={key}
                    tile={mockTile}
                    event={event}
                    settings={mockSettings}
                    onComplete={handleComplete}
                    isBlurred={false}
                    isOverdriving={false}
                />
            </div>
            <button onClick={onExit} className="mt-2 sm:mt-4 py-3 sm:py-2 text-gray-400 active:text-white sm:hover:text-white transition-colors" aria-label="Exit playtest">Exit Playtest</button>
        </div>
    );
};
