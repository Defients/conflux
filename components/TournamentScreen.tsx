/**
 * components/TournamentScreen.tsx
 *
 * Displays tournament bracket and match status for participants.
 */

import React from 'react';

export interface TournamentMatch {
  matchId: string;
  round: number;
  player1Name: string | null;
  player2Name: string | null;
  winnerName: string | null;
  roomCode: string | null;
  status: 'pending' | 'ready' | 'in_progress' | 'completed';
}

export interface TournamentBracket {
  rounds: TournamentMatch[][];
  currentRound: number;
  totalRounds: number;
  participantCount: number;
}

interface TournamentScreenProps {
  bracket: TournamentBracket | null;
  onJoinMatch: (matchId: string, roomCode: string) => void;
  onLeave: () => void;
}

export const TournamentScreen: React.FC<TournamentScreenProps> = ({
  bracket,
  onJoinMatch,
  onLeave,
}) => {
  if (!bracket) {
    return (
      <div className="tournament-screen">
        <div className="tournament-screen__header">
          <button className="tournament-screen__back" onClick={onLeave}>← Back</button>
          <h2>Tournament</h2>
        </div>
        <div className="tournament-screen__empty">
          <p>Waiting for tournament to start...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tournament-screen">
      <div className="tournament-screen__header">
        <button className="tournament-screen__back" onClick={onLeave}>← Leave</button>
        <h2>Tournament</h2>
        <span className="tournament-screen__round">
          Round {bracket.currentRound + 1} / {bracket.totalRounds}
        </span>
      </div>

      <div className="tournament-screen__bracket">
        {bracket.rounds.map((round, roundIdx) => (
          <div key={roundIdx} className="tournament-round">
            <h3 className="tournament-round__title">
              {roundIdx === bracket.totalRounds - 1 ? 'Final' :
               roundIdx === bracket.totalRounds - 2 ? 'Semifinals' :
               `Round ${roundIdx + 1}`}
            </h3>
            {round.map(match => (
              <div
                key={match.matchId}
                className={`tournament-match tournament-match--${match.status}`}
              >
                <div className="tournament-match__players">
                  <span className={`tournament-match__player ${match.winnerName === match.player1Name ? 'tournament-match__player--winner' : ''}`}>
                    {match.player1Name ?? 'TBD'}
                  </span>
                  <span className="tournament-match__vs">vs</span>
                  <span className={`tournament-match__player ${match.winnerName === match.player2Name ? 'tournament-match__player--winner' : ''}`}>
                    {match.player2Name ?? 'TBD'}
                  </span>
                </div>
                {match.status === 'ready' && match.roomCode && (
                  <button
                    className="tournament-match__join"
                    onClick={() => onJoinMatch(match.matchId, match.roomCode!)}
                  >
                    Join Match
                  </button>
                )}
                {match.status === 'in_progress' && (
                  <span className="tournament-match__status">In Progress</span>
                )}
                {match.status === 'completed' && (
                  <span className="tournament-match__status tournament-match__status--done">
                    Winner: {match.winnerName}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
