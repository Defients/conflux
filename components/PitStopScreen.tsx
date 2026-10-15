
import React, { useMemo, useState } from 'react';
import { GameState, Player, PlayerStatus, PerformanceDimension } from '../types';
import { PIT_STOP_CONFIG, TILE_MODIFIER_DEFINITIONS } from '../constants';
import { eventRegistry } from '../events/eventRegistry';
import { useSound } from '../hooks/useSound';

export type PitStopAction = 'scrub' | 'tuneUp' | 'analyze' | 'recharge';

interface PitStopScreenProps {
  gameState: GameState;
  onAction: (playerId: number, action: PitStopAction) => void;
  localPlayerId?: number;
}

const DIMENSION_BADGE_COLORS: Record<PerformanceDimension, string> = {
    reaction: 'bg-nebula-pink/20 text-nebula-pink border-nebula-pink/40',
    typing: 'bg-galaxy-cyan/20 text-galaxy-cyan border-galaxy-cyan/40',
    precision: 'bg-hyper-green/20 text-hyper-green border-hyper-green/40',
    memory: 'bg-star-purple/30 text-purple-300 border-purple-400/40',
    rhythm: 'bg-solar-orange/20 text-solar-orange border-solar-orange/40',
    logic: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
};

const getStatusIcon = (type: PlayerStatus['type']) => {
    switch(type) {
        case 'FROZEN': return '❄️';
        case 'BLURRED': return '🌫️';
        case 'SLOWED': return '⏳';
        case 'STUNNED': return '😵';
        case 'SCRAMBLED': return '📡';
        case 'SHIELDED': return '🛡️';
        case 'BOOSTED': return '⚡';
        case 'IMMUNE': return '🪞';
        default: return '❓';
    }
};

export const PitStopScreen: React.FC<PitStopScreenProps> = ({ gameState, onAction, localPlayerId }) => {
    const { players, run, currentTileIndex } = gameState;
    const humanPlayer = useMemo(
        () => (localPlayerId !== undefined ? players.find(p => p.id === localPlayerId) : undefined) ?? players.find(p => !p.isBot),
        [players, localPlayerId]
    );
    const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.position - a.position), [players]);
    const { playSound } = useSound();
    const [analyzedPreview, setAnalyzedPreview] = useState(false);
    
    if (!humanPlayer) return null;
    
    const negativeStatus = humanPlayer.statuses.find(s => s.type !== 'SHIELDED' && s.type !== 'BOOSTED' && s.type !== 'IMMUNE');
    const hasFreeScanner = !!humanPlayer._freeScanner;
    const rechargeGain = 2 + (humanPlayer._rechargeBonus ?? 0);
    const upcomingStageTiles = run.slice(currentTileIndex, currentTileIndex + 4);

    const handleAction = (action: PitStopAction) => {
        playSound('ui-click');
        if (action === 'analyze' && !analyzedPreview) {
            setAnalyzedPreview(true);
            return;
        }
        onAction(humanPlayer.id, action);
    };

    const handleCommitAnalyze = () => {
        playSound('ui-click');
        onAction(humanPlayer.id, 'analyze');
    };

    const ActionButton: React.FC<{ actionId: PitStopAction, onAction: (action: PitStopAction) => void, player: Player, specialCondition?: PlayerStatus }> = ({ actionId, onAction, player, specialCondition }) => {
        const actionConfig = PIT_STOP_CONFIG.actions[actionId as keyof typeof PIT_STOP_CONFIG.actions];
        const effectiveCost = actionId === 'analyze' && hasFreeScanner ? 0 : actionConfig.cost;
        const isDisabled = (actionId !== 'recharge' && player.energy < effectiveCost) || (actionId === 'scrub' && !specialCondition);

        return (
            <button
                onClick={() => onAction(actionId)}
                disabled={isDisabled}
                className="p-3 sm:p-4 bg-star-purple/80 border border-white/10 rounded-xl text-center transition-all active:bg-nebula-pink sm:hover:bg-nebula-pink/80 sm:hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-between"
                aria-label={`${actionId}: ${actionConfig.description}. Cost: ${effectiveCost} energy`}
            >
                <div>
                    <p className="text-2xl sm:text-3xl mb-1" aria-hidden="true">{actionConfig.icon}</p>
                    <p className="text-base sm:text-xl font-bold capitalize">{actionId === 'tuneUp' ? 'Tune Up' : actionId}</p>
                    <p className="text-xs sm:text-sm text-gray-200 mb-2 h-8 sm:h-10 line-clamp-2">{actionConfig.description}</p>
                </div>
                <div>
                    {actionId === 'recharge' ? (
                        <p className="text-xl sm:text-2xl font-bold text-hyper-green">+{rechargeGain}⚡</p>
                    ) : effectiveCost === 0 ? (
                        <p className="text-sm sm:text-base font-black text-galaxy-cyan uppercase">FREE (Scanner)</p>
                    ) : (
                        <p className="text-xl sm:text-2xl font-bold text-solar-orange">{effectiveCost}⚡</p>
                    )}
                    {actionId === 'scrub' && specialCondition && <p className="mt-1 text-[10px] sm:text-xs text-nebula-pink font-bold">Clear: {getStatusIcon(specialCondition.type)} {specialCondition.type}</p>}
                </div>
            </button>
        );
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 animate-fade-in overflow-y-auto" role="region" aria-label="Pit Stop">
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 pitstop-grid my-auto">
                {/* Left Panel: Standings & Tactical Forecast */}
                <div className="md:col-span-1 flex flex-col gap-3 sm:gap-4">
                    <div className="glass-panel p-4 sm:p-5 flex flex-col">
                        <h2 className="text-lg sm:text-xl font-bold text-center border-b border-white/10 pb-2 mb-3 text-solar-orange uppercase tracking-wider">Standings</h2>
                        <div className="space-y-2 overflow-y-auto max-h-48">
                            {sortedPlayers.map((player, index) => (
                                <div key={player.id} className="p-2 rounded-lg flex items-center bg-cosmic-blue/50 border border-white/5">
                                    <div className="text-base font-bold w-8 text-center" style={{ color: player.color }}>{index + 1}.</div>
                                    <div className="flex-grow truncate">
                                        <h3 className="font-semibold text-sm truncate" style={{ color: player.color }}>{player.name}</h3>
                                    </div>
                                    <div className="text-sm font-bold font-mono">{player.position.toFixed(1)}%</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sensor Forecast Panel */}
                    <div className="glass-panel p-4 sm:p-5 flex-grow flex flex-col">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                            <h2 className="text-xs font-black uppercase tracking-widest text-galaxy-cyan">📡 Stage Sensor Forecast</h2>
                            {(analyzedPreview || hasFreeScanner) && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-hyper-green/20 text-hyper-green font-mono font-bold">
                                    {analyzedPreview ? '4/4 DECODED' : 'SCANNER 2/4'}
                                </span>
                            )}
                        </div>
                        <div className="space-y-2">
                            {upcomingStageTiles.map((tile, idx) => {
                                const isRevealed = analyzedPreview || (hasFreeScanner && idx < 2) || ((humanPlayer._sensorScanTiles ?? 0) > idx);
                                const isFogged = tile.modifier === 'FOG_BANK' && !isRevealed;
                                const eventDef = eventRegistry.find(e => e.id === tile.eventId);
                                const modDef = tile.modifier ? TILE_MODIFIER_DEFINITIONS[tile.modifier] : null;

                                return (
                                    <div
                                        key={tile.tileIndex}
                                        className={`p-2.5 rounded-lg border transition-all ${
                                            isRevealed
                                                ? 'bg-galaxy-cyan/10 border-galaxy-cyan/40'
                                                : isFogged
                                                ? 'bg-purple-950/30 border-nebula-pink/30'
                                                : 'bg-black/30 border-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-mono text-gray-400">TILE {currentTileIndex + idx + 1}</span>
                                            <span className="text-xs font-mono text-solar-orange">
                                                {isFogged ? '???' : '★'.repeat(tile.difficulty).padEnd(3, '☆')}
                                            </span>
                                        </div>
                                        {isRevealed && eventDef ? (
                                            <div className="mt-1">
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-sm font-bold text-white truncate">{eventDef.displayName}</span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold ${DIMENSION_BADGE_COLORS[eventDef.performanceDimension]}`}>
                                                        {eventDef.performanceDimension}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-gray-300 mt-0.5">{eventDef.interactionHint} • {eventDef.scoringHint}</p>
                                            </div>
                                        ) : isFogged ? (
                                            <div className="mt-1 text-xs text-nebula-pink font-mono">🌫️ FOG BANK — Signal Masked</div>
                                        ) : (
                                            <div className="mt-1 text-xs text-gray-500 font-mono italic">Encrypted — Use Analyze to decode</div>
                                        )}
                                        {modDef && !isFogged && (
                                            <div className="mt-1 text-[10px] text-galaxy-cyan flex items-center gap-1">
                                                <span>{modDef.icon}</span>
                                                <span>{modDef.description}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Center Panel: Actions */}
                <div className="md:col-span-2 glass-panel p-4 sm:p-6 flex flex-col">
                    <h1 className="text-2xl sm:text-4xl font-black text-center text-hyper-green tracking-tighter">PIT STOP</h1>
                    <p className="text-center text-gray-300 mb-3 sm:mb-4 text-sm">Spend Energy to gain a tactical advantage for the next 4 tiles.</p>
                    <div className="text-center bg-cosmic-blue/50 p-2 sm:p-3 rounded-lg mb-4 sm:mb-6 border border-white/5">
                        <p className="text-xs sm:text-sm uppercase text-galaxy-cyan tracking-wider">Available Energy</p>
                        <p className="text-3xl sm:text-5xl font-black text-hyper-green" aria-label={`${humanPlayer.energy} energy available`}>
                            {analyzedPreview && !hasFreeScanner ? Math.max(0, humanPlayer.energy - PIT_STOP_CONFIG.actions.analyze.cost) : humanPlayer.energy}
                            <span className="text-lg sm:text-2xl ml-1">⚡</span>
                        </p>
                        {humanPlayer.statuses.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-2 mt-2">
                                {humanPlayer.statuses.map((s, i) => (
                                    <span key={i} className="text-xs bg-white/10 px-2 py-0.5 rounded-full" title={s.type}>{getStatusIcon(s.type)} {s.type} ({s.duration}t)</span>
                                ))}
                            </div>
                        )}
                    </div>

                    {analyzedPreview ? (
                        <div className="flex-grow flex flex-col items-center justify-center bg-galaxy-cyan/5 border border-galaxy-cyan/30 rounded-xl p-6 text-center space-y-4 animate-fade-in">
                            <div className="text-4xl" aria-hidden="true">📊</div>
                            <h3 className="text-xl sm:text-2xl font-black text-galaxy-cyan uppercase tracking-wide">Telemetry Decoded</h3>
                            <p className="text-sm text-gray-300 max-w-md">
                                All 4 upcoming circuit tiles have been revealed in your Stage Sensor Forecast and HUD Sensor Log, piercing any Fog Banks.
                            </p>
                            <button
                                onClick={handleCommitAnalyze}
                                className="w-full max-w-xs py-4 bg-gradient-to-r from-galaxy-cyan to-hyper-green text-cosmic-blue font-black text-lg rounded-xl shadow-lg active:scale-95 transition-all uppercase tracking-wider"
                                aria-label="Confirm analysis and return to race"
                            >
                                Launch Next Stage →
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:gap-4 flex-grow">
                            <ActionButton actionId="scrub" onAction={handleAction} player={humanPlayer} specialCondition={negativeStatus} />
                            <ActionButton actionId="tuneUp" onAction={handleAction} player={humanPlayer} />
                            <ActionButton actionId="analyze" onAction={handleAction} player={humanPlayer} />
                            <ActionButton actionId="recharge" onAction={handleAction} player={humanPlayer} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
