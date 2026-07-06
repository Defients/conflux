
import React, { useMemo } from 'react';
import { Player, Tile, Chassis, Anomaly } from '../types';
import { TILE_MODIFIER_DEFINITIONS, CHASSIS_DEFINITIONS } from '../constants';

interface RaceTrackHUDProps {
  players: Player[];
  run: Tile[];
  currentTileIndex: number;
  overdrivingPlayerIds: number[];
  activeAnomaly: Anomaly | null;
}

// --- Sub Components ---

const UpcomingTiles: React.FC<{ run: Tile[], currentTileIndex: number, player: Player }> = React.memo(({ run, currentTileIndex, player }) => {
    const isScrambled = player.statuses.some(s => s.type === 'SCRAMBLED');
    const tileSource = isScrambled ? (player.scrambledTileData || []) : run;
    const nextTiles = tileSource.slice(currentTileIndex + 1, currentTileIndex + 5);

    return (
        <div className={`hidden md:flex flex-col bg-black/40 sm:backdrop-blur-md rounded-xl border border-white/10 p-2 sm:p-3 relative overflow-hidden min-w-[120px] lg:min-w-[160px]`}>
            {isScrambled && <div className="absolute inset-0 bg-nebula-pink/10 animate-pulse pointer-events-none z-10 border border-nebula-pink/50 rounded-xl" />}
            <div className="flex justify-between items-center mb-1 sm:mb-2 border-b border-white/5 pb-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-galaxy-cyan">Sensor Log</h4>
                {isScrambled && <span className="text-[10px] text-nebula-pink font-mono animate-pulse">JAMMED</span>}
            </div>
            
            <div className="flex gap-1 sm:gap-2">
                {nextTiles.map((tile, index) => (
                    <div key={index} className="group relative">
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded border transition-colors ${tile.modifier ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'}`}>
                            {tile.modifier ? (
                                <span className="text-xs sm:text-sm filter drop-shadow-glow">{TILE_MODIFIER_DEFINITIONS[tile.modifier].icon}</span>
                            ) : <span className="text-xs text-gray-600">·</span>}
                        </div>
                        {/* Tooltip — desktop only */}
                        {tile.modifier && (
                            <div className="hidden sm:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[150px] bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                {TILE_MODIFIER_DEFINITIONS[tile.modifier].description}
                            </div>
                        )}
                        <div className="text-[9px] text-center text-gray-500 mt-0.5 font-mono">{tile.difficulty}★</div>
                    </div>
                ))}
                {nextTiles.length < 4 && Array(4 - nextTiles.length).fill(0).map((_, i) => (
                     <div key={`ph-${i}`} className="w-7 h-7 sm:w-8 sm:h-8 bg-black/20 rounded border border-white/5 opacity-30 flex items-center justify-center text-[8px] text-gray-600">END</div>
                ))}
            </div>
        </div>
    );
});

const PlayerMarker = React.memo(({ player, isOverdriving }: { player: Player; isOverdriving: boolean }) => {
    const isStunned = player.statuses.some(s => s.type === 'STUNNED');
    const isFrozen = player.statuses.some(s => s.type === 'FROZEN');
    const isShielded = player.statuses.some(s => s.type === 'SHIELDED');
    const isBoosted = player.statuses.some(s => s.type === 'BOOSTED');
    
    const leftPos = Math.min(100, Math.max(0, player.position));
    const zIndex = player.isBot ? 10 : 20; // Human on top

    return (
        <div
            className={`absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out group`}
            style={{ left: `${leftPos}%`, zIndex, willChange: 'left' }}
        >
            {/* Label Tooltip */}
            <div className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30`}>
                <div className={`px-2 py-1 rounded bg-gray-900 border ${player.isRival ? 'border-nebula-pink' : 'border-white/20'} shadow-lg`}>
                    <div className="text-[10px] font-bold whitespace-nowrap text-white flex items-center gap-1">
                        {player.isRival && <span className="text-nebula-pink">👑</span>}
                        {player.name}
                    </div>
                    <div className="flex gap-1 mt-1 justify-center">
                        {isShielded && <span className="text-[8px]">🛡️</span>}
                        {isBoosted && <span className="text-[8px]">⚡</span>}
                        {isFrozen && <span className="text-[8px]">❄️</span>}
                    </div>
                </div>
                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-900"></div>
            </div>

            {/* Avatar Chip */}
            <div className={`relative w-8 h-8 -ml-4 flex items-center justify-center ${isStunned ? 'animate-shake' : ''}`}>
                
                {/* Effects Rings */}
                {isShielded && <div className="absolute inset-0 rounded-full border border-galaxy-cyan animate-pulse opacity-60"></div>}
                {isOverdriving && <div className="absolute inset-[-4px] rounded-full border-2 border-nebula-pink animate-ping opacity-40"></div>}
                {isBoosted && <div className="absolute -right-2 top-0 text-[10px] animate-bounce">⚡</div>}
                {isFrozen && <div className="absolute inset-0 bg-white/40 rounded-full backdrop-blur-[1px]"></div>}

                {/* Core */}
                <div 
                    className={`w-3 h-3 rotate-45 transform transition-transform group-hover:scale-125 shadow-lg border border-white/20 ${player.isRival ? 'w-4 h-4 border-nebula-pink' : ''}`}
                    style={{ backgroundColor: player.color }}
                />
                
                {/* Rival Crown Indicator on Chip */}
                {player.isRival && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] text-nebula-pink drop-shadow-glow">👑</div>
                )}
            </div>
        </div>
    );
});


export const RaceTrackHUD: React.FC<RaceTrackHUDProps> = ({ players, run, currentTileIndex, overdrivingPlayerIds, activeAnomaly }) => {
  const humanPlayer = players.find(p => !p.isBot);
  const leader = useMemo(() => [...players].sort((a,b) => b.position - a.position)[0], [players]);
  const isWinning = humanPlayer ? leader.id === humanPlayer.id : false;
  const rank = useMemo(() => {
    if (!humanPlayer) return 0;
    return players.filter(p => p.position > humanPlayer.position).length + 1;
  }, [players, humanPlayer]);

  let trackGradient = "from-cosmic-blue via-star-purple to-galaxy-cyan";
  let glowColor = "bg-galaxy-cyan";
  
  if (activeAnomaly?.id === 'WARP_DRIVE') {
      trackGradient = "from-cyan-400 via-blue-500 to-cyan-400";
      glowColor = "bg-cyan-400";
  } else if (activeAnomaly?.id === 'VOID_COLLAPSE') {
      trackGradient = "from-purple-900 via-fuchsia-900 to-purple-900";
      glowColor = "bg-purple-600";
  } else if (activeAnomaly?.id === 'CHRONOS_SHIFT') {
      trackGradient = "from-indigo-500 via-purple-500 to-pink-500";
      glowColor = "bg-pink-500";
  }

  if (!humanPlayer) return null;

  return (
    <div className="glass-panel px-2 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-4 md:gap-6 relative mt-1 sm:mt-2 shadow-2xl border-t border-white/10 track-hud" role="status" aria-label="Race track status">
        
        {/* Rank Indicator — compact on mobile */}
        <div className="flex flex-col items-center justify-center min-w-[36px] sm:min-w-[60px] border-r border-white/10 pr-2 sm:pr-4">
             <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider landscape-hide">Rank</div>
             <div className={`text-xl sm:text-3xl font-black italic ${isWinning ? 'text-hyper-green' : 'text-white'}`} aria-label={`Rank ${rank} of ${players.length}`}>
                {rank}
                <span className="text-[10px] sm:text-sm opacity-50 not-italic">/{players.length}</span>
             </div>
        </div>

        {/* Energy & Lives — compact on mobile */}
        <div className="flex flex-col items-center justify-center min-w-[36px] sm:min-w-[50px] border-r border-white/10 pr-2 sm:pr-4">
            <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider landscape-hide">Energy</div>
            <div className="text-lg sm:text-2xl font-black text-solar-orange font-mono" aria-label={`${humanPlayer.energy} energy`}>{humanPlayer.energy}<span className="text-[10px] sm:text-xs">⚡</span></div>
            {humanPlayer.lives !== undefined && (
                <div className="mt-0.5 sm:mt-1">
                    <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider hidden sm:block">Lives</div>
                    <div className="text-sm sm:text-lg font-bold text-nebula-pink" aria-label={`${humanPlayer.lives} lives remaining`}>{'❤️'.repeat(humanPlayer.lives)}</div>
                </div>
            )}
        </div>

        {/* Track Visualization */}
        <div className="flex-grow relative h-16 flex items-center">
            {/* Track Rail */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-800 w-full overflow-visible">
                 <div className={`absolute inset-0 bg-gradient-to-r ${trackGradient} opacity-50`}></div>
                 {/* Glow Line */}
                 <div className={`absolute inset-0 ${glowColor} blur-[2px] opacity-30`}></div>
            </div>
            
            {/* Start Node */}
             <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3 bg-gray-600" />

            {/* Checkpoints */}
            {run.map((tile, i) => {
                const pos = ((i + 1) / run.length) * 100;
                const isPassed = i < currentTileIndex;
                return (
                    <div 
                        key={i} 
                        className={`absolute top-1/2 -translate-y-1/2 w-[2px] h-2 transition-colors duration-500 ${isPassed ? 'bg-hyper-green shadow-[0_0_5px_#4dffaf]' : 'bg-gray-700'}`}
                        style={{ left: `${pos}%` }} 
                    />
                );
            })}
            
             {/* Finish Line */}
             <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-8 border-x-2 border-white/20 bg-black/50 flex flex-col justify-center gap-[1px] skew-x-[-12deg]">
                {[1,2,3,4].map(n => <div key={n} className="h-[1px] w-full bg-white/30"></div>)}
             </div>

            {/* Player Entities */}
            {players.map(player => (
                <PlayerMarker 
                    key={player.id}
                    player={player}
                    isOverdriving={overdrivingPlayerIds.includes(player.id)}
                />
            ))}
        </div>

        {/* Progress Text — visible on small screens when track is too compressed */}
        <div className="sm:hidden font-mono text-xs text-gray-400 min-w-[32px] text-right" aria-label={`Position ${Math.min(100, humanPlayer.position).toFixed(0)} percent`}>
            {Math.min(100, humanPlayer.position).toFixed(0)}%
        </div>

        {/* Scanner/Upcoming */}
        <UpcomingTiles run={run} currentTileIndex={currentTileIndex} player={humanPlayer} />
    </div>
  );
};
