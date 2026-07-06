import React, { useMemo } from 'react';
import { GameState, PilotProfile } from '../types';
import { MatchSummary } from '../shared/matchSummary';
import { encodeSettings } from '../services/shareService';
import { useSound } from '../hooks/useSound';
import { getDailySeed } from '../shared/dailyChallengeService';
import { ACCOLADE_DEFINITIONS, CORPORATION_DEFINITIONS } from '../constants';
import { RankBadge } from './RankBadge';
import { ratingToTier } from '../shared/rankSystem';


interface ResultsScreenProps {
  profile: PilotProfile;
  gameState: GameState;
  matchSummary: MatchSummary | null;
  /** True while waiting for the server-authored MatchSummary to arrive. */
  summaryPending?: boolean;
  onRematch: () => void;
  onNewRun: () => void;
  onCopySeed: () => void;
  onShareRun: () => void;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = ({ profile, gameState, matchSummary, summaryPending = false, onRematch, onNewRun, onCopySeed, onShareRun }) => {
  const sortedPlayers = useMemo(() => [...gameState.players].sort((a, b) => b.position - a.position), [gameState.players]);
  const { playSound } = useSound();
  const isGauntlet = !!gameState.settings.isGauntlet;
  
  const humanPlayer = useMemo(() => sortedPlayers.find(p => !p.isBot), [sortedPlayers]);
  const rival = useMemo(() => sortedPlayers.find(p => p.isRival), [sortedPlayers]);

  // Derive display values from the canonical MatchSummary
  const totalCp = matchSummary?.cp.totalCp ?? 0;
  const cpBreakdown = matchSummary?.cp.displayText ?? '';
  const newWinStreak = matchSummary?.streakDelta.newStreak ?? profile.winStreak;
  const rivalDefeated = matchSummary?.rivalDelta ? matchSummary.rivalDelta.wins > 0 : false;
  const newlyUnlockedAccolades = matchSummary?.accoladeUnlocks ?? [];
  const contractOutcomes = matchSummary?.contractOutcomes ?? [];
  const isDaily = matchSummary?.isDaily ?? false;

  const copySeedToClipboard = () => {
    playSound('ui-click');
    navigator.clipboard.writeText(gameState.settings.seed);
    onCopySeed();
  };

  const shareRun = () => {
    playSound('ui-click');
    let textToCopy: string;
    if (isDaily && humanPlayer) {
        textToCopy = `I conquered the Conflux Circuit Daily Challenge for ${getDailySeed()} with a final position of ${humanPlayer.position.toFixed(1)}%! #ConfluxCircuit #DailyChallenge`;
    } else {
        const encoded = encodeSettings(gameState.settings);
        textToCopy = `${window.location.origin}${window.location.pathname}#cc=${encoded}`;
    }
    navigator.clipboard.writeText(textToCopy);
    onShareRun();
  };
  
  const handleRematchClick = () => {
    playSound('ui-click');
    onRematch();
  };

  const handleNewRunClick = () => {
    playSound('ui-click');
    onNewRun();
  };

  const renderStars = (stars: number) => {
    if (stars === 4) return <span className="text-nebula-pink drop-shadow-[0_0_5px_rgba(214,79,138,0.8)]" aria-label="4 stars">★★★★</span>;
    return <span aria-label={`${stars} of 3 stars`}>{'★'.repeat(stars).padEnd(3, '☆')}</span>;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-2 sm:p-4 animate-fade-in overflow-y-auto" role="region" aria-label="Race Results">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 my-auto results-grid">
        
        {/* Title & Header */}
        <div className="md:col-span-12 text-center mb-2 sm:mb-4">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-tighter mb-2">
                {isGauntlet ? 'GAUNTLET OVER' : isDaily ? 'DAILY COMPLETE' : 'RACE FINISHED'}
            </h1>
            <div className="inline-block bg-white/10 rounded-full px-3 sm:px-4 py-1 text-xs sm:text-sm font-mono text-gray-300">
                SEED: {gameState.settings.seed}
            </div>
        </div>

        {/* Leaderboard */}
        <div className="md:col-span-8 flex flex-col gap-2 sm:gap-3">
            {sortedPlayers.map((player, index) => {
                const isHuman = !player.isBot;
                return (
                    <div 
                        key={player.id} 
                        className={`p-2.5 sm:p-4 rounded-xl flex items-center border relative overflow-hidden animate-slide-in-up
                                    ${isHuman ? 'bg-gradient-to-r from-cosmic-blue to-white/5 border-galaxy-cyan shadow-[0_0_20px_rgba(0,223,252,0.1)]' : 
                                      player.isRival ? 'bg-black/40 border-nebula-pink/50' : 'bg-black/30 border-white/10'}`}
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className="w-8 sm:w-12 text-center font-black text-xl sm:text-2xl italic">
                            {index === 0 ? <span className="opacity-100">🥇</span> : index === 1 ? <span className="opacity-80">🥈</span> : index === 2 ? <span className="opacity-70">🥉</span> : <span className="opacity-40">#{index + 1}</span>}
                        </div>
                        
                        <div className="w-1 h-10 sm:h-12 mx-2 sm:mx-4 rounded-full" style={{backgroundColor: player.color}}></div>

                        <div className="flex-grow min-w-0">
                            <div className="flex items-baseline gap-1 sm:gap-2">
                                <h3 className={`text-base sm:text-xl font-bold truncate ${isHuman ? 'text-galaxy-cyan text-glow' : 'text-gray-200'}`}>
                                    {player.name}
                                </h3>
                                {player.isBot && !player.isRival && <span className="text-[10px] sm:text-xs text-gray-500 uppercase hidden sm:inline">{player.personality}</span>}
                            </div>
                            <div className="flex gap-0.5 sm:gap-1 mt-1 opacity-70 text-[10px] sm:text-xs overflow-hidden">
                                {player.tileHistory.slice(-6).map(({ tileIndex, stars }) => (
                                    <span key={tileIndex}>{renderStars(stars)}</span>
                                ))}
                            </div>
                        </div>

                        <div className="text-right min-w-[70px] sm:min-w-[100px]">
                            <div className="text-xl sm:text-3xl font-black font-mono text-white">{player.position.toFixed(1)}%</div>
                            {isHuman && <div className="text-[10px] sm:text-xs text-hyper-green font-bold">{index === 0 ? '🥇 WINNER' : `#${index + 1} FINISH`}</div>}
                        </div>
                    </div>
                );
            })}
            
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
                <button onClick={handleRematchClick} className="py-3 sm:py-4 bg-star-purple text-white font-bold rounded-lg active:bg-nebula-pink sm:hover:bg-nebula-pink transition-colors text-sm sm:text-base" aria-label="Rematch with same settings">
                    REMATCH
                </button>
                <button onClick={handleNewRunClick} className="py-3 sm:py-4 bg-white/10 text-white font-bold rounded-lg active:bg-white/20 sm:hover:bg-white/20 transition-colors text-sm sm:text-base" aria-label="Return to hangar lobby">
                    RETURN TO HANGAR
                </button>
            </div>
        </div>

        {/* Sidebar Debrief */}
        <div className="md:col-span-4 flex flex-col gap-3 sm:gap-4">
            
            {/* Performance Card */}
            <div className="glass-panel p-4 sm:p-6">
                <h2 className="text-xs font-bold text-galaxy-cyan uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Performance Review</h2>

                {summaryPending && (
                    <div className="mb-6 space-y-3 animate-pulse" aria-label="Computing rewards">
                        <div className="h-4 bg-white/10 rounded w-3/4" />
                        <div className="h-8 bg-white/10 rounded w-1/2" />
                        <div className="h-4 bg-white/10 rounded w-full" />
                        <p className="text-center text-xs text-gray-500 pt-1">Computing rewards…</p>
                    </div>
                )}
                
                {isGauntlet && humanPlayer && (
                    <div className="mb-6 space-y-3">
                        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-center">
                            <div className="text-xs text-red-400 uppercase tracking-widest mb-1">Tiles Survived</div>
                            <div className="text-5xl font-black text-white">{humanPlayer.tileHistory.length}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/30 rounded p-3 text-center">
                                <div className="text-[10px] text-gray-400 uppercase">Avg Stars</div>
                                <div className="text-xl font-bold text-solar-orange">{(humanPlayer.tileHistory.reduce((s, h) => s + h.stars, 0) / Math.max(1, humanPlayer.tileHistory.length)).toFixed(1)}</div>
                            </div>
                            <div className="bg-black/30 rounded p-3 text-center">
                                <div className="text-[10px] text-gray-400 uppercase">High Score</div>
                                <div className="text-xl font-bold text-galaxy-cyan">{profile.gauntletHighScore}</div>
                            </div>
                        </div>
                    </div>
                )}

                {!isGauntlet && humanPlayer && (
                    <div className="mb-6">
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-gray-400">Total Earnings</span>
                            <span className="text-3xl font-bold text-hyper-green">+{totalCp} CP</span>
                        </div>
                        <div className="text-xs text-gray-500 bg-black/20 p-2 rounded">{cpBreakdown}</div>
                    </div>
                )}

                {!isGauntlet && contractOutcomes.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-galaxy-cyan uppercase tracking-widest mb-3">Contracts</h3>
                        <div className="space-y-2">
                            {contractOutcomes.map((c, i) => {
                                const corp = CORPORATION_DEFINITIONS[c.corporationId];
                                return (
                                    <div key={i} className={`p-3 rounded-lg border ${c.allComplete ? 'bg-hyper-green/10 border-hyper-green/30' : 'bg-black/20 border-white/5'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-bold">{corp?.icon} {corp?.name}</span>
                                            <span className={`text-xs font-bold ${c.allComplete ? 'text-hyper-green' : 'text-gray-500'}`}>{c.allComplete ? `+${c.cpReward} CP` : 'FAILED'}</span>
                                        </div>
                                        <div className="space-y-1">
                                            {c.objectives.map((obj, j) => (
                                                <div key={j} className="flex items-center gap-2 text-xs">
                                                    <span>{obj.isComplete ? '\u2705' : '\u274c'}</span>
                                                    <span className={obj.isComplete ? 'text-gray-300' : 'text-gray-500'}>{obj.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {rival && (
                    <div className={`p-4 rounded border ${rivalDefeated ? 'bg-hyper-green/10 border-hyper-green/30' : 'bg-nebula-pink/10 border-nebula-pink/30'}`}>
                        <div className="text-xs uppercase font-bold mb-1 opacity-70">{rivalDefeated ? 'Victory vs Rival' : 'Defeat vs Rival'}</div>
                        <div className="text-lg font-bold">{rival.name}</div>
                        <div className="text-sm mt-1">New Streak: <span className="text-white font-mono">{newWinStreak}</span></div>
                    </div>
                )}

                {/* v5.0: Ranked rating change */}
                {matchSummary?.ratingChange != null && matchSummary.ratingChange !== 0 && (
                    <div className={`p-4 rounded border ${matchSummary.ratingChange > 0 ? 'bg-hyper-green/10 border-hyper-green/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="text-xs uppercase font-bold mb-1 opacity-70">Ranked Rating</div>
                        <div className="flex items-center justify-between">
                            <span className={`text-2xl font-black ${matchSummary.ratingChange > 0 ? 'text-hyper-green' : 'text-red-400'}`}>
                                {matchSummary.ratingChange > 0 ? '+' : ''}{matchSummary.ratingChange} RP
                            </span>
                            {matchSummary.newRating != null && (
                                <RankBadge
                                    rank={{
                                        rating: matchSummary.newRating,
                                        tier: matchSummary.newTier ?? ratingToTier(matchSummary.newRating),
                                        wins: profile.rank?.wins ?? 0,
                                        losses: profile.rank?.losses ?? 0,
                                        peakRating: profile.rank?.peakRating ?? matchSummary.newRating,
                                    }}
                                    size="medium"
                                    showRating
                                    showRecord
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Unlocks & Actions */}
            <div className="glass-panel p-4 sm:p-6 flex-grow flex flex-col">
                {newlyUnlockedAccolades.length > 0 ? (
                    <div className="mb-6">
                        <h2 className="text-xs font-bold text-solar-orange uppercase tracking-widest mb-2">New Accolades!</h2>
                        {newlyUnlockedAccolades.map((id, i) => (
                            <div key={id} className="flex items-center gap-2 text-sm text-white bg-solar-orange/20 p-2 rounded mb-1 animate-slide-in-up border border-solar-orange/30" style={{ animationDelay: `${i * 150}ms` }}>
                                <span className="text-lg">{ACCOLADE_DEFINITIONS[id].icon}</span>
                                <span className="font-bold">{ACCOLADE_DEFINITIONS[id].name}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mb-6 text-center text-gray-500 text-sm italic py-4">No new accolades this run.</div>
                )}

                <div className="mt-auto grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-3">
                     <button onClick={shareRun} className="py-3 bg-galaxy-cyan text-cosmic-blue font-bold rounded active:opacity-80 sm:hover:opacity-90 transition-opacity text-sm uppercase tracking-wider" aria-label="Share race results">
                        Share Results
                    </button>
                    <button onClick={copySeedToClipboard} className="py-3 bg-gray-700 text-gray-300 font-bold rounded active:bg-gray-600 sm:hover:bg-gray-600 transition-colors text-sm uppercase tracking-wider" aria-label="Copy seed to clipboard">
                        Copy Seed
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
