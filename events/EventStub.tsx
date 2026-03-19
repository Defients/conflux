
import React, { useState, useEffect } from 'react';
import { SeededRNG } from '../services/seededRNG';
import { EventProps } from '../types';

export const EventStub: React.FC<EventProps> = ({ onComplete, tile, settings , isPaused }) => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isPaused) return;
    if (countdown <= 0) {
      // Return a mock result. For stubs, bots calculate stars directly.
      // The human player gets a random result.
      const rng = new SeededRNG(tile.subSeed || `${tile.tileIndex}-stub`);
      const mockResult = rng.nextInt(1, 4); // 1, 2, or 3
      onComplete({ primaryMetric: mockResult, secondaryMetric: 0 });
    }

    const timer = setInterval(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, countdown, onComplete, tile.subSeed, tile.tileIndex]);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-white">
      <h2 className="text-3xl font-bold text-solar-orange mb-4">Event In Development</h2>
      <p className="text-xl">This event is not yet implemented.</p>
      <p className="mt-4 text-lg">Returning random result in: <span className="font-bold text-galaxy-cyan">{countdown}</span></p>
    </div>
  );
};
