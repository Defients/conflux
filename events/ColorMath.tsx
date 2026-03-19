
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { EventProps } from '../types';
import { SeededRNG } from '../services/seededRNG';

type RGB = { r: number; g: number; b: number };

const generateColor = (rng: SeededRNG): RGB => ({
    r: rng.nextInt(30, 225),
    g: rng.nextInt(30, 225),
    b: rng.nextInt(30, 225),
});

// Simplified Delta E calculation (Euclidean distance in RGB space)
const calculateDeltaE = (c1: RGB, c2: RGB): number => {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    // Normalize to roughly 0-100 scale. A raw distance of ~25.5 is a deltaE of 10.
    return Math.sqrt(dr * dr + dg * dg + db * db) / 2.55; 
};

const rgbToHex = (c: RGB) => `#${c.r.toString(16).padStart(2, '0')}${c.g.toString(16).padStart(2, '0')}${c.b.toString(16).padStart(2, '0')}`;

export const ColorMath: React.FC<EventProps> = ({ onComplete, tile, settings, event, isBlurred , isPaused }) => {
    const rng = useMemo(() => new SeededRNG(`colormath-${settings.seed}-${tile.tileIndex}`), [settings.seed, tile.tileIndex]);
    const targetColor = useMemo(() => generateColor(rng), [rng]);

    const [currentColor, setCurrentColor] = useState<RGB>({ r: 128, g: 128, b: 128 });
    const currentColorRef = useRef<RGB>({ r: 128, g: 128, b: 128 });
    const [isDone, setIsDone] = useState(false);
    const isDoneRef = useRef(false);

    const deltaE = useMemo(() => calculateDeltaE(targetColor, currentColor), [targetColor, currentColor]);

    const finishEvent = useCallback(() => {
        if (isDoneRef.current) return;
        isDoneRef.current = true;
        setIsDone(true);
        const finalDeltaE = calculateDeltaE(targetColor, currentColorRef.current);
        onComplete({ primaryMetric: finalDeltaE });
    }, [onComplete, targetColor]);
    
    useEffect(() => {
        const timer = setTimeout(finishEvent, event.durationSec(tile.difficulty, settings.accessibility) * 1000);
        return () => clearTimeout(timer);
    }, [event, tile.difficulty, settings.accessibility, finishEvent]);

    const handleSliderChange = (channel: 'r' | 'g' | 'b', value: number) => {
        if (isDoneRef.current) return;
        const newColor = { ...currentColorRef.current, [channel]: value };
        currentColorRef.current = newColor;
        setCurrentColor(newColor);
    };

    const hideNumbers = tile.difficulty >= 2;

    return (
        <div className={`w-full h-full flex flex-col items-center justify-center p-8 bg-cosmic-blue/50 select-none ${isBlurred ? 'filter blur-md' : ''}`}>
            <h3 className="text-2xl font-bold text-galaxy-cyan mb-6">Match the Target Color</h3>
            
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                <div className="text-center">
                    <p className="font-semibold mb-2">Target</p>
                    <div className="w-32 h-32 rounded-lg border-4 border-white" style={{ backgroundColor: rgbToHex(targetColor) }} />
                </div>
                <div className="text-center">
                    <p className="font-semibold mb-2">Your Color</p>
                    <div className="w-32 h-32 rounded-lg border-4" style={{ backgroundColor: rgbToHex(currentColor), borderColor: deltaE < 8 ? '#4dffaf' : '#4a3f9d' }} />
                </div>
            </div>

            <div className="w-full max-w-lg glass-panel p-6">
                 <p className="text-center text-lg mb-4">
                    Difference: <span className={deltaE < 4 ? 'text-hyper-green' : deltaE < 8 ? 'text-solar-orange' : 'text-nebula-pink'}>{deltaE.toFixed(2)}</span>
                </p>
                {['r', 'g', 'b'].map(channel => (
                    <div key={channel} className="flex items-center space-x-4 mb-3">
                        <span className={`w-6 font-bold text-2xl ${channel === 'r' ? 'text-red-500' : channel === 'g' ? 'text-green-500' : 'text-blue-500'}`}>{channel.toUpperCase()}</span>
                        <input
                            type="range"
                            min="0"
                            max="255"
                            value={currentColor[channel as keyof RGB]}
                            onChange={e => handleSliderChange(channel as 'r'|'g'|'b', parseInt(e.target.value, 10))}
                            className="w-full h-3 appearance-none cursor-pointer rounded-lg"
                            style={{ backgroundColor: '#2d3748', accentColor: channel === 'r' ? 'red' : channel === 'g' ? 'green' : 'blue' }}
                        />
                        {!hideNumbers && <span className="w-12 text-right font-mono">{currentColor[channel as keyof RGB]}</span>}
                    </div>
                ))}
            </div>
             <button onClick={finishEvent} disabled={isDone} className="mt-6 px-8 py-3 bg-hyper-green text-cosmic-blue font-bold text-lg rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity">
              SUBMIT
            </button>
        </div>
    );
};
