/**
 * hooks/useOnlineGame.ts
 * 
 * React hook that bridges the NetworkService with React state.
 * Provides online room lifecycle, lobby state, and game state
 * to UI components in a clean reactive API.
 */

import { useState, useEffect, useCallback } from 'react';
import { networkService, NetworkEventHandlers } from '../services/networkService';
import {
  GameState, GameSettings, LobbyPlayer, MatchPhase,
  RoomConfig, EventTelemetry, PowerUp,
} from '../types';
import { TileStartPayload, TileResultsPayload, RaceFinishedPayload, InterventionPayload, MatchSummaryPayload } from '../shared/protocol';
import { MatchSummary } from '../shared/matchSummary';
import { ConnectionQuality } from '../shared/types';

export type GameMode = 'local' | 'online';

export interface OnlineLobbyState {
  roomCode: string;
  phase: MatchPhase;
  hostSessionId: string;
  players: LobbyPlayer[];
  settings: GameSettings;
  isPrivate: boolean;
}

/** Online match phase as seen by the client. */
export type OnlineMatchPhase =
  | 'disconnected'
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'tile_results'
  | 'pit_stop'
  | 'intervention'
  | 'finished';

export interface OnlineGameHook {
  // Connection state
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  isConnected: boolean;
  isReconnecting: boolean;
  sessionId: string | null;
  error: string | null;

  // Lobby state (online only)
  lobbyState: OnlineLobbyState | null;

  // Game state from server (online only)
  serverGameState: GameState | null;
  matchPhase: OnlineMatchPhase;
  tileStart: TileStartPayload | null;
  tileResults: TileResultsPayload | null;
  raceFinished: RaceFinishedPayload | null;
  matchSummary: MatchSummary | null;
  interventionData: InterventionPayload | null;

  // v5.0: Queue state
  queueState: { queueSize: number; message: string } | null;
  isQueuing: boolean;
  joinQueue: (config: RoomConfig, queueType?: 'ranked' | 'unranked') => Promise<void>;
  leaveQueue: () => Promise<void>;

  // v5.0: Connection quality
  connectionQuality: ConnectionQuality;
  rttMs: number;

  // v5.0: Reconnect progress
  reconnectAttempts: number;

  // v5.0: Spectator mode
  isSpectator: boolean;
  spectateRoom: (roomId: string) => Promise<void>;

  // Online actions
  createRoom: (config: RoomConfig) => Promise<void>;
  joinRoom: (roomCode: string, config: RoomConfig) => Promise<void>;
  leaveRoom: () => Promise<void>;
  sendReady: (ready: boolean) => void;
  sendStart: () => void;
  sendUpdateSettings: (settings: Partial<GameSettings>) => void;
  sendEventResult: (telemetry: EventTelemetry) => void;
  sendUsePowerUp: (powerUp: PowerUp, targetId?: number) => void;
  sendActivateOverdrive: (force?: boolean) => void;
  sendInterventionChoice: (accept: boolean) => void;
  sendPitStopAction: (action: 'scrub' | 'tuneUp' | 'analyze' | 'recharge') => void;
  sendRequestRematch: () => void;
  sendTogglePrivate: () => void;
  sendKickPlayer: (sessionId: string) => void;
  sendBanPlayer: (sessionId: string) => void;
  clearError: () => void;
}

export function useOnlineGame(): OnlineGameHook {
  const [mode, setMode] = useState<GameMode>('local');
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lobbyState, setLobbyState] = useState<OnlineLobbyState | null>(null);
  const [serverGameState, setServerGameState] = useState<GameState | null>(null);
  const [matchPhase, setMatchPhase] = useState<OnlineMatchPhase>('disconnected');
  const [tileStart, setTileStart] = useState<TileStartPayload | null>(null);
  const [tileResults, setTileResults] = useState<TileResultsPayload | null>(null);
  const [raceFinished, setRaceFinished] = useState<RaceFinishedPayload | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [interventionData, setInterventionData] = useState<InterventionPayload | null>(null);
  // v5.0 state
  const [queueState, setQueueState] = useState<{ queueSize: number; message: string } | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('critical');
  const [rttMs, setRttMs] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isSpectator, setIsSpectator] = useState(false);

  // Register network event handlers
  useEffect(() => {
    if (mode !== 'online') return;

    const handlers: NetworkEventHandlers = {
      onConnectionChange: (connected) => {
        setIsConnected(connected);
        setIsReconnecting(networkService.isReconnecting);
        if (!connected && !networkService.isReconnecting) {
          setMatchPhase('disconnected');
        }
      },

      onLobbyStateUpdate: (data) => {
        setLobbyState({
          roomCode: data.roomCode,
          phase: data.phase,
          hostSessionId: data.hostSessionId,
          players: data.players,
          settings: data.settings,
          isPrivate: data.isPrivate,
        });
        // Sync match phase from lobby state
        if (data.phase === 'lobby') setMatchPhase('lobby');
      },

      onGameStateUpdate: (data) => {
        setServerGameState(data.gameState);
        // Sync phase from game state update (important for reconnection resync)
        if (data.phase === 'playing') setMatchPhase('playing');
        else if (data.phase === 'tile_results') setMatchPhase('tile_results');
        else if (data.phase === 'finished') setMatchPhase('finished');
        else if (data.phase === 'lobby') setMatchPhase('lobby');
      },

      onCountdown: (_data) => {
        setTileResults(null);
        setInterventionData(null);
        setMatchSummary(null);
        setMatchPhase('countdown');
      },

      onTileStart: (data) => {
        setTileStart(data);
        setTileResults(null); // Clear previous results
        setInterventionData(null);
        setMatchPhase('playing');
      },

      onTileResults: (data) => {
        setTileResults(data);
        setServerGameState(data.gameState);
        setTileStart(null);
        setMatchPhase('tile_results');
      },

      onRaceFinished: (data) => {
        setRaceFinished(data);
        setServerGameState(data.gameState);
        setMatchPhase('finished');
      },

      onMatchSummary: (data) => {
        setMatchSummary(data.summary);
      },

      onIntervention: (data) => {
        setInterventionData(data as InterventionPayload);
        setMatchPhase('intervention');
      },

      onPitStop: () => {
        setMatchPhase('pit_stop');
      },

      onRoomError: (message) => {
        setError(message);
      },

      onRoomCreated: (roomCode) => {
        console.log(`[useOnlineGame] Room created: ${roomCode}`);
      },

      onPlayerDisconnected: (data) => {
        console.log(`[useOnlineGame] Player disconnected: ${data.sessionId}`);
      },

      onPlayerReconnected: (data) => {
        console.log(`[useOnlineGame] Player reconnected: ${data.sessionId}`);
      },

      onPlayerKicked: (message) => {
        setError(message);
      },

      onPlayerBanned: (message) => {
        setError(message);
      },

      // v5.0 handlers
      onStartCountdown: (data) => {
        console.log(`[useOnlineGame] Countdown: ${data.durationMs}ms for tile ${data.tileIndex}`);
      },

      onQueueStatus: (data) => {
        setQueueState(data);
      },

      onMatchFound: (data) => {
        setIsQueuing(false);
        setQueueState(null);
        // networkService.setupQueueListeners already consumes the seat reservation
        // and joins the gameplay room. This handler just updates UI state.
        setMatchPhase('lobby');
        console.log(`[useOnlineGame] Match found: ${data.roomId}`);
      },

      onQueueTimeout: (data) => {
        setIsQueuing(false);
        setQueueState(null);
        setError(data.message);
      },

      onTournamentUpdate: (data) => {
        console.log('[useOnlineGame] Tournament update:', data);
      },

      onTournamentMatchReady: (data) => {
        console.log(`[useOnlineGame] Tournament match ready: ${data.matchId}`);
      },

      onSpectatorMode: (data) => {
        setIsSpectator(true);
        console.log(`[useOnlineGame] Spectator mode: ${data.roomCode}`);
      },

      onConnectionQualityChange: (quality) => {
        setConnectionQuality(quality);
        setRttMs(networkService.rttMs);
      },
    };

    const unsub = networkService.setHandlers(handlers);
    return unsub;
  }, [mode]);

  // Try reconnect on mount
  useEffect(() => {
    if (mode === 'online') {
      networkService.tryReconnect().then((reconnected) => {
        if (reconnected) {
          setIsConnected(true);
          console.log('[useOnlineGame] Reconnected to previous room');
        }
      });
    }
  }, [mode]);

  // ─── Actions ───────────────────────────────────────────────────────────

  const createRoom = useCallback(async (config: RoomConfig) => {
    setError(null);
    try {
      await networkService.createRoom(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    }
  }, []);

  const joinRoom = useCallback(async (roomCode: string, config: RoomConfig) => {
    setError(null);
    try {
      await networkService.joinByCode(roomCode, config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    }
  }, []);

  const leaveRoom = useCallback(async () => {
    await networkService.leaveRoom();
    setLobbyState(null);
    setServerGameState(null);
    setTileStart(null);
    setTileResults(null);
    setRaceFinished(null);
    setInterventionData(null);
    setIsConnected(false);
    setIsReconnecting(false);
    setError(null);
    setMatchPhase('disconnected');
  }, []);

  // v5.0: Queue actions
  const joinQueue = useCallback(async (config: RoomConfig, queueType: 'ranked' | 'unranked' = 'unranked') => {
    setError(null);
    setIsQueuing(true);
    try {
      await networkService.joinQueue(config, queueType);
    } catch (err) {
      setIsQueuing(false);
      setError(err instanceof Error ? err.message : 'Failed to join queue');
    }
  }, []);

  const leaveQueue = useCallback(async () => {
    await networkService.leaveQueue();
    setIsQueuing(false);
    setQueueState(null);
  }, []);

  // v5.0: Spectate room
  const spectateRoom = useCallback(async (roomId: string) => {
    setError(null);
    try {
      await networkService.spectateRoom(roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spectate room');
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    mode,
    setMode,
    isConnected,
    isReconnecting,
    sessionId: networkService.sessionId,
    error,

    lobbyState,
    serverGameState,
    matchPhase,
    tileStart,
    tileResults,
    raceFinished,
    matchSummary,
    interventionData,

    // v5.0 fields
    queueState,
    isQueuing,
    joinQueue,
    leaveQueue,
    connectionQuality,
    rttMs,
    reconnectAttempts,
    isSpectator,
    spectateRoom,

    createRoom,
    joinRoom,
    leaveRoom,
    sendReady: networkService.sendReady.bind(networkService),
    sendStart: networkService.sendStart.bind(networkService),
    sendUpdateSettings: networkService.sendUpdateSettings.bind(networkService),
    sendEventResult: networkService.sendEventResult.bind(networkService),
    sendUsePowerUp: networkService.sendUsePowerUp.bind(networkService),
    sendActivateOverdrive: networkService.sendActivateOverdrive.bind(networkService),
    sendInterventionChoice: networkService.sendInterventionChoice.bind(networkService),
    sendPitStopAction: networkService.sendPitStopAction.bind(networkService),
    sendRequestRematch: networkService.sendRequestRematch.bind(networkService),
    sendTogglePrivate: networkService.sendTogglePrivate.bind(networkService),
    sendKickPlayer: networkService.sendKickPlayer.bind(networkService),
    sendBanPlayer: networkService.sendBanPlayer.bind(networkService),
    clearError,
  };
}
