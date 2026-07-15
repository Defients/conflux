/**
 * server/src/rooms/MatchmakingRoom.ts
 *
 * Colyseus room acting as a matchmaking queue.
 * Groups players by rating proximity and creates ConfluxRoom instances.
 */

import { Room, Client, matchMaker } from 'colyseus';
import { ClientMessages, ServerMessages, RoomNames } from '../../../shared/protocol';
import { RoomConfig } from '../../../shared/types';
import { DEFAULT_RATING } from '../../../shared/rankSystem';

interface QueuePlayer {
  sessionId: string;
  config: RoomConfig;
  rating: number;
  joinedAt: number;
  queueType: 'ranked' | 'unranked';
  /** Once true, we have already sent this player a single timeout notice. */
  timedOutNotified: boolean;
}

const QUEUE_TICK_MS = 2000;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const RATING_TOLERANCE_INITIAL = 100;
const RATING_TOLERANCE_MAX = 400;
const RATING_TOLERANCE_GROWTH_PER_SEC = 20;
const QUEUE_TIMEOUT_MS = 60_000;
/**
 * A single shared queue room holds the entire matchmaking population for its
 * mode. Clients join via `joinOrCreate`, so everyone lands in the SAME instance
 * (up to this cap) instead of spawning one isolated queue per player.
 */
const MAX_QUEUE_CLIENTS = 100;

/**
 * Colyseus room acting as a shared matchmaking queue for one mode
 * (ranked or unranked). It never hosts gameplay; it pairs eligible players,
 * creates a `conflux_match` room, reserves a seat for each player, and hands
 * each client a seat reservation so they deterministically join the same match.
 */
export class MatchmakingRoom extends Room {
  queue: QueuePlayer[] = [];
  tickInterval: ReturnType<typeof setInterval> | null = null;
  queueType: 'ranked' | 'unranked' = 'unranked';
  /** Re-entrancy guard so an async tick cannot overlap the next tick. */
  private matching = false;

  onCreate(options: { queueType?: 'ranked' | 'unranked' }) {
    this.queueType = options.queueType ?? 'unranked';
    this.maxClients = MAX_QUEUE_CLIENTS;
    // Keep the shared queue alive even when momentarily empty between players.
    this.autoDispose = false;
    this.setMetadata({ queueType: this.queueType });

    // Latency measurement works while queueing, not just in-match.
    this.onMessage(ClientMessages.PING, (client) => {
      client.send(ServerMessages.PONG, {});
    });
    // Explicit leave-queue request (in addition to disconnecting).
    this.onMessage(ClientMessages.LEAVE_QUEUE, (client) => {
      this.removeFromQueue(client.sessionId);
      this.broadcastQueueStatus();
    });

    this.tickInterval = setInterval(() => { void this.processQueue(); }, QUEUE_TICK_MS);
    console.log(`[Queue:${this.queueType}] created (room ${this.roomId})`);
  }

  onJoin(client: Client, options: RoomConfig) {
    const rating = options.rating ?? DEFAULT_RATING;
    // Guard against duplicate queue entries for the same session.
    this.removeFromQueue(client.sessionId);
    this.queue.push({
      sessionId: client.sessionId,
      config: options,
      rating,
      joinedAt: Date.now(),
      queueType: options.queueType ?? this.queueType,
      timedOutNotified: false,
    });
    console.log(`[Queue:${this.queueType}] ${client.sessionId} joined (size=${this.queue.length})`);
    this.broadcastQueueStatus();
  }

  onLeave(client: Client) {
    this.removeFromQueue(client.sessionId);
    this.broadcastQueueStatus();
  }

  onDispose() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private removeFromQueue(sessionId: string) {
    this.queue = this.queue.filter(p => p.sessionId !== sessionId);
  }

  private broadcastQueueStatus() {
    // Send each client their personal position so the UI is truthful.
    this.queue.forEach((p, idx) => {
      this.clients.getById(p.sessionId)?.send(ServerMessages.QUEUE_STATUS, {
        queueSize: this.queue.length,
        position: idx + 1,
        message: this.queue.length < MIN_PLAYERS
          ? 'In queue. Waiting for more pilots...'
          : 'In queue. Forming a match...',
      });
    });
  }

  private async processQueue() {
    if (this.matching) return;
    const now = Date.now();

    // Send a SINGLE timeout notice per player once they exceed the threshold.
    for (const player of this.queue) {
      if (!player.timedOutNotified && now - player.joinedAt >= QUEUE_TIMEOUT_MS) {
        player.timedOutNotified = true;
        this.clients.getById(player.sessionId)?.send(ServerMessages.QUEUE_TIMEOUT, {
          message: 'No opponents found yet. You can keep waiting or play against bots.',
        });
      }
    }

    if (this.queue.length < MIN_PLAYERS) return;

    // Build match groups by rating proximity (tolerance widens with wait time).
    const sorted = [...this.queue].sort((a, b) => a.rating - b.rating);
    const used = new Set<string>();
    const groups: QueuePlayer[][] = [];

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(sorted[i].sessionId)) continue;
      const player = sorted[i];
      const tolerance = Math.min(
        RATING_TOLERANCE_MAX,
        RATING_TOLERANCE_INITIAL + Math.floor((now - player.joinedAt) / 1000) * RATING_TOLERANCE_GROWTH_PER_SEC
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
        groups.push(group);
      } else {
        used.delete(player.sessionId);
      }
    }

    if (groups.length === 0) return;

    // Remove matched players from the queue *synchronously* before any await,
    // so the next tick cannot re-match the same players (no duplicate matches).
    this.queue = this.queue.filter(p => !used.has(p.sessionId));

    this.matching = true;
    try {
      for (const group of groups) {
        await this.createMatch(group);
      }
    } finally {
      this.matching = false;
    }
  }

  private async createMatch(group: QueuePlayer[]) {
    let room: Awaited<ReturnType<typeof matchMaker.createRoom>> | null = null;
    try {
      // Create the correct gameplay room type (registered as conflux_match).
      room = await matchMaker.createRoom(RoomNames.MATCH, {
        isPrivate: true,
        fromMatchmaking: true,
        autoStart: true,
        queueType: group[0].queueType,
        expectedPlayers: group.length,
      });
    } catch (err) {
      console.error('[MatchmakingRoom] Failed to create match room:', err);
      // Return players to the queue so they get another chance next tick.
      this.requeue(group);
      return;
    }

    const failed: QueuePlayer[] = [];
    for (const player of group) {
      const client = this.clients.getById(player.sessionId);
      if (!client) {
        // Player left between matching and reservation; skip them.
        continue;
      }
      try {
        // Reserve a seat BEFORE telling the client to leave the queue.
        const reservation = await matchMaker.reserveSeatFor(room!, player.config);
        client.send(ServerMessages.MATCH_FOUND, {
          reservation,
          roomId: room!.roomId,
          queueType: player.queueType,
          message: 'Match found!',
        });
      } catch (err) {
        console.error(`[MatchmakingRoom] reserveSeatFor failed for ${player.sessionId}:`, err);
        failed.push(player);
      }
    }

    // Anyone whose reservation failed goes back into the queue.
    if (failed.length > 0) this.requeue(failed);

    console.log(`[Queue:${this.queueType}] created match ${room!.roomId} for ${group.length - failed.length} players`);
  }

  /** Put players back at the front of the queue (preserving their wait time). */
  private requeue(players: QueuePlayer[]) {
    for (const p of players) {
      if (this.clients.getById(p.sessionId) && !this.queue.some(q => q.sessionId === p.sessionId)) {
        this.queue.push(p);
      }
    }
  }
}
