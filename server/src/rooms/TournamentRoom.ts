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
import {
  saveTournamentBracket,
  loadTournamentBracket,
  deleteTournamentBracket,
} from '../services/tournamentRepository';
import { verifyAuthToken, validateUserIdClaim } from '../auth/verifyToken';

const TICK_MS = 3000;
const SINGLE_REPORT_TIMEOUT_MS = 30_000;

export class TournamentRoom extends Room {
  bracket: TournamentBracket | null = null;
  participants: Map<string, TournamentParticipant> = new Map();
  pendingMatches: Map<string, { matchId: string; roomCode: string }> = new Map();
  tickInterval: ReturnType<typeof setInterval> | null = null;
  /** Pending result reports: matchId -> (sessionId -> won) */
  pendingResultReports: Map<string, Map<string, boolean>> = new Map();
  /** Timestamp when the first report arrived for a matchId, used to enforce the 30s grace period. */
  firstReportTimestamps: Map<string, number> = new Map();

  onCreate(options: { name?: string; size?: 4 | 8 | 16; bracketId?: string }) {
    const size = options.size === 8 || options.size === 16 ? options.size : 4;
    this.bracket = {
      id: options.bracketId || this.roomId,
      name: options.name ?? 'Tournament',
      size,
      rounds: [],
      currentRound: 0,
      participants: [],
    };

    if (options.bracketId) {
      loadTournamentBracket(options.bracketId)
        .then((restored) => {
          if (restored && this.bracket && this.bracket.rounds.length === 0) {
            this.bracket = restored;
            for (const p of restored.participants) {
              this.participants.set(p.id, p);
            }
            this.broadcastBracket();
          }
        })
        .catch((err) => {
          console.error('[TournamentRoom] Failed to restore bracket:', err);
        });
    }

    this.tickInterval = setInterval(() => this.processRound(), TICK_MS);

    this.onMessage(ClientMessages.JOIN_TOURNAMENT, () => {
      this.broadcastBracket();
    });

    this.onMessage(ClientMessages.LEAVE_TOURNAMENT, (client: Client) => {
      this.onLeave(client);
    });

    this.onMessage(ClientMessages.REPORT_TOURNAMENT_RESULT, (client: Client, data: { matchId: string; won: boolean }) => {
      if (!this.bracket || !data || typeof data.matchId !== 'string' || typeof data.won !== 'boolean') return;
      const currentRound = this.bracket.rounds[this.bracket.currentRound];
      if (!currentRound) return;

      const match = currentRound.matches.find(m => m.matchId === data.matchId);
      if (!match || match.isComplete) return;

      // Verify the sender is a participant in this match
      if (!match.participants.includes(client.sessionId)) return;

      if (!this.pendingResultReports) {
        this.pendingResultReports = new Map();
      }
      if (!this.firstReportTimestamps) {
        this.firstReportTimestamps = new Map();
      }

      if (!this.pendingResultReports.has(data.matchId)) {
        this.pendingResultReports.set(data.matchId, new Map());
        this.firstReportTimestamps.set(data.matchId, Date.now());
      }
      const reports = this.pendingResultReports.get(data.matchId)!;
      reports.set(client.sessionId, data.won);

      // For a 2-player match, wait for both reports to agree (or 30s timeout if opponent disconnected).
      if (reports.size < match.participants.length) {
        return;
      }

      const reporters = [...reports.entries()];
      const [r1, r2] = reporters;
      const p1Claim = r1[1];
      const p2Claim = r2[1];

      if (p1Claim === p2Claim) {
        console.warn(`[TournamentRoom] Result conflict for match ${data.matchId}: both reported ${p1Claim ? 'won' : 'lost'}`);
        this.pendingResultReports.delete(data.matchId);
        this.firstReportTimestamps.delete(data.matchId);
        return;
      }

      const winnerId = p1Claim ? r1[0] : r2[0];
      this.completeMatch(currentRound, match, winnerId);
    });
  }

  async onAuth(client: Client, options: RoomConfig): Promise<boolean> {
    const identity = await verifyAuthToken(options?.idToken);
    if (!identity) return false;
    if (!validateUserIdClaim(options?.userId, identity.uid)) return false;
    (client as any).verifiedUid = identity.uid;
    return true;
  }

  /**
   * Authoritative server-to-server callback invoked by a child ConfluxRoom when a match finishes.
   */
  public onChildMatchFinished(payload: {
    matchId: string;
    winnerSessionId?: string;
    winnerUserId?: string;
    winnerName?: string;
  }) {
    if (!this.bracket || !payload?.matchId) return;
    const currentRound = this.bracket.rounds[this.bracket.currentRound];
    if (!currentRound) return;
    const match = currentRound.matches.find(m => m.matchId === payload.matchId);
    if (!match || match.isComplete) return;

    // Resolve the winning tournament participant ID
    let winnerParticipantId: string | undefined;
    if (payload.winnerSessionId && match.participants.includes(payload.winnerSessionId)) {
      winnerParticipantId = payload.winnerSessionId;
    } else if (payload.winnerUserId) {
      const byUid = match.participants.find(pid => this.participants.get(pid)?.userId === payload.winnerUserId);
      if (byUid) winnerParticipantId = byUid;
    }
    if (!winnerParticipantId && payload.winnerName) {
      const byName = match.participants.find(pid => this.participants.get(pid)?.name === payload.winnerName);
      if (byName) winnerParticipantId = byName;
    }

    if (winnerParticipantId) {
      this.completeMatch(currentRound, match, winnerParticipantId);
    }
  }

  private completeMatch(currentRound: TournamentRound, match: TournamentMatch, winnerId: string) {
    match.winner = winnerId;
    match.isComplete = true;

    this.pendingResultReports?.delete(match.matchId);
    this.firstReportTimestamps?.delete(match.matchId);

    currentRound.isComplete = currentRound.matches.every(m => m.isComplete);
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

    const verifiedUid = (client as any).verifiedUid as string | undefined;
    const rawName = typeof options?.playerName === 'string' ? options.playerName.trim() : '';
    const participant: TournamentParticipant = {
      id: client.sessionId,
      name: rawName.slice(0, 20) || `Pilot ${this.bracket.participants.length + 1}`,
      avatarId: options?.avatarId || '🚀',
      userId: verifiedUid ?? options?.userId,
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

    // Timeout handling: only resolve a single pending report AFTER the full 30s grace period has elapsed.
    if (currentRound && this.pendingResultReports) {
      const now = Date.now();
      for (const match of currentRound.matches) {
        if (match.isComplete) continue;
        const reports = this.pendingResultReports.get(match.matchId);
        if (!reports || reports.size !== 1) continue;

        const firstReportedAt = this.firstReportTimestamps?.get(match.matchId);
        // Never resolve a single report before SINGLE_REPORT_TIMEOUT_MS (30s) has elapsed
        if (typeof firstReportedAt !== 'number' || now - firstReportedAt < SINGLE_REPORT_TIMEOUT_MS) {
          continue;
        }

        const [reporterId, won] = [...reports.entries()][0];
        if (won && match.participants.includes(reporterId)) {
          console.log(`[TournamentRoom] Accepting single report after 30s timeout for match ${match.matchId}: ${reporterId} won`);
          this.completeMatch(currentRound, match, reporterId);
        }
      }
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
        const allowedParticipantIds: string[] = [];
        for (const pid of match.participants) {
          allowedParticipantIds.push(pid);
          const p = this.participants.get(pid);
          if (p?.userId) allowedParticipantIds.push(p.userId);
          if (p?.name) allowedParticipantIds.push(p.name);
        }
        const room = await matchMaker.createRoom(RoomNames.MATCH, {
          isPrivate: true,
          autoStart: true,
          tournamentMatch: true,
          tournamentRoomId: this.roomId,
          tournamentMatchId: match.matchId,
          allowedParticipantIds,
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
      // Tournament complete — delete from Firestore (fire-and-forget)
      deleteTournamentBracket(this.bracket.id).catch(err => {
        console.error('[TournamentRoom] Failed to delete completed bracket:', err);
      });
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
    if (!this.bracket.champion) {
      // Persist active bracket to Firestore (non-blocking)
      saveTournamentBracket(this.bracket).catch(err => {
        console.error('[TournamentRoom] Failed to persist bracket:', err);
      });
    }
  }
}
