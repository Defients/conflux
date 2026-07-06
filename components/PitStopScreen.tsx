
import React, { useMemo } from 'react';
import { GameState, Player, PowerUp, PlayerStatus } from '../types';
import { PIT_STOP_CONFIG } from '../constants';
import { useSound } from '../hooks/useSound';

export type PitStopAction = 'scrub' | 'tuneUp' | 'analyze' | 'recharge';

interface PitStopScreenProps {
  gameState: GameState;
  onAction: (playerId: number, action: PitStopAction) => void;
}

const getStatusIcon = (type: PlayerStatus['type']) => {
    switch(type) {
        case 'FROZEN': return '❄️';
        case 'BLURRED': return '🌫️';
        case 'SLOWED': return '⏳';
        case 'STUNNED': return '😵';
        default: return '❓';
    }
};

export const PitStopScreen: React.FC<PitStopScreenProps> = ({ gameState, onAction }) => {
    const { players } = gameState;
    const humanPlayer = players.find(p => !p.isBot);
    const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.position - a.position), [players]);
    const { playSound } = useSound();
    
    if (!humanPlayer) return null;
    
    const negativeStatus = humanPlayer.statuses.find(s => s.type !== 'SHIELDED' && s.type !== 'BOOSTED');

    const handleAction = (action: PitStopAction) => {
        playSound('ui-click');
        onAction(humanPlayer.id, action);
    };

    const ActionButton: React.FC<{ actionId: PitStopAction, onAction: (action: PitStopAction) => void, player: Player, specialCondition?: any }> = ({ actionId, onAction, player, specialCondition }) => {
        const actionConfig = PIT_STOP_CONFIG.actions[actionId as keyof typeof PIT_STOP_CONFIG.actions];
        const isDisabled = player.energy < actionConfig.cost || (actionId === 'scrub' && !specialCondition);

        return (
            <button
                onClick={() => onAction(actionId)}
                disabled={isDisabled}
                className="p-3 sm:p-4 bg-star-purple rounded-lg text-center transition-colors active:bg-nebula-pink sm:hover:bg-nebula-pink disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-between"
                aria-label={`${actionId}: ${actionConfig.description}. Cost: ${actionConfig.cost} energy`}
            >
                <div>
                    <p className="text-2xl sm:text-3xl mb-1" aria-hidden="true">{actionConfig.icon}</p>
                    <p className="text-base sm:text-xl font-bold">{actionId.charAt(0).toUpperCase() + actionId.slice(1)}</p>
                    <p className="text-xs sm:text-sm mb-2 h-8 sm:h-10 line-clamp-2">{actionConfig.description}</p>
                </div>
                <div>
                    <p className="text-xl sm:text-2xl font-bold text-solar-orange">{actionConfig.cost > 0 ? `${actionConfig.cost}⚡` : <span className="text-hyper-green">+2⚡</span>}</p>
                    {actionId === 'scrub' && specialCondition && <p className="mt-1 text-[10px] sm:text-xs">Clear: {getStatusIcon(specialCondition.type)} {specialCondition.type}</p>}
                </div>
            </button>
        );
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 animate-fade-in overflow-y-auto" role="region" aria-label="Pit Stop">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 pitstop-grid my-auto">
                {/* Left Panel: Standings */}
                <div className="md:col-span-1 glass-panel p-4 sm:p-6 flex flex-col">
                    <h2 className="text-xl sm:text-2xl font-bold text-center border-b-2 border-star-purple/50 pb-2 mb-3 sm:mb-4 text-solar-orange">STANDINGS</h2>
                    <div className="space-y-3 overflow-y-auto">
                        {sortedPlayers.map((player, index) => (
                            <div key={player.id} className="p-2 rounded-lg flex items-center bg-cosmic-blue/50">
                                <div className="text-xl font-bold w-10 text-center" style={{ color: player.color }}>{index + 1}.</div>
                                <div className="flex-grow">
                                    <h3 className="font-semibold" style={{ color: player.color }}>{player.name}</h3>
                                </div>
                                <div className="text-lg font-bold font-mono">{player.position.toFixed(1)}%</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center Panel: Actions */}
                <div className="md:col-span-2 glass-panel p-4 sm:p-6 flex flex-col">
                    <h1 className="text-2xl sm:text-4xl font-black text-center text-hyper-green tracking-tighter">PIT STOP</h1>
                    <p className="text-center text-gray-300 mb-3 sm:mb-4 text-sm">Spend Energy to gain an advantage.</p>
                    <div className="text-center bg-cosmic-blue/50 p-2 sm:p-3 rounded-lg mb-4 sm:mb-6">
                        <p className="text-xs sm:text-sm uppercase text-galaxy-cyan tracking-wider">Available Energy</p>
                        <p className="text-3xl sm:text-5xl font-black text-hyper-green" aria-label={`${humanPlayer.energy} energy available`}>{humanPlayer.energy}<span className="text-lg sm:text-2xl ml-1">⚡</span></p>
                        {humanPlayer.statuses.length > 0 && (
                            <div className="flex justify-center gap-2 mt-2">
                                {humanPlayer.statuses.map((s, i) => (
                                    <span key={i} className="text-xs bg-white/10 px-2 py-0.5 rounded-full" title={s.type}>{getStatusIcon(s.type)} {s.type}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-4 flex-grow">
                        <ActionButton actionId="scrub" onAction={handleAction} player={humanPlayer} specialCondition={negativeStatus} />
                        <ActionButton actionId="tuneUp" onAction={handleAction} player={humanPlayer} />
                        <ActionButton actionId="analyze" onAction={handleAction} player={humanPlayer} />
                        <ActionButton actionId="recharge" onAction={handleAction} player={humanPlayer} />
                    </div>
                </div>
            </div>
        </div>
    );
};
