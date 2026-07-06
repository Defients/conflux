/**
 * server/src/rooms/MatchmakingRoom.ts
 *
 * Colyseus room acting as a matchmaking queue.
 * Groups players by rating proximity and creates ConfluxRoom instances.
 */

import { Room, Client, matchMaker } from 'colyseus';
import { ClientMessages, ServerMessages } from '../../../shared/protocol';
import { RoomConfig } from '../../../shared/types';
import { DEFAULT_RATING } from '../../../shared/rankSystem';

interface QueuePlayer {
  sessionId: string;
  config: RoomConfig;
  rating: number;
  joinedAt: number;
  queueType: 'ranked' | 'unranked';
}

const QUEUE_TICK_MS = 2000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const RATING_TOLERANCE_INITIAL = 100;
const RATING_TOLERANCE_MAX = 400;
const RATING_TOLERANCE_GROWTH_PER_SEC = 20;
const QUEUE_TIMEOUT_MS = 60_000;

export class MatchmakingRoom extends Room {
  queue: QueuePlayer[] = [];
  tickInterval: ReturnType<typeof setInterval> | null = null;

  queueType: 'ranked' | 'unranked' = 'unranked';

  onCreate(options: { queueType?: 'ranked' | 'unranked' }) {
    this.queueType = options.queueType ?? 'unranked';
    this.tickInterval = setInterval(() => this.processQueue(), QUEUE_TICK_MS);
  }

  onJoin(client: Client, options: RoomConfig) {
    const rating = options.rating ?? DEFAULT_RATING;
    const queuePlayer: QueuePlayer = {
      sessionId: client.sessionId,
      config: options,
      rating,
      joinedAt: Date.now(),
      queueType: options.queueType ?? this.queueType,
    };
    this.queue.push(queuePlayer);

    this.broadcast(ServerMessages.QUEUE_STATUS, {
      queueSize: this.queue.length,
      message: 'Joined queue. Searching for opponents...',
    });
  }

  onLeave(client: Client) {
    this.queue = this.queue.filter(p => p.sessionId !== client.sessionId);
  }

  onDispose() {
    if (this.tickInterval) clearInterval(this.tickInterval);
  }

  private processQueue() {
    const now = Date.now();

    // Check for timeouts
    for (const player of this.queue) {
      const waitTime = now - player.joinedAt;
      if (waitTime >= QUEUE_TIMEOUT_MS) {
        this.clients.getById(player.sessionId)?.send(ServerMessages.QUEUE_TIMEOUT, {
          message: 'No players found. Play with bots?',
        });
      }
    }

    if (this.queue.length < MIN_PLAYERS) return;

    // Group players by rating proximity
    const sorted = [...this.queue].sort((a, b) => a.rating - b.rating);
    const matched: QueuePlayer[] = [];
    const used = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(sorted[i].sessionId)) continue;
      const player = sorted[i];
      const waitTime = now - player.joinedAt;
      const tolerance = Math.min(
        RATING_TOLERANCE_MAX,
        RATING_TOLERANCE_INITIAL + Math.floor(waitTime / 1000) * RATING_TOLERANCE_GROWTH_PER_SEC
      );

      const group: QueuePlayer[] = [player];
      used.add(player.sessionId);

      for (let j = i + 1; j < sorted.length && group.length < MAX_PLAYERS; j++) {
        if (used.has(sorted[j].sessionId)) continue;
        const candidate = sorted[j];
        if (Math.abs(candidate.rating - player.rating) <= tolerance) {
          group.push(candidate);
          used.add(candidate.sessionId);
        }
      }

      if (group.length >= MIN_PLAYERS) {
        matched.push(...group);
        this.createMatch(group);
      } else {
        used.delete(player.sessionId);
      }
    }

    // Remove matched players from queue
    this.queue = this.queue.filter(p => !used.has(p.sessionId));
  }

  private async createMatch(group: QueuePlayer[]) {
    try {
      const room = await matchMaker.createRoom('conflux', {
        isPrivate: true,
        autoStart: true,
        queueType: group[0].queueType,
        expectedPlayers: group.length,
      });

      for (const player of group) {
        const client = this.clients.getById(player.sessionId);
        if (client) {
          client.send(ServerMessages.MATCH_FOUND, {
            roomCode: room.roomId,
            message: 'Match found!',
          });
        }
      }
    } catch (err) {
      console.error('[MatchmakingRoom] Failed to create match:', err);
    }
  }
}
