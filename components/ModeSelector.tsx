/**
 * components/ModeSelector.tsx
 *
 * Game mode selection screen: Local, Online, Ranked, Tournament, Ghost Race.
 */

import React from 'react';
import { useSound } from '../hooks/useSound';

export type GameModeSelection = 'local' | 'online' | 'ranked' | 'tournament' | 'ghost';

interface ModeSelectorProps {
  onSelect: (mode: GameModeSelection) => void;
  onBack: () => void;
  queueStatus?: { ranked: number; unranked: number };
}

interface ModeCard {
  id: GameModeSelection;
  title: string;
  description: string;
  icon: string;
  accent: string;
  tag: string;
}

const modes: ModeCard[] = [
  {
    id: 'local',
    title: 'Standard & Solo Circuit',
    description: 'Custom AI races, Daily Challenge, Weekly Cup, and 50-Tile Solo Gauntlet.',
    icon: '🏁',
    accent: '#00dffc',
    tag: 'LOCAL',
  },
  {
    id: 'online',
    title: 'Online Multiplayer',
    description: 'Create or join real-time rooms via 4-letter codes with up to 6 pilots.',
    icon: '🌐',
    accent: '#a77dff',
    tag: 'LIVE',
  },
  {
    id: 'ranked',
    title: 'Ranked Ladder Queue',
    description: 'Competitive ELO matchmaking from Bronze to Diamond tier.',
    icon: '⚔️',
    accent: '#d64f8a',
    tag: 'RANKED',
  },
  {
    id: 'tournament',
    title: 'Elimination Tournament',
    description: 'Single-elimination 4, 8, or 16-pilot brackets for Championship glory.',
    icon: '🏆',
    accent: '#ffae42',
    tag: 'BRACKET',
  },
  {
    id: 'ghost',
    title: 'Ghost Time-Attack',
    description: 'Async head-to-head PvP against recorded pilot runs on identical seeds.',
    icon: '👻',
    accent: '#4dffaf',
    tag: 'ASYNC PVP',
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  onSelect,
  onBack,
  queueStatus,
}) => {
  const { playSound } = useSound();

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 animate-fade-in" role="region" aria-label="Select Game Mode">
      <div className="w-full max-w-4xl flex flex-col gap-5">
        <header className="glass-panel p-4 sm:p-6 flex items-center justify-between border-b-2 border-galaxy-cyan/40">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              className="px-3 sm:px-4 py-2 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-sm font-bold text-gray-200 transition-colors"
              onClick={() => { playSound('ui-click'); onBack(); }}
            >
              ← Back
            </button>
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green uppercase tracking-tight">
                Select Circuit Protocol
              </h1>
              <p className="text-xs text-gray-400 font-mono">Choose your competitive arena</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {modes.map(mode => (
            <button
              key={mode.id}
              className="glass-panel p-4 sm:p-5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex items-start gap-4 border-l-4"
              style={{ borderLeftColor: mode.accent }}
              onClick={() => { playSound('ui-click'); onSelect(mode.id); }}
            >
              <span className="text-3xl sm:text-4xl mt-1" aria-hidden="true">{mode.icon}</span>
              <div className="flex-grow">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-base sm:text-lg font-black text-white">{mode.title}</span>
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase"
                    style={{ backgroundColor: `${mode.accent}25`, color: mode.accent }}
                  >
                    {mode.tag}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">{mode.description}</p>
                {mode.id === 'ranked' && queueStatus && queueStatus.ranked > 0 && (
                  <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-nebula-pink/20 text-nebula-pink">
                    {queueStatus.ranked} in queue
                  </span>
                )}
                {mode.id === 'online' && queueStatus && queueStatus.unranked > 0 && (
                  <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-galaxy-cyan/20 text-galaxy-cyan">
                    {queueStatus.unranked} playing
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
