
import React, { useEffect } from 'react';
import { Tile } from '../types';
import { eventRegistry } from '../events/eventRegistry';
import { TILE_MODIFIER_DEFINITIONS } from '../constants';
import { useSound } from '../hooks/useSound';

interface RivalInterventionModalProps {
  rivalName: string;
  standardTile: Tile;
  hazardTile: Tile;
  cpBonus: number;
  onAccept: () => void;
  onDecline: () => void;
}

const TileCard: React.FC<{ tile: Tile; title: string; cpBonus?: number }> = ({ tile, title, cpBonus }) => {
    const event = eventRegistry.find(e => e.id === tile.eventId)!;
    return (
        <div className="glass-panel p-3 sm:p-4 rounded-lg flex-1">
            <h3 className="text-base sm:text-xl font-bold text-center text-solar-orange mb-1 sm:mb-2">{title}</h3>
            <p className="text-sm sm:text-lg font-semibold text-center">{event.displayName}</p>
            <p className="text-center font-mono text-galaxy-cyan mb-1 sm:mb-2">{'★'.repeat(tile.difficulty).padEnd(3, '☆')}</p>
            {tile.modifier && (
                <p className="text-center text-sm text-gray-300">
                    {TILE_MODIFIER_DEFINITIONS[tile.modifier].icon} {TILE_MODIFIER_DEFINITIONS[tile.modifier].description}
                </p>
            )}
            {cpBonus !== undefined && cpBonus > 0 && (
                 <p className="text-center text-hyper-green font-bold mt-2">+{cpBonus} CP Bonus on ★★★</p>
            )}
        </div>
    );
};

export const RivalInterventionModal: React.FC<RivalInterventionModalProps> = ({ rivalName, standardTile, hazardTile, cpBonus, onAccept, onDecline }) => {
    const { playSound } = useSound();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); onDecline(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onDecline]);

    const handleAccept = () => {
        playSound('ui-click');
        onAccept();
    }
    
    const handleDecline = () => {
        playSound('ui-click');
        onDecline();
    }

  return (
    <div
      className="fixed inset-0 bg-cosmic-blue/80 sm:backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Rival Intervention Challenge"
    >
      <div className="glass-panel w-full max-w-3xl p-4 sm:p-6 animate-slide-in-up text-center mx-2">
        <h2 className="text-2xl sm:text-3xl font-black text-nebula-pink tracking-tighter mb-1 sm:mb-2">RIVAL INTERVENTION</h2>
        <p className="text-sm sm:text-lg text-gray-300 mb-4 sm:mb-6">"{rivalName} is challenging you to a Hazard Tile!"</p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <TileCard tile={standardTile} title="Standard Tile" />
            <div className="flex items-center justify-center text-xl sm:text-2xl font-bold text-solar-orange py-1 sm:py-0">VS</div>
            <TileCard tile={hazardTile} title="Hazard Tile" cpBonus={cpBonus} />
        </div>

        <div className="flex justify-center gap-3 sm:gap-4">
            <button onClick={handleDecline} className="px-6 sm:px-8 py-3 bg-star-purple text-white font-bold text-base sm:text-lg rounded-lg active:bg-nebula-pink sm:hover:bg-nebula-pink transition-colors flex-1 sm:flex-none" aria-label="Decline the challenge">
                Decline
            </button>
            <button onClick={handleAccept} className="px-6 sm:px-8 py-3 bg-hyper-green text-cosmic-blue font-bold text-base sm:text-lg rounded-lg active:opacity-80 sm:hover:opacity-90 transition-opacity flex-1 sm:flex-none" aria-label="Accept the hazard challenge">
                Accept Challenge
            </button>
        </div>
      </div>
    </div>
  );
};
