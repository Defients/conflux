

import React from 'react';
import { GameState } from '../types';

interface DebugPanelProps {
  gameState: GameState;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ gameState }) => {
  const pathHash = gameState.run.map(tile => tile.eventId.substring(0, 3)).join('-');
  const debugInfo = `Seed: ${gameState.settings.seed}\nPath Hash: ${pathHash}\nState: ${JSON.stringify(gameState, null, 2)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(debugInfo);
  };
  
  return (
    <div className="absolute top-12 right-2 left-2 sm:left-auto sm:w-80 h-auto max-h-[70vh] sm:max-h-[80vh] bg-black/90 border border-gray-600 text-white text-xs p-2 sm:p-3 rounded z-50 overflow-auto mobile-scroll font-mono" role="region" aria-label="Debug Panel">
      <div className="flex justify-between items-center gap-2 mb-2">
        <h3 className="font-bold text-[11px] sm:text-xs truncate">DEBUG_PANEL</h3>
        <button onClick={handleCopy} className="bg-star-purple px-3 py-2 text-xs rounded active:bg-nebula-pink sm:hover:bg-nebula-pink min-h-[44px] transition-colors" aria-label="Copy debug information">Copy</button>
      </div>
      <p className="break-all">Seed: {gameState.settings.seed}</p>
      <p className="break-all">Path Hash: {pathHash}</p>
      <hr className="my-1 border-gray-600"/>
      <pre className="whitespace-pre-wrap break-all text-[10px] sm:text-xs leading-relaxed">
        {JSON.stringify(gameState, null, 2)}
      </pre>
    </div>
  );
};
