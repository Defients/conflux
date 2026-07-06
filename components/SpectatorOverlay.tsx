/**
 * components/SpectatorOverlay.tsx
 *
 * Floating overlay shown when spectating an in-progress match.
 * Displays spectated player info, live standings, and exit button.
 */

import React from 'react';
import { GameState } from '../shared/types';
import { CHASSIS_DEFINITIONS } from '../constants';

interface SpectatorOverlayProps {
  gameState: GameState | null;
  spectatingPlayerName?: string;
  onLeave: () => void;
}

export const SpectatorOverlay: React.FC<SpectatorOverlayProps> = ({
  gameState,
  spectatingPlayerName,
  onLeave,
}) => {
  if (!gameState) return null;

  const sortedPlayers = [...gameState.players].sort((a, b) => b.position - a.position);
  const currentTile = gameState.run[gameState.currentTileIndex];

  return (
    <div className="fixed top-12 left-2 z-40 glass-panel p-3 max-w-xs animate-slide-up" role="region" aria-label="Spectator mode">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">👁️</span>
          <span className="text-xs font-bold text-galaxy-cyan uppercase tracking-widest">Spectating</span>
        </div>
        <button
          onClick={onLeave}
          className="text-xs px-2 py-1 bg-red-500/20 border border-red-500/40 rounded text-red-300 active:bg-red-500/30 transition-colors"
          aria-label="Leave spectator mode"
        >
          Exit
        </button>
      </div>

      {spectatingPlayerName && (
        <div className="text-xs text-gray-400 mb-2">
          Watching: <span className="text-white font-bold">{spectatingPlayerName}</span>
        </div>
      )}

      <div className="text-[10px] text-gray-500 mb-2">
        Tile {gameState.currentTileIndex + 1}/{gameState.run.length}
        {currentTile ? ` — ${currentTile.eventId}` : ''}
      </div>

      <div className="space-y-1">
        {sortedPlayers.slice(0, 4).map((player, i) => (
          <div key={player.id} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-center font-bold opacity-60">{i + 1}</span>
            <span className="text-sm">{player.chassisId ? CHASSIS_DEFINITIONS[player.chassisId]?.icon : '🤖'}</span>
            <span className={`flex-grow truncate ${!player.isBot ? 'text-galaxy-cyan font-bold' : 'text-gray-300'}`}>
              {player.name}
            </span>
            <span className="font-mono text-gray-400">{player.position.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
