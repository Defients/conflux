/**
 * server/src/rooms/TournamentRoom.ts
 *
 * Colyseus room for managing single-elimination tournament brackets.
 * Pairs players into matches, spawns ConfluxRoom instances per match,
 * advances winners, and broadcasts bracket updates.
 */

import { Room, Client, matchMaker } from 'colyseus';
import { ServerMessages, ClientMessages, RoomNames } from '../../../shared/protocol';
import {
  TournamentBracket, TournamentRound, TournamentMatch,
  TournamentParticipant, RoomConfig,
} from '../../../shared/types';

const TICK_MS = 3000;

export class TournamentRoom extends Room {
  bracket: TournamentBracket | null = null;
  participants: Map<string, TournamentParticipant> = new Map();
  pendingMatches: Map<string, { matchId: string; roomCode: string }> = new Map();
  tickInterval: ReturnType<typeof setInterval> | null = null;

  onCreate(options: { name?: string; size?: 4 | 8 | 16 }) {
    const size = options.size ?? 4;
    this.bracket = {
      id: this.roomId,
      name: options.name ?? 'Tournament',
      size,
      rounds: [],
      currentRound: 0,
      participants: [],
    };
    this.tickInterval = setInterval(() => this.processRound(), TICK_MS);

    this.onMessage(ClientMessages.JOIN_TOURNAMENT, (client: Client) => {
      this.broadcastBracket();
    });

    this.onMessage(ClientMessages.LEAVE_TOURNAMENT, (client: Client) => {
      this.onLeave(client);
    });

    this.onMessage(ClientMessages.REPORT_TOURNAMENT_RESULT, (client: Client, data: { matchId: string; won: boolean }) => {
      if (!this.bracket) return;
      const currentRound = this.bracket.rounds[this.bracket.currentRound];
      if (!currentRound) return;

      const match = currentRound.matches.find(m => m.matchId === data.matchId);
      if (!match || match.isComplete) return;

      // Verify the sender is a participant in this match
      if (!match.participants.includes(client.sessionId)) return;

      if (data.won) {
        match.winner = client.sessionId;
        match.isComplete = true;
      } else {
        // Loser reports — mark the other participant as winner
        const opponentId = match.participants.find(id => id !== client.sessionId);
        if (opponentId) {
          match.winner = opponentId;
          match.isComplete = true;
        }
      }

      // Check if all matches in the round are complete
      currentRound.isComplete = currentRound.matches.every(m => m.isComplete);

      // Mark eliminated participants
      for (const m of currentRound.matches) {
        if (m.isComplete && m.winner) {
          for (const pid of m.participants) {
            if (pid !== m.winner) {
              const p = this.participants.get(pid);
              if (p) p.eliminated = true;
            }
          }
        }
      }

      this.broadcastBracket();
    });
  }

  onJoin(client: Client, options: RoomConfig) {
    if (!this.bracket) return;
    if (this.bracket.participants.length >= this.bracket.size) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Tournament is full.' });
      return;
    }
    if (this.bracket.rounds.length > 0) {
      client.send(ServerMessages.ROOM_ERROR, { message: 'Tournament already started.' });
      return;
    }

    const participant: TournamentParticipant = {
      id: client.sessionId,
      name: options.playerName,
      avatarId: options.avatarId,
      userId: options.userId,
      seedRank: this.bracket.participants.length + 1,
      eliminated: false,
    };

    this.bracket.participants.push(participant);
    this.participants.set(client.sessionId, participant);

    this.broadcastBracket();
  }

  onLeave(client: Client) {
    if (!this.bracket) return;
    const participant = this.participants.get(client.sessionId);
    if (participant) {
      participant.eliminated = true;
      if (this.bracket.rounds.length === 0) {
        this.bracket.participants = this.bracket.participants.filter(p => p.id !== client.sessionId);
        this.participants.delete(client.sessionId);
      }
    }
    this.broadcastBracket();
  }

  onDispose() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  private processRound() {
    if (!this.bracket) return;
    if (this.bracket.champion) return;

    // Start tournament when full
    if (this.bracket.rounds.length === 0 && this.bracket.participants.length >= this.bracket.size) {
      this.startTournament();
    }

    // Check if current round is complete and advance
    const currentRound = this.bracket.rounds[this.bracket.currentRound];
    if (currentRound && currentRound.isComplete) {
      this.advanceRound();
    }
  }

  private startTournament() {
    if (!this.bracket) return;
    const participants = [...this.bracket.participants].sort((a, b) => a.seedRank - b.seedRank);
    const firstRound = this.createRound(participants, 1);
    this.bracket.rounds.push(firstRound);
    this.broadcastBracket();
    this.startRoundMatches(firstRound);
  }

  private createRound(participants: TournamentParticipant[], roundNumber: number): TournamentRound {
    const matches: TournamentMatch[] = [];
    for (let i = 0; i < participants.length; i += 2) {
      const p1 = participants[i];
      const p2 = participants[i + 1];
      if (!p2) {
        // Bye: auto-advance
        matches.push({
          matchId: `r${roundNumber}-m${i / 2}`,
          participants: [p1.id],
          winner: p1.id,
          isComplete: true,
        });
        continue;
      }
      matches.push({
        matchId: `r${roundNumber}-m${i / 2}`,
        participants: [p1.id, p2.id],
        isComplete: false,
      });
    }
    return { roundNumber, matches, isComplete: false };
  }

  private async startRoundMatches(round: TournamentRound) {
    for (const match of round.matches) {
      if (match.isComplete) continue;
      try {
        const room = await matchMaker.createRoom(RoomNames.MATCH, {
          isPrivate: true,
          autoStart: true,
          tournamentMatch: true,
          expectedPlayers: 2,
        });
        match.roomCode = room.roomId;

        for (const participantId of match.participants) {
          const client = this.clients.getById(participantId);
          if (client) {
            client.send(ServerMessages.TOURNAMENT_MATCH_READY, {
              matchId: match.matchId,
              roomCode: room.roomId,
              message: 'Your tournament match is ready!',
            });
          }
        }
      } catch (err) {
        console.error('[TournamentRoom] Failed to create match room:', err);
      }
    }
  }

  private advanceRound() {
    if (!this.bracket) return;
    const currentRound = this.bracket.rounds[this.bracket.currentRound];
    const winners = currentRound.matches
      .map(m => m.winner)
      .filter((w): w is string => w !== undefined);

    if (winners.length === 1) {
      this.bracket.champion = winners[0];
      const championParticipant = this.participants.get(this.bracket.champion);
      this.broadcast(ServerMessages.TOURNAMENT_CHAMPION, {
        championId: this.bracket.champion,
        championName: championParticipant?.name ?? 'Unknown',
      });
      this.broadcastBracket();
      return;
    }

    const winnerParticipants = winners
      .map(id => this.participants.get(id))
      .filter((p): p is TournamentParticipant => p !== undefined);

    const nextRound = this.createRound(winnerParticipants, this.bracket.currentRound + 2);
    this.bracket.rounds.push(nextRound);
    this.bracket.currentRound++;
    this.broadcastBracket();
    this.startRoundMatches(nextRound);
  }

  private broadcastBracket() {
    if (!this.bracket) return;
    this.broadcast(ServerMessages.TOURNAMENT_UPDATE, {
      bracket: this.bracket,
    });
  }
}
