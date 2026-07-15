/**
 * server/src/__tests__/matchmaking.integration.test.ts
 *
 * End-to-end integration test that starts a real Colyseus server,
 * connects two clients to the ranked queue, and verifies the full
 * queue → match → join → sync → cleanup flow.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';
import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { Client as ColyseusClient } from 'colyseus.js';
import { defineRooms } from '../gameServerConfig';
import { RoomNames, ServerMessages } from '../../../shared/protocol';
import { ChassisId } from '../../../shared/types';

const TEST_PORT = 2569;
const TEST_ENDPOINT = `ws://127.0.0.1:${TEST_PORT}`;

let gameServer: Server;
let httpServer: http.Server;

function makeConfig(name: string) {
  return {
    playerName: name,
    avatarId: '🚀',
    chassisId: ChassisId.Standard,
    rating: 1000,
    queueType: 'ranked' as const,
  };
}

describe('Matchmaking integration: queue → match → join → sync', () => {
  beforeAll(async () => {
    httpServer = http.createServer();
    gameServer = new Server({
      transport: new WebSocketTransport({ server: httpServer }),
    });
    defineRooms(gameServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, '127.0.0.1', resolve);
    });
  });

  afterAll(async () => {
    await gameServer.gracefullyShutdown(false);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it(
    'two clients join ranked queue, get matched, and join the same gameplay room',
    async () => {
      const clientA = new ColyseusClient(TEST_ENDPOINT);
      const clientB = new ColyseusClient(TEST_ENDPOINT);

      // ─── Step 1: Both clients join the ranked queue via joinOrCreate ────────
      const queueRoomA = await clientA.joinOrCreate(RoomNames.QUEUE_RANKED, makeConfig('Alice'));
      const queueRoomB = await clientB.joinOrCreate(RoomNames.QUEUE_RANKED, makeConfig('Bob'));

      // ─── Step 2: Wait for MATCH_FOUND messages with seat reservations ───────
      const matchFoundA = new Promise<{
        reservation: unknown;
        roomId: string;
        queueType: string;
        message: string;
      }>((resolve) => {
        queueRoomA.onMessage(ServerMessages.MATCH_FOUND, (data) => resolve(data));
      });

      const matchFoundB = new Promise<{
        reservation: unknown;
        roomId: string;
        queueType: string;
        message: string;
      }>((resolve) => {
        queueRoomB.onMessage(ServerMessages.MATCH_FOUND, (data) => resolve(data));
      });

      const [foundA, foundB] = await Promise.all([
        Promise.race([
          matchFoundA,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Client A timeout waiting for MATCH_FOUND')), 15_000),
          ),
        ]),
        Promise.race([
          matchFoundB,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Client B timeout waiting for MATCH_FOUND')), 15_000),
          ),
        ]),
      ]);

      // ─── Step 3: Verify both reservations point to the SAME gameplay room ───
      expect(foundA.reservation).toBeDefined();
      expect(foundB.reservation).toBeDefined();
      expect(foundA.roomId).toBe(foundB.roomId);
      expect(foundA.queueType).toBe('ranked');
      expect(foundB.queueType).toBe('ranked');

      // ─── Step 4: Consume seat reservations to join the gameplay room ────────
      const gameRoomA = await clientA.consumeSeatReservation(foundA.reservation as any);
      const gameRoomB = await clientB.consumeSeatReservation(foundB.reservation as any);

      expect(gameRoomA.roomId).toBe(foundA.roomId);
      expect(gameRoomB.roomId).toBe(foundB.roomId);
      expect(gameRoomA.roomId).toBe(gameRoomB.roomId);

      // ─── Step 5: Verify both clients receive room:state (lobby sync) ────────
      const lobbyStateA = new Promise<{ roomCode: string; phase: string }>((resolve) => {
        gameRoomA.onMessage('room:state', (data) => resolve(data));
      });
      const lobbyStateB = new Promise<{ roomCode: string; phase: string }>((resolve) => {
        gameRoomB.onMessage('room:state', (data) => resolve(data));
      });

      const [stateA, stateB] = await Promise.all([
        Promise.race([
          lobbyStateA,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Client A timeout waiting for room:state')), 10_000),
          ),
        ]),
        Promise.race([
          lobbyStateB,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Client B timeout waiting for room:state')), 10_000),
          ),
        ]),
      ]);

      expect(stateA.roomCode).toBe(stateB.roomCode);
      expect(stateA.phase).toBe('lobby');

      // ─── Step 6: Verify auto-start triggers (phase transitions to countdown) ─
      // The ConfluxRoom auto-starts when expectedPlayers (2) have joined.
      // After 3.5s countdown, phase becomes 'playing'. We wait for game:state.
      const gameStateA = new Promise<{ phase: string }>((resolve) => {
        gameRoomA.onMessage('game:state', (data) => {
          if (data.phase === 'countdown' || data.phase === 'playing') resolve(data);
        });
      });

      const gameStateB = new Promise<{ phase: string }>((resolve) => {
        gameRoomB.onMessage('game:state', (data) => {
          if (data.phase === 'countdown' || data.phase === 'playing') resolve(data);
        });
      });

      const [gStateA, gStateB] = await Promise.all([
        Promise.race([
          gameStateA,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Client A timeout waiting for game:state')), 15_000),
          ),
        ]),
        Promise.race([
          gameStateB,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Client B timeout waiting for game:state')), 15_000),
          ),
        ]),
      ]);

      expect(['countdown', 'playing']).toContain(gStateA.phase);
      expect(['countdown', 'playing']).toContain(gStateB.phase);

      // ─── Step 7: Cleanup — leave rooms and close clients ────────────────────
      await gameRoomA.leave(true);
      await gameRoomB.leave(true);
      try { await queueRoomA.leave(true); } catch { /* may already be disposed */ }
      try { await queueRoomB.leave(true); } catch { /* may already be disposed */ }
    },
    60_000, // 60s test timeout — allows for queue tick + countdown
  );

  it('queue status updates are sent to queued clients', async () => {
    const clientC = new ColyseusClient(TEST_ENDPOINT);
    const queueRoom = await clientC.joinOrCreate(RoomNames.QUEUE_UNRANKED, makeConfig('Charlie'));

    const queueStatus = new Promise<{ queueSize: number; message: string }>((resolve) => {
      queueRoom.onMessage(ServerMessages.QUEUE_STATUS, (data) => resolve(data));
    });

    const status = await Promise.race([
      queueStatus,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for QUEUE_STATUS')), 10_000),
      ),
    ]);

    expect(status.queueSize).toBeGreaterThan(0);
    expect(status.message).toBeDefined();

    await queueRoom.leave(true);
  });
});
