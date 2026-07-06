/**
 * components/ModeSelector.tsx
 *
 * Game mode selection screen: Local, Online, Ranked, Tournament, Ghost Race.
 */

import React from 'react';

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
  badge?: string;
}

const modes: ModeCard[] = [
  {
    id: 'local',
    title: 'Quick Race',
    description: 'Play solo against AI opponents',
    icon: '🏁',
    accent: '#3b82f6',
  },
  {
    id: 'online',
    title: 'Online Match',
    description: 'Create or join a private room',
    icon: '🌐',
    accent: '#8b5cf6',
  },
  {
    id: 'ranked',
    title: 'Ranked Queue',
    description: 'Matchmaking with ELO rating',
    icon: '⚔️',
    accent: '#ef4444',
  },
  {
    id: 'tournament',
    title: 'Tournament',
    description: 'Single-elimination bracket play',
    icon: '🏆',
    accent: '#f59e0b',
  },
  {
    id: 'ghost',
    title: 'Ghost Race',
    description: 'Async PvP against recorded runs',
    icon: '👻',
    accent: '#10b981',
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  onSelect,
  onBack,
  queueStatus,
}) => {
  return (
    <div className="mode-selector">
      <div className="mode-selector__header">
        <button className="mode-selector__back" onClick={onBack}>← Back</button>
        <h2>Select Mode</h2>
      </div>

      <div className="mode-selector__grid">
        {modes.map(mode => (
          <button
            key={mode.id}
            className="mode-card"
            style={{ '--mode-accent': mode.accent } as React.CSSProperties}
            onClick={() => onSelect(mode.id)}
          >
            <span className="mode-card__icon">{mode.icon}</span>
            <div className="mode-card__body">
              <span className="mode-card__title">{mode.title}</span>
              <span className="mode-card__description">{mode.description}</span>
            </div>
            {mode.id === 'ranked' && queueStatus && queueStatus.ranked > 0 && (
              <span className="mode-card__badge">{queueStatus.ranked} in queue</span>
            )}
            {mode.id === 'online' && queueStatus && queueStatus.unranked > 0 && (
              <span className="mode-card__badge">{queueStatus.unranked} playing</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
