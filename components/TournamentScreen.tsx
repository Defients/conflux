/**
 * components/TournamentScreen.tsx
 *
 * Tournament mode screen: join a tournament, view bracket, join matches.
 * Uses shared TournamentBracket type from shared/types.ts.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { TournamentBracket, TournamentMatch, TournamentParticipant, PilotProfile, ChassisId } from '../types';
import { CHASSIS_DEFINITIONS } from '../constants';
import { networkService } from '../services/networkService';
import { auth } from '../services/firebase';

interface TournamentScreenProps {
  bracket: TournamentBracket | null;
  onJoinMatch: (matchId: string, roomCode: string) => void;
  onLeave: () => void;
  onBracketUpdate: (bracket: TournamentBracket) => void;
  onChampion: (championName: string) => void;
  profile: PilotProfile | null;
}

export const TournamentScreen: React.FC<TournamentScreenProps> = ({
  bracket,
  onJoinMatch,
  onLeave,
  onBracketUpdate,
  onChampion,
  profile,
}) => {
  const [hasJoined, setHasJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bracketSize, setBracketSize] = useState<4 | 8 | 16>(4);
  const [championName, setChampionName] = useState<string | null>(null);
  const [selectedChassis, setSelectedChassis] = useState<ChassisId>(
    profile?.unlockedChassis?.[0] ?? ChassisId.Standard
  );

  // Listen for tournament updates and match-ready events
  useEffect(() => {
    if (!hasJoined) return;
    const unsub = networkService.setHandlers({
      onTournamentUpdate: (data) => {
        if (data.bracket) {
          onBracketUpdate(data.bracket as TournamentBracket);
        }
      },
      onTournamentMatchReady: (data) => {
        onJoinMatch(data.matchId, data.roomCode);
      },
      onTournamentChampion: (data) => {
        setChampionName(data.championName);
      },
      onRoomError: (message) => {
        setError(message);
        setIsJoining(false);
      },
    });
    return unsub;
  }, [hasJoined, onJoinMatch, onBracketUpdate]);

  // Notify parent when champion is crowned
  useEffect(() => {
    if (championName) {
      onChampion(championName);
    }
  }, [championName, onChampion]);

  const handleJoin = useCallback(async () => {
    if (!profile) return;
    setIsJoining(true);
    setError(null);
    try {
      const currentUser = auth?.currentUser;
      await networkService.joinTournament({
        playerName: profile.name,
        avatarId: profile.avatarId,
        chassisId: selectedChassis,
        userId: currentUser?.uid,
      }, bracketSize);
      setHasJoined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tournament');
    } finally {
      setIsJoining(false);
    }
  }, [profile, selectedChassis, bracketSize]);

  const handleLeave = useCallback(async () => {
    await networkService.leaveTournament();
    setHasJoined(false);
    onLeave();
  }, [onLeave]);

  const unlockedChassis = profile?.unlockedChassis ?? [ChassisId.Standard];

  // Not joined yet — show setup screen
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-amber-950 to-slate-900 text-white p-4 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              className="px-4 py-2 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              onClick={onLeave}
            >
              ← Back
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <span aria-hidden="true">🏆</span> Tournament
            </h1>
            <div className="w-20" />
          </div>

          <div className="glass-panel rounded-xl p-6 space-y-6">
            <p className="text-sm text-gray-300 leading-relaxed">
              Join a single-elimination bracket tournament. When the bracket fills up,
              matches start automatically. Win to advance to the next round!
            </p>

            {/* Bracket Size */}
            <div>
              <label className="block text-sm font-medium mb-2">Bracket Size</label>
              <div className="grid grid-cols-3 gap-2">
                {([4, 8, 16] as const).map(size => (
                  <button
                    key={size}
                    className={`p-3 rounded-lg border font-bold transition-all ${
                      bracketSize === size
                        ? 'border-amber-400 bg-amber-400/10'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                    onClick={() => setBracketSize(size)}
                    aria-pressed={bracketSize === size}
                    aria-label={`${size} players bracket`}
                  >
                    {size} Players
                  </button>
                ))}
              </div>
            </div>

            {/* Chassis Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Chassis</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {unlockedChassis.map(chassisId => {
                  const def = CHASSIS_DEFINITIONS[chassisId];
                  const isSelected = selectedChassis === chassisId;
                  return (
                    <button
                      key={chassisId}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => setSelectedChassis(chassisId)}
                      aria-pressed={isSelected}
                      aria-label={`${def.name} chassis`}
                    >
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="text-lg">{def.icon}</span>
                        <span className="text-xs font-medium">{def.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/40 rounded text-sm text-red-300" role="alert">
                {error}
              </div>
            )}

            <button
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg font-bold text-lg hover:from-amber-400 hover:to-orange-500 transition-all active:scale-95 disabled:opacity-50"
              onClick={handleJoin}
              disabled={isJoining || !profile}
            >
              {isJoining ? 'Joining…' : 'Join Tournament'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Joined — show bracket
  const totalRounds = bracket ? Math.log2(bracket.size) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-amber-950 to-slate-900 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            className="px-4 py-2 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            onClick={handleLeave}
          >
            ← Leave
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span aria-hidden="true">🏆</span> {bracket?.name ?? 'Tournament'}
          </h1>
          <span className="text-sm text-amber-400">
            {bracket ? `Round ${bracket.currentRound + 1} / ${totalRounds}` : ''}
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded text-sm text-red-300" role="alert">
            {error}
          </div>
        )}

        {!bracket || bracket.participants.length === 0 ? (
          <div className="glass-panel rounded-xl p-8 text-center">
            <p className="text-gray-400">Waiting for tournament to start...</p>
            {bracket && (
              <p className="text-sm text-amber-400 mt-2">
                {bracket.participants.length} / {bracket.size} players joined
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Participants */}
            {bracket.rounds.length === 0 && (
              <div className="glass-panel rounded-xl p-4">
                <h3 className="text-sm font-medium mb-3">Participants</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {bracket.participants.map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span aria-hidden="true">{p.avatarId}</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                  ))}
                  {Array.from({ length: bracket.size - bracket.participants.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex items-center gap-2 text-xs text-gray-600">
                      <span>Waiting…</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bracket Rounds */}
            {bracket.rounds.map((round, roundIdx) => (
              <div key={roundIdx} className="glass-panel rounded-xl p-4">
                <h3 className="text-sm font-medium mb-3">
                  {roundIdx === totalRounds - 1 ? 'Final' :
                   roundIdx === totalRounds - 2 ? 'Semifinals' :
                   `Round ${roundIdx + 1}`}
                </h3>
                <div className="space-y-2">
                  {round.matches.map(match => (
                    <TournamentMatchCard
                      key={match.matchId}
                      match={match}
                      participants={bracket.participants}
                      onJoin={onJoinMatch}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Champion */}
            {bracket.champion && (
              <div className="glass-panel rounded-xl p-6 text-center">
                <p className="text-2xl font-bold text-amber-400">🏆 Champion!</p>
                <p className="text-lg mt-2">
                  {bracket.participants.find(p => p.id === bracket.champion)?.name ?? 'Unknown'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Match Card ─────────────────────────────────────────────────────────────

const TournamentMatchCard: React.FC<{
  match: TournamentMatch;
  participants: TournamentParticipant[];
  onJoin: (matchId: string, roomCode: string) => void;
}> = ({ match, participants, onJoin }) => {
  const p1 = participants.find(p => p.id === match.participants[0]);
  const p2 = participants.find(p => p.id === match.participants[1]);
  const winner = match.winner ? participants.find(p => p.id === match.winner) : null;

  const isReady = !match.isComplete && match.roomCode;
  const isInProgress = !match.isComplete && !match.roomCode && match.participants.length === 2;

  return (
    <div className={`p-3 rounded-lg border ${
      match.isComplete ? 'border-green-500/30 bg-green-500/5' :
      isReady ? 'border-amber-400/40 bg-amber-400/5' :
      'border-white/10 bg-white/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-sm ${winner?.id === p1?.id ? 'text-green-400 font-bold' : ''}`}>
            {p1?.name ?? 'TBD'}
          </span>
          <span className="text-xs text-gray-500">vs</span>
          <span className={`text-sm ${winner?.id === p2?.id ? 'text-green-400 font-bold' : ''}`}>
            {p2?.name ?? (match.participants.length === 1 ? 'BYE' : 'TBD')}
          </span>
        </div>
        {isReady && match.roomCode && (
          <button
            className="px-3 py-1 text-xs bg-amber-500/20 border border-amber-500/40 rounded text-amber-300 hover:bg-amber-500/30 transition-colors"
            onClick={() => onJoin(match.matchId, match.roomCode!)}
          >
            Join Match
          </button>
        )}
        {isInProgress && (
          <span className="text-xs text-gray-400">In Progress</span>
        )}
        {match.isComplete && winner && (
          <span className="text-xs text-green-400">Winner: {winner.name}</span>
        )}
      </div>
    </div>
  );
};
