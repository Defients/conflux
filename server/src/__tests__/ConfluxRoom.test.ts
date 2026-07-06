import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfluxRoom } from '../rooms/ConfluxRoom';
import { ClientMessages, ServerMessages } from '../../../shared/protocol';
import { ChassisId } from '../../../shared/types';

function createMockClient(sessionId: string) {
  const sentMessages: Array<{ type: string; data: any }> = [];
  return {
    sessionId,
    sentMessages,
    send: vi.fn((type: string, data?: any) => { sentMessages.push({ type, data }); }),
  };
}

function createMockRoom() {
  const room = Object.create(ConfluxRoom.prototype) as ConfluxRoom;

  // ─── Initialize private class fields (Object.create skips the constructor) ───
  (room as any).roomState = {
    roomCode: '',
    phase: 'lobby',
    hostSessionId: '',
    players: new Map(),
    settings: {
      playerCount: 4,
      easyBots: 2,
      intermediateBots: 1,
      seed: '',
      runLength: 8,
      sound: true,
      accessibility: false,
      uiEffects: true,
      colorBlindMode: false,
      selectedChassis: 'standard' as any,
    },
    gameState: null,
    pendingResults: new Map(),
    pendingPitStops: new Set(),
    tileStartTimestamp: 0,
    tileDurationMs: 0,
    isPrivate: false,
    bannedUserIds: new Set(),
    bannedSessionIds: new Set(),
  };
  (room as any).resultTimeout = null;
  (room as any).nextPlayerId = 1;
  (room as any).eventDimensionMap = {};
  (room as any).spectatorIds = new Set();
  (room as any).rateLimiter = { isAllowed: () => true, removeClient: () => {} };

  // ─── Mock Colyseus Room methods ──────────────────────────────────────────
  (room as any).broadcast = vi.fn((type: string, data?: any) => {
    (room as any)._broadcastLog.push({ type, data });
  });
  (room as any)._broadcastLog = [] as Array<{ type: string; data: any }>;
  (room as any).clients = [];
  (room as any).maxClients = 6;
  Object.defineProperty(room, 'autoDispose', { value: false, writable: true, configurable: true });
  (room as any).clock = { setTimeout: vi.fn((cb: any, ms: number) => setTimeout(cb, ms)) };
  (room as any).lock = vi.fn();
  (room as any).unlock = vi.fn();
  (room as any).disconnect = vi.fn();
  (room as any).setMetadata = vi.fn();
  (room as any).allowReconnection = vi.fn(() => Promise.resolve());
  (room as any).onMessage = vi.fn();
  (room as any)._messageHandlers = new Map();

  // Override onMessage to store handlers
  (room as any).onMessage = vi.fn((type: string, handler: any) => {
    (room as any)._messageHandlers.set(type, handler);
  });

  // Mock clients array for kick/ban tests
  (room as any).clients = [];

  // Call onCreate
  room.onCreate({});

  return room;
}

function makeRoomConfig(overrides?: Partial<{ playerName: string; avatarId: string; chassisId: ChassisId; userId: string }>) {
  return {
    playerName: overrides?.playerName ?? 'TestPlayer',
    avatarId: overrides?.avatarId ?? '🚀',
    chassisId: overrides?.chassisId ?? ChassisId.Standard,
    userId: overrides?.userId,
  };
}

describe('ConfluxRoom', () => {
  let room: any;
  let client1: any;
  let client2: any;

  beforeEach(() => {
    room = createMockRoom();
    client1 = createMockClient('session-1');
    client2 = createMockClient('session-2');
  });

  describe('onJoin', () => {
    it('adds player to room and assigns first player as host', () => {
      room.onJoin(client1, makeRoomConfig());
      const players = Array.from(room.roomState.players.values()) as any[];
      expect(players).toHaveLength(1);
      expect(players[0].isHost).toBe(true);
      expect(players[0].name).toBe('TestPlayer');
    });

    it('second player is not host', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'Player2' }));
      const players = Array.from(room.roomState.players.values()) as any[];
      expect(players).toHaveLength(2);
      expect(players[1].isHost).toBe(false);
    });

    it('sanitizes empty player name', () => {
      room.onJoin(client1, makeRoomConfig({ playerName: '' }));
      const player = room.roomState.players.get('session-1');
      expect(player.name).toBe('Player 1');
    });

    it('truncates long player names', () => {
      room.onJoin(client1, makeRoomConfig({ playerName: 'A'.repeat(30) }));
      const player = room.roomState.players.get('session-1');
      expect(player.name.length).toBeLessThanOrEqual(20);
    });

    it('rejects join during active match', () => {
      room.roomState.phase = 'playing';
      expect(() => room.onJoin(client1, makeRoomConfig())).toThrow('Match already in progress.');
    });

    it('sends room code to joiner', () => {
      room.onJoin(client1, makeRoomConfig());
      expect(client1.sentMessages).toContainEqual({
        type: ServerMessages.ROOM_CREATED,
        data: { roomCode: room.roomState.roomCode },
      });
    });
  });

  describe('onLeave (lobby phase)', () => {
    it('removes player from lobby', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onLeave(client1, true);
      expect(room.roomState.players.size).toBe(0);
    });

    it('reassigns host when host leaves', () => {
      room.onJoin(client1, makeRoomConfig({ playerName: 'Host' }));
      room.onJoin(client2, makeRoomConfig({ playerName: 'Guest' }));
      room.onLeave(client1, true);
      const remaining = Array.from(room.roomState.players.values()) as any[];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].isHost).toBe(true);
      expect(remaining[0].name).toBe('Guest');
    });
  });

  describe('handleReady', () => {
    it('toggles ready state in lobby', () => {
      room.onJoin(client1, makeRoomConfig());
      const handler = room._messageHandlers.get(ClientMessages.READY);
      handler(client1, { ready: true });
      const player = room.roomState.players.get('session-1');
      expect(player.isReady).toBe(true);
    });

    it('ignores ready outside lobby phase', () => {
      room.onJoin(client1, makeRoomConfig());
      room.roomState.phase = 'playing';
      const handler = room._messageHandlers.get(ClientMessages.READY);
      handler(client1, { ready: true });
      const player = room.roomState.players.get('session-1');
      expect(player.isReady).toBe(false);
    });
  });

  describe('handleStart', () => {
    it('rejects start from non-host', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      const handler = room._messageHandlers.get(ClientMessages.START);
      handler(client2, {});
      expect(client2.sentMessages).toContainEqual({
        type: ServerMessages.ROOM_ERROR,
        data: { message: 'Only the host can start the match.' },
      });
    });

    it('rejects start when not all players are ready', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      // Player 2 is not ready
      const handler = room._messageHandlers.get(ClientMessages.START);
      handler(client1, {});
      expect(client1.sentMessages).toContainEqual({
        type: ServerMessages.ROOM_ERROR,
        data: { message: 'Not all players are ready.' },
      });
    });

    it('starts match when host starts with all ready', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      // Ready up player 2
      const readyHandler = room._messageHandlers.get(ClientMessages.READY);
      readyHandler(client2, { ready: true });
      // Start
      const startHandler = room._messageHandlers.get(ClientMessages.START);
      startHandler(client1, {});
      expect(room.roomState.phase).toBe('countdown');
    });
  });

  describe('handleRematch', () => {
    it('resets room to lobby phase', () => {
      room.onJoin(client1, makeRoomConfig());
      room.roomState.phase = 'finished';
      room.roomState.gameState = {} as any;
      const handler = room._messageHandlers.get(ClientMessages.REQUEST_REMATCH);
      handler(client1, {});
      expect(room.roomState.phase).toBe('lobby');
      expect(room.roomState.gameState).toBeNull();
    });

    it('ignores rematch outside finished phase', () => {
      room.onJoin(client1, makeRoomConfig());
      room.roomState.phase = 'lobby';
      const handler = room._messageHandlers.get(ClientMessages.REQUEST_REMATCH);
      handler(client1, {});
      expect(room.roomState.phase).toBe('lobby');
    });
  });

  describe('handleUpdateSettings', () => {
    it('updates settings when called by host', () => {
      room.onJoin(client1, makeRoomConfig());
      const handler = room._messageHandlers.get(ClientMessages.UPDATE_SETTINGS);
      handler(client1, { settings: { runLength: 12 } });
      expect(room.roomState.settings.runLength).toBe(12);
    });

    it('ignores settings update from non-host', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      const handler = room._messageHandlers.get(ClientMessages.UPDATE_SETTINGS);
      handler(client2, { settings: { runLength: 12 } });
      expect(room.roomState.settings.runLength).not.toBe(12);
    });
  });

  describe('room code generation', () => {
    it('generates a 4-character room code', () => {
      expect(room.roomState.roomCode).toHaveLength(4);
    });
  });

  describe('handleTogglePrivate', () => {
    it('toggles isPrivate when called by host', () => {
      room.onJoin(client1, makeRoomConfig());
      expect(room.roomState.isPrivate).toBe(false);
      const handler = room._messageHandlers.get(ClientMessages.TOGGLE_PRIVATE);
      handler(client1, {});
      expect(room.roomState.isPrivate).toBe(true);
    });

    it('rejects toggle from non-host', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      const handler = room._messageHandlers.get(ClientMessages.TOGGLE_PRIVATE);
      handler(client2, {});
      expect(room.roomState.isPrivate).toBe(false);
      expect(client2.sentMessages).toContainEqual({
        type: ServerMessages.ROOM_ERROR,
        data: { message: 'Only the host can toggle private mode.' },
      });
    });
  });

  describe('handleKickPlayer', () => {
    it('removes player from room when host kicks', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      const handler = room._messageHandlers.get(ClientMessages.KICK_PLAYER);
      handler(client1, { sessionId: 'session-2' });
      expect(room.roomState.players.size).toBe(1);
      expect(room.roomState.players.has('session-2')).toBe(false);
    });

    it('rejects kick from non-host', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      const handler = room._messageHandlers.get(ClientMessages.KICK_PLAYER);
      handler(client2, { sessionId: 'session-1' });
      expect(room.roomState.players.size).toBe(2);
    });

    it('prevents host from kicking self', () => {
      room.onJoin(client1, makeRoomConfig());
      const handler = room._messageHandlers.get(ClientMessages.KICK_PLAYER);
      handler(client1, { sessionId: 'session-1' });
      expect(room.roomState.players.size).toBe(1);
      expect(client1.sentMessages).toContainEqual({
        type: ServerMessages.ROOM_ERROR,
        data: { message: 'You cannot kick yourself.' },
      });
    });
  });

  describe('handleBanPlayer', () => {
    it('bans player and prevents rejoin by sessionId', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      const handler = room._messageHandlers.get(ClientMessages.BAN_PLAYER);
      handler(client1, { sessionId: 'session-2' });
      expect(room.roomState.players.size).toBe(1);
      expect(room.roomState.bannedSessionIds.has('session-2')).toBe(true);
      // Attempt rejoin
      expect(() => room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }))).toThrow('You are banned from this room.');
    });

    it('bans player by userId and prevents rejoin', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2', userId: 'user-2' }));
      const handler = room._messageHandlers.get(ClientMessages.BAN_PLAYER);
      handler(client1, { sessionId: 'session-2' });
      expect(room.roomState.bannedUserIds.has('user-2')).toBe(true);
    });

    it('rejects ban from non-host', () => {
      room.onJoin(client1, makeRoomConfig());
      room.onJoin(client2, makeRoomConfig({ playerName: 'P2' }));
      const handler = room._messageHandlers.get(ClientMessages.BAN_PLAYER);
      handler(client2, { sessionId: 'session-1' });
      expect(room.roomState.players.size).toBe(2);
    });
  });
});
