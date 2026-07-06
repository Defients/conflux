/**
 * hooks/useOnlineScreenSync.ts
 *
 * Synchronizes online game state with screen transitions.
 * Handles spectator mode routing and queue → match found transitions.
 */

import { useEffect, useCallback } from 'react';
import { GameScreen } from '../shared/types';
import { OnlineGameHook } from './useOnlineGame';

interface UseOnlineScreenSyncOptions {
  online: OnlineGameHook;
  setScreen: (screen: GameScreen | string) => void;
  onMatchFound?: () => void;
  onSpectatorJoin?: () => void;
}

export function useOnlineScreenSync({
  online,
  setScreen,
  onMatchFound,
  onSpectatorJoin,
}: UseOnlineScreenSyncOptions) {
  const {
    mode,
    matchPhase,
    isSpectator,
    queueState,
    serverGameState,
  } = online;

  const isOnline = mode !== 'local';

  // Route to appropriate screen when match phase changes
  useEffect(() => {
    if (!isOnline) return;

    switch (matchPhase) {
      case 'countdown':
        setScreen(GameScreen.Event);
        break;
      case 'playing':
        setScreen(GameScreen.Event);
        break;
      case 'tile_results':
        setScreen(GameScreen.TileResults);
        break;
      case 'pit_stop':
        setScreen(GameScreen.PitStop);
        break;
      case 'finished':
        setScreen(GameScreen.Results);
        break;
      case 'lobby':
        setScreen('ONLINE_LOBBY');
        break;
      case 'disconnected':
        setScreen('ONLINE_LOBBY');
        break;
    }
  }, [isOnline, matchPhase, setScreen]);

  // Handle spectator mode
  useEffect(() => {
    if (isOnline && isSpectator && serverGameState) {
      setScreen(GameScreen.Event);
      onSpectatorJoin?.();
    }
  }, [isOnline, isSpectator, serverGameState, setScreen, onSpectatorJoin]);

  // Handle queue → match found transition
  useEffect(() => {
    if (isOnline && queueState?.message === 'matched') {
      onMatchFound?.();
    }
  }, [isOnline, queueState?.message, onMatchFound]);

  const leaveSpectator = useCallback(() => {
    online.leaveRoom();
    setScreen('ONLINE_LOBBY');
  }, [online, setScreen]);

  return {
    leaveSpectator,
  };
}
