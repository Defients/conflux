
import React, { useEffect } from 'react';
import { Tile, InterventionType, PlayerStatus } from '../types';
import { eventRegistry } from '../events/eventRegistry';
import { TILE_MODIFIER_DEFINITIONS } from '../constants';
import { useSound } from '../hooks/useSound';

interface RivalInterventionModalProps {
  rivalName: string;
  standardTile: Tile;
  hazardTile: Tile;
  cpBonus: number;
  interventionType?: InterventionType;
  sabotageStatus?: PlayerStatus['type'];
  onAccept: () => void;
  onDecline: () => void;
}

const TileCard: React.FC<{
  tile: Tile;
  title: string;
  cpBonus?: number;
  sabotageStatus?: PlayerStatus['type'];
  isRivalPick?: boolean;
}> = ({ tile, title, cpBonus, sabotageStatus, isRivalPick }) => {
    const event = eventRegistry.find(e => e.id === tile.eventId) ?? eventRegistry[0];
    return (
        <div className={`glass-panel p-3 sm:p-4 rounded-xl flex-1 border ${isRivalPick ? 'border-nebula-pink/50 bg-nebula-pink/5' : 'border-white/10'}`}>
            <h3 className={`text-base sm:text-xl font-bold text-center mb-1 sm:mb-2 ${isRivalPick ? 'text-nebula-pink' : 'text-solar-orange'}`}>{title}</h3>
            <p className="text-sm sm:text-lg font-semibold text-center text-white">{event.displayName}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 text-center mb-1">{event.performanceDimension}</p>
            <p className="text-center font-mono text-galaxy-cyan mb-1 sm:mb-2">{'★'.repeat(tile.difficulty).padEnd(3, '☆')}</p>
            {tile.modifier && (
                <p className="text-center text-xs sm:text-sm text-gray-300">
                    {TILE_MODIFIER_DEFINITIONS[tile.modifier].icon} {TILE_MODIFIER_DEFINITIONS[tile.modifier].description}
                </p>
            )}
            {sabotageStatus && (
                <div className="mt-2 px-2 py-1 rounded bg-red-500/20 border border-red-500/40 text-xs font-bold text-red-300 text-center">
                    ⚠️ Active Sabotage: {sabotageStatus === 'BLURRED' ? '🌫️ Vision Blurred' : '⏳ Thrusters Slowed'}
                </div>
            )}
            {cpBonus !== undefined && cpBonus > 0 && (
                 <p className="text-center text-hyper-green font-bold mt-2 text-sm">+{cpBonus} CP Bonus on ★★★</p>
            )}
        </div>
    );
};

export const RivalInterventionModal: React.FC<RivalInterventionModalProps> = ({
    rivalName,
    standardTile,
    hazardTile,
    cpBonus,
    interventionType = 'HAZARD',
    sabotageStatus,
    onAccept,
    onDecline,
}) => {
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
    };
    
    const handleDecline = () => {
        playSound('ui-click');
        onDecline();
    };

    const headerTitle =
        interventionType === 'SABOTAGE' ? 'RIVAL SABOTAGE GAMBIT' :
        interventionType === 'VETO' ? 'RIVAL EVENT VETO' :
        'RIVAL HAZARD INTERVENTION';

    const subtitle =
        interventionType === 'SABOTAGE'
            ? `"${rivalName} dares you to race the next tile under ${sabotageStatus ?? 'SABOTAGE'} conditions for a massive bounty!"`
            : interventionType === 'VETO'
            ? `"${rivalName} is attempting to veto the scheduled event and force a high-stakes swap!"`
            : `"${rivalName} is challenging you to an escalated Hazard Tile!"`;

    const rightCardTitle =
        interventionType === 'SABOTAGE' ? 'Sabotaged Run' :
        interventionType === 'VETO' ? "Rival's Veto Pick" :
        'Hazard Tile';

  return (
    <div
      className="fixed inset-0 bg-cosmic-blue/80 sm:backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Rival Intervention Challenge"
    >
      <div className="glass-panel w-full max-w-3xl p-4 sm:p-6 animate-slide-in-up text-center mx-2 border border-nebula-pink/40">
        <div className="inline-block px-3 py-0.5 rounded-full bg-nebula-pink/20 text-nebula-pink text-[10px] font-black uppercase tracking-widest mb-2">
            ⚔️ {interventionType} PROTOCOL
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-nebula-pink tracking-tighter mb-1 sm:mb-2">{headerTitle}</h2>
        <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6">{subtitle}</p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <TileCard tile={standardTile} title="Standard Tile" />
            <div className="flex items-center justify-center text-xl sm:text-2xl font-bold text-solar-orange py-1 sm:py-0">VS</div>
            <TileCard
                tile={hazardTile}
                title={rightCardTitle}
                cpBonus={cpBonus}
                sabotageStatus={interventionType === 'SABOTAGE' ? sabotageStatus : undefined}
                isRivalPick
            />
        </div>

        <div className="flex justify-center gap-3 sm:gap-4">
            <button onClick={handleDecline} className="px-6 sm:px-8 py-3 bg-star-purple text-white font-bold text-base sm:text-lg rounded-lg active:bg-nebula-pink sm:hover:bg-nebula-pink transition-colors flex-1 sm:flex-none" aria-label="Decline the challenge">
                Decline
            </button>
            <button onClick={handleAccept} className="px-6 sm:px-8 py-3 bg-hyper-green text-cosmic-blue font-bold text-base sm:text-lg rounded-lg active:opacity-80 sm:hover:opacity-90 transition-opacity flex-1 sm:flex-none" aria-label="Accept the hazard challenge">
                Accept Challenge (+{cpBonus} CP)
            </button>
        </div>
      </div>
    </div>
  );
};
