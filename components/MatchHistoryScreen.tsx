import React, { useState, useEffect } from 'react';
import { MatchHistoryEntry } from '../shared/types';
import { fetchMatchHistory } from '../services/matchHistoryService';

interface MatchHistoryScreenProps {
  onBack: () => void;
  onReplaySeed: (seed: string) => void;
  userId: string | null;
}

export const MatchHistoryScreen: React.FC<MatchHistoryScreenProps> = ({ onBack, onReplaySeed, userId }) => {
  const [entries, setEntries] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      setLoading(true);
      const data = await fetchMatchHistory(userId);
      if (mounted) { setEntries(data); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [userId]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen w-full flex flex-col p-4 sm:p-6 animate-fade-in overflow-y-auto" role="region" aria-label="Match History">
      <header className="flex-shrink-0 flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green tracking-tighter">
          MATCH HISTORY
        </h1>
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-bold text-gray-300 border border-white/10 rounded-lg active:bg-white/5 sm:hover:bg-white/5 transition-colors"
          aria-label="Return to hangar"
        >
          ← BACK
        </button>
      </header>

      <div className="flex-grow max-w-2xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-12 text-gray-500" aria-live="polite">Loading match history...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4" aria-hidden="true">🏁</div>
            <p className="text-sm">No matches yet. Race to make history!</p>
          </div>
        ) : (
          <div className="space-y-3" role="list">
            {entries.map(entry => (
              <div
                key={entry.matchId}
                className="p-4 rounded-lg border border-white/5 bg-white/[0.02] active:bg-white/5 transition-colors"
                role="listitem"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black ${
                      entry.placement === 1 ? 'text-hyper-green' :
                      entry.placement === 2 ? 'text-galaxy-cyan' :
                      entry.placement === 3 ? 'text-nebula-pink' : 'text-gray-400'
                    }`}>
                      P{entry.placement}
                    </span>
                    <span className="text-xs text-gray-500">/ {entry.totalPlayers}</span>
                    {entry.isDaily && <span className="text-xs px-2 py-0.5 rounded bg-galaxy-cyan/20 text-galaxy-cyan font-bold">DAILY</span>}
                    {entry.isGauntlet && <span className="text-xs px-2 py-0.5 rounded bg-nebula-pink/20 text-nebula-pink font-bold">GAUNTLET</span>}
                    {entry.rivalDefeated && <span className="text-xs" aria-hidden="true">⚔️</span>}
                  </div>
                  <span className="text-xs text-gray-500 font-mono">{formatDate(entry.completedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>+{entry.cpEarned} CP</span>
                    <span>{entry.runLength} tiles</span>
                    {entry.gauntletTilesSurvived !== null && <span>{entry.gauntletTilesSurvived} survived</span>}
                  </div>
                  <button
                    onClick={() => onReplaySeed(entry.seed)}
                    className="text-xs font-bold text-galaxy-cyan active:text-galaxy-cyan/70 transition-colors"
                    aria-label={`Replay seed ${entry.seed}`}
                  >
                    REPLAY ↻
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
