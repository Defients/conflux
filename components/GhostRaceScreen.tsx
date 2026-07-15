/**
 * components/GhostRaceScreen.tsx
 *
 * Setup screen for Ghost Race mode — async PvP against recorded runs.
 * Lets the player configure run length and chassis before racing a ghost.
 */

import React, { useState, useCallback } from 'react';
import { PilotProfile, GameSettings, ChassisId } from '../types';
import { CHASSIS_DEFINITIONS } from '../constants';

interface GhostRaceScreenProps {
  profile: PilotProfile | null;
  onStart: (settings: GameSettings) => void;
  onBack: () => void;
}

export const GhostRaceScreen: React.FC<GhostRaceScreenProps> = ({ profile, onStart, onBack }) => {
  const [runLength, setRunLength] = useState(8);
  const [selectedChassis, setSelectedChassis] = useState<ChassisId>(
    profile?.unlockedChassis?.[0] ?? ChassisId.Standard
  );
  const [isSearching, setIsSearching] = useState(false);

  const handleStart = useCallback(() => {
    setIsSearching(true);
    const settings: GameSettings = {
      playerCount: 2,
      easyBots: 0,
      intermediateBots: 0,
      seed: `ghost-${Date.now()}`,
      runLength,
      sound: true,
      accessibility: false,
      uiEffects: true,
      colorBlindMode: false,
      selectedChassis,
    };
    onStart(settings);
  }, [runLength, selectedChassis, onStart]);

  const unlockedChassis = profile?.unlockedChassis ?? [ChassisId.Standard];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            className="px-4 py-2 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            onClick={onBack}
          >
            ← Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span aria-hidden="true">👻</span> Ghost Race
          </h1>
          <div className="w-20" />
        </div>

        <div className="glass-panel rounded-xl p-6 space-y-6">
          <p className="text-sm text-gray-300 leading-relaxed">
            Race against a recorded run from another pilot. The ghost replays their exact
            tile-by-tile performance on the same track. Beat their time to claim victory!
            Your run will be uploaded for others to race against.
          </p>

          {/* Run Length */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Run Length: <span className="text-cyan-400">{runLength} tiles</span>
            </label>
            <input
              type="range"
              min={4}
              max={16}
              step={2}
              value={runLength}
              onChange={e => setRunLength(Number(e.target.value))}
              className="w-full"
              aria-label="Run length in tiles"
              aria-valuemin={4}
              aria-valuemax={16}
              aria-valuenow={runLength}
              aria-valuetext={`${runLength} tiles`}
            />
          </div>

          {/* Chassis Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Chassis</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {unlockedChassis.map(chassisId => {
                const def = CHASSIS_DEFINITIONS[chassisId];
                const isSelected = selectedChassis === chassisId;
                return (
                  <button
                    key={chassisId}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-400/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedChassis(chassisId)}
                    aria-pressed={isSelected}
                    aria-label={`${def.name} chassis`}
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-lg">{def.icon}</span>
                      <span className="text-xs font-medium">{def.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{def.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start Button */}
          <button
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg font-bold text-lg hover:from-cyan-400 hover:to-blue-500 transition-all active:scale-95 disabled:opacity-50"
            onClick={handleStart}
            disabled={isSearching}
          >
            {isSearching ? 'Searching for ghost…' : 'Race Ghost!'}
          </button>

          {isSearching && (
            <p className="text-center text-xs text-gray-400 animate-pulse">
              Fetching a recorded run from the cloud…
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
