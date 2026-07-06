import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { GameState } from '../types';
import { STAR_MOVEMENT_MULTIPLIERS, TILE_MODIFIER_DEFINITIONS } from '../constants';

interface TileResultsScreenProps {
  gameState: GameState;
  onContinue: () => void;
}

const AUTO_ADVANCE_MS = 3500;

export const TileResultsScreen: React.FC<TileResultsScreenProps> = ({ gameState, onContinue }) => {
  const { players, run, lastTileResults, settings } = gameState;
  const completedTileIndex = gameState.currentTileIndex - 1;
  const completedTile = run[completedTileIndex];

  const [isAnimating, setIsAnimating] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const handleDismiss = useCallback(() => {
    onContinue();
  }, [onContinue]);

  useEffect(() => {
    const animationTimer = setTimeout(() => setIsAnimating(true), 200);
    const continueTimer = setTimeout(() => handleDismiss(), AUTO_ADVANCE_MS);

    // Start progress bar animation
    if (progressRef.current) {
      progressRef.current.style.transition = `width ${AUTO_ADVANCE_MS}ms linear`;
      requestAnimationFrame(() => {
        if (progressRef.current) progressRef.current.style.width = '0%';
      });
    }

    return () => {
      clearTimeout(animationTimer);
      clearTimeout(continueTimer);
    };
  }, [handleDismiss]);

  // Keyboard dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDismiss]);
  
  const playerResults = useMemo(() => {
    if (!lastTileResults || !completedTile) return [];
    const baseStep = 100 / settings.runLength;

    const oldPlayerState = players.map(p => {
        const result = lastTileResults[p.id];
        let moveMultiplier = STAR_MOVEMENT_MULTIPLIERS[result.stars];
        
        if (completedTile.modifier === 'BOOST_PAD' && result.stars === 3) moveMultiplier *= 2;
        if (p.statuses.some(s => s.type === 'FROZEN' || s.type === 'STUNNED')) moveMultiplier = 0;
        
        const distanceGained = baseStep * moveMultiplier;
        const oldPosition = p.position - distanceGained;
        
        return {
            ...p,
            stars: result.stars,
            distanceGained: distanceGained,
            oldPosition: oldPosition < 0 ? 0 : oldPosition,
        };
    });
    return oldPlayerState.sort((a,b) => b.position - a.position);
  }, [lastTileResults, players, settings.runLength, completedTile]);

  if (!completedTile || !lastTileResults) {
    return null;
  }

  const tileModifier = completedTile.modifier ? TILE_MODIFIER_DEFINITIONS[completedTile.modifier] : null;
  
  const renderStars = (stars: number) => {
    if (stars === 4) return <span className="text-nebula-pink">★★★★</span>;
    if (stars === 0) return <span className="text-gray-600">☆☆☆☆</span>;
    return <span className="text-solar-orange">{'★'.repeat(stars).padEnd(3, '☆')}</span>;
  };

  return (
    <div className="fixed inset-0 bg-cosmic-blue/90 sm:backdrop-blur-md flex items-center justify-center z-50 animate-fade-in p-2 sm:p-4" onClick={onContinue} role="dialog" aria-label="Tile Results" aria-modal="true" aria-live="polite">
      <div className="w-full max-w-3xl glass-panel p-4 sm:p-8 animate-slide-in-up border-t-4 border-galaxy-cyan" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex justify-between items-end mb-3 sm:mb-6 pb-3 sm:pb-4 border-b border-white/10">
            <div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tighter">RESULTS</h1>
                <p className="text-gray-400 text-xs sm:text-sm uppercase tracking-widest">Tile {completedTileIndex + 1} Complete</p>
            </div>
            {tileModifier && (
                <div className="text-right">
                    <div className="text-2xl">{tileModifier.icon}</div>
                    <div className="text-xs text-galaxy-cyan font-bold uppercase">{tileModifier.description}</div>
                </div>
            )}
        </div>
        
        <div className="space-y-2 sm:space-y-3">
            {playerResults.map((player) => (
                <div key={player.id} className="relative h-10 sm:h-12 bg-black/40 rounded-lg overflow-hidden flex items-center px-2 sm:px-4 border border-white/5">
                    {/* Progress Bar Background */}
                    <div 
                        className="absolute left-0 top-0 h-full opacity-20 transition-all duration-[1500ms] ease-out"
                        style={{ 
                            width: `${isAnimating ? Math.min(100, player.position) : Math.min(100, player.oldPosition)}%`,
                            backgroundColor: player.color 
                        }}
                    />
                    
                    <div className="relative z-10 flex justify-between w-full items-center">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="w-2 sm:w-3 h-6 sm:h-8 rounded-full flex-shrink-0" style={{backgroundColor: player.color}}></div>
                            <span className={`font-bold text-sm sm:text-base truncate ${!player.isBot ? 'text-white' : 'text-gray-400'}`}>{player.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                             <div className="text-xs sm:text-sm font-mono">{renderStars(player.stars)}</div>
                             <div className={`font-mono font-bold w-14 sm:w-16 text-right text-xs sm:text-sm transition-opacity duration-500 ${isAnimating ? 'opacity-100' : 'opacity-0'} ${player.distanceGained > 0 ? 'text-hyper-green' : 'text-gray-500'}`}>
                                +{player.distanceGained.toFixed(1)}%
                             </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <div className="mt-4 sm:mt-8">
             <div className="relative w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-2">
                <div ref={progressRef} className="h-full bg-galaxy-cyan rounded-full" style={{ width: '100%' }} />
             </div>
             <p className="text-xs text-gray-500 text-center">Tap or press any key to continue</p>
        </div>
      </div>
    </div>
  );
};
