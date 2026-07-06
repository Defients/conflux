import React, { useState, useEffect, useCallback } from 'react';
import { LeaderboardEntry, LeaderboardCategory } from '../shared/types';
import { fetchLeaderboard } from '../services/leaderboardService';

interface LeaderboardScreenProps {
  onBack: () => void;
}

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [category, setCategory] = useState<LeaderboardCategory>('allTime');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchLeaderboard(category);
    setEntries(data);
    setLoading(false);
  }, [category]);

  useEffect(() => { load(); }, [load]);

  const tabs: { key: LeaderboardCategory; label: string }[] = [
    { key: 'allTime', label: 'All-Time' },
    { key: 'daily', label: 'Daily' },
    { key: 'gauntlet', label: 'Gauntlet' },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col p-4 sm:p-6 animate-fade-in overflow-y-auto" role="region" aria-label="Leaderboards">
      <header className="flex-shrink-0 flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green tracking-tighter">
          LEADERBOARDS
        </h1>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-bold text-gray-300 border border-white/10 rounded-lg active:bg-white/5 sm:hover:bg-white/5 transition-colors"
          aria-label="Return to hangar"
        >
          ← BACK
        </button>
      </header>

      <div className="flex gap-2 mb-6" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setCategory(tab.key)}
            role="tab"
            aria-selected={category === tab.key}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
              category === tab.key
                ? 'bg-galaxy-cyan/20 text-galaxy-cyan border border-galaxy-cyan/40'
                : 'text-gray-400 border border-white/5 active:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-grow max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-12 text-gray-500" aria-live="polite">Loading rankings...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4" aria-hidden="true">📊</div>
            <p className="text-sm">No entries yet. Be the first!</p>
          </div>
        ) : (
          <ol className="space-y-2" role="list">
            {entries.map((entry, idx) => (
              <li
                key={entry.userId}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-colors ${
                  idx < 3
                    ? 'border-hyper-green/30 bg-hyper-green/5'
                    : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <span className={`text-lg sm:text-2xl font-black w-8 text-center ${
                  idx === 0 ? 'text-hyper-green' : idx === 1 ? 'text-galaxy-cyan' : idx === 2 ? 'text-nebula-pink' : 'text-gray-500'
                }`}>
                  {idx + 1}
                </span>
                <span className="text-2xl" aria-hidden="true">{entry.avatarId}</span>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-bold text-white truncate">{entry.playerName}</p>
                  <p className="text-xs text-gray-500">
                    {category === 'gauntlet'
                      ? `${entry.bestScore} tiles survived`
                      : category === 'daily'
                        ? `${entry.bestScore} pts (daily best)`
                        : `${entry.circuitPoints} CP`}
                  </p>
                </div>
                {idx < 3 && (
                  <span className="text-lg" aria-hidden="true">
                    {idx === 0 ? '🏆' : idx === 1 ? '🥈' : '🥉'}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
