/**
 * components/OnlineLobby.tsx
 * 
 * Online multiplayer lobby UI.
 * Handles: create room, join by code, roster display, ready/unready, host start.
 * Rendered when user selects "Online" mode from the main Lobby.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PilotProfile, ChassisId, LobbyPlayer, GameSettings, RoomConfig } from '../types';
import { CHASSIS_DEFINITIONS } from '../constants';
import { OnlineGameHook } from '../hooks/useOnlineGame';
import { auth } from '../services/firebase';
import { networkService, OpenRoomInfo } from '../services/networkService';

interface OnlineLobbyProps {
  profile: PilotProfile;
  online: OnlineGameHook;
  onBack: () => void;
}

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({ profile, online, onBack }) => {
  const [joinCode, setJoinCode] = useState('');
  const joinCodeRef = useRef<HTMLInputElement>(null);
  const [selectedChassis, setSelectedChassis] = useState<ChassisId>(
    profile.unlockedChassis[profile.unlockedChassis.length - 1] || ChassisId.Standard
  );
  const [openRooms, setOpenRooms] = useState<OpenRoomInfo[]>([]);
  const [showBrowse, setShowBrowse] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const {
    isConnected, isReconnecting, sessionId, error, lobbyState,
    createRoom, joinRoom, leaveRoom,
    sendReady, sendStart, sendUpdateSettings,
    clearError,
  } = online;

  useEffect(() => {
    if (!isConnected && !lobbyState) {
      joinCodeRef.current?.focus();
    }
  }, [isConnected, lobbyState]);

  const isInRoom = isConnected && lobbyState !== null;
  const isHost = lobbyState?.hostSessionId === sessionId;
  const myPlayer = lobbyState?.players.find(p => p.sessionId === sessionId);
  const allReady = lobbyState?.players.every(p => p.isReady || p.isHost) ?? false;

  const buildConfig = (): RoomConfig => {
    return {
      playerName: profile.name,
      avatarId: profile.avatarId,
      chassisId: selectedChassis,
      userId: auth?.currentUser?.uid,
    };
  };

  const handleCreate = async () => {
    clearError();
    await createRoom(buildConfig());
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    clearError();
    await joinRoom(joinCode.trim().toUpperCase(), buildConfig());
  };

  const handleLeave = async () => {
    await leaveRoom();
  };

  const handleToggleReady = () => {
    sendReady(!myPlayer?.isReady);
  };

  const handleStart = () => {
    sendStart();
  };

  const handleBrowse = useCallback(async () => {
    setShowBrowse(s => !s);
    if (!showBrowse) {
      setLoadingRooms(true);
      const rooms = await networkService.getOpenRooms();
      setOpenRooms(rooms);
      setLoadingRooms(false);
    }
  }, [showBrowse]);

  const handleJoinOpenRoom = async (room: OpenRoomInfo) => {
    clearError();
    await joinRoom(room.roomCode, buildConfig());
  };

  // ─── Not in a room yet: show create/join ─────────────────────────────

  if (!isInRoom) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-3 sm:p-6 animate-fade-in">
        <div className="glass-panel p-4 sm:p-8 max-w-md w-full">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green">
              ONLINE PLAY
            </h2>
            <button
              onClick={onBack}
              className="text-sm text-gray-400 active:text-white sm:hover:text-white transition-colors py-2 px-3"
              aria-label="Go back to main lobby"
            >
              ← Back
            </button>
          </div>

          {isReconnecting && (
            <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded text-sm text-yellow-300 animate-pulse">
              Reconnecting to server...
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded text-sm text-red-300" role="alert">
              {error}
              <button onClick={clearError} className="ml-2 text-red-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Chassis selector */}
          <div className="mb-6">
            <label className="text-xs font-bold text-galaxy-cyan uppercase tracking-widest mb-2 block">
              Select Chassis
            </label>
            <div className="grid grid-cols-5 gap-2">
              {profile.unlockedChassis.map(id => {
                const chassis = CHASSIS_DEFINITIONS[id];
                const isSelected = selectedChassis === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedChassis(id)}
                    className={`p-2 rounded text-center text-2xl transition-all border
                      ${isSelected
                        ? 'border-hyper-green bg-hyper-green/10 shadow-[0_0_10px_rgba(77,255,175,0.2)]'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    title={chassis.name}
                  >
                    {chassis.icon}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Create Room */}
          <button
            onClick={handleCreate}
            className="w-full py-4 mb-4 bg-gradient-to-r from-hyper-green to-emerald-600 text-cosmic-blue font-black text-lg rounded-lg active:shadow-[0_0_20px_rgba(77,255,175,0.3)] sm:hover:shadow-[0_0_20px_rgba(77,255,175,0.3)] transition-all"
            aria-label="Create a new online room"
          >
            CREATE ROOM
          </button>

          {/* Join Room */}
          <div className="flex gap-2">
            <input
              ref={joinCodeRef}
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              maxLength={4}
              autoComplete="off"
              enterKeyHint="go"
              aria-label="Enter room code to join"
              className="flex-grow px-4 py-3 bg-cosmic-blue border border-star-purple/50 rounded font-mono text-lg text-white text-center tracking-[0.3em] uppercase focus:outline-none focus:border-galaxy-cyan transition-colors"
              onKeyDown={e => { if (e.key === 'Enter' && joinCode.trim()) handleJoin(); }}
            />
            <button
              onClick={handleJoin}
              disabled={!joinCode.trim()}
              className="px-6 py-3 bg-gradient-to-r from-nebula-pink to-purple-700 text-white font-bold rounded-lg active:opacity-80 sm:hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Join room with code"
            >
              JOIN
            </button>
          </div>

          {/* Browse Open Rooms */}
          <button
            onClick={handleBrowse}
            className="w-full mt-4 py-3 text-sm font-bold text-gray-400 border border-white/10 rounded-lg active:bg-white/5 sm:hover:bg-white/5 transition-colors"
            aria-label="Browse open rooms"
            aria-expanded={showBrowse}
          >
            {showBrowse ? '▲ HIDE OPEN ROOMS' : '▼ BROWSE OPEN ROOMS'}
          </button>
          {showBrowse && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto" role="region" aria-label="Open rooms list">
              {loadingRooms ? (
                <div className="text-center py-4 text-sm text-gray-500" aria-live="polite">Loading rooms...</div>
              ) : openRooms.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">No open rooms found. Create one!</div>
              ) : (
                openRooms.map(room => (
                  <button
                    key={room.roomId}
                    onClick={() => handleJoinOpenRoom(room)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg active:bg-white/10 sm:hover:bg-white/10 transition-colors text-left"
                    aria-label={`Join room ${room.roomCode} with ${room.playerCount} players`}
                  >
                    <div>
                      <span className="font-mono text-sm text-solar-orange font-bold tracking-widest">{room.roomCode}</span>
                      <span className="ml-2 text-xs text-gray-400">{room.playerCount}/{room.maxPlayers} players</span>
                    </div>
                    <span className="text-xs text-hyper-green font-bold">JOIN →</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── In a room: show lobby roster ─────────────────────────────────────

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-3 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="glass-panel p-4 sm:p-8 max-w-lg w-full my-auto">
        {/* Room Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-galaxy-cyan to-hyper-green">
              ROOM LOBBY
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">Code:</span>
              <span className="font-mono text-lg text-solar-orange tracking-[0.3em] font-bold">
                {lobbyState?.roomCode}
              </span>
            </div>
          </div>
          <button
            onClick={handleLeave}
            className="px-4 py-2 text-sm bg-red-500/20 border border-red-500/40 rounded text-red-300 active:bg-red-500/30 sm:hover:bg-red-500/30 transition-colors"
            aria-label="Leave room"
          >
            Leave
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded text-sm text-red-300" role="alert">
            {error}
            <button onClick={clearError} className="ml-2 text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Player Roster */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
            Players ({lobbyState?.players.length ?? 0}/6)
          </h3>
          <div className="space-y-2">
            {lobbyState?.players.map((player) => (
              <div
                key={player.sessionId}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all
                  ${player.sessionId === sessionId
                    ? 'border-galaxy-cyan/40 bg-galaxy-cyan/5'
                    : 'border-white/10 bg-white/5'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{player.avatarId}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{player.name}</span>
                      {player.isHost && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-solar-orange/20 text-solar-orange rounded font-bold uppercase">
                          Host
                        </span>
                      )}
                      {player.sessionId === sessionId && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-galaxy-cyan/20 text-galaxy-cyan rounded font-bold uppercase">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {CHASSIS_DEFINITIONS[player.chassisId]?.icon} {CHASSIS_DEFINITIONS[player.chassisId]?.name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!player.isConnected && (
                    <span className="text-xs text-red-400">Disconnected</span>
                  )}
                  {player.isReady ? (
                    <span className="text-xs font-bold text-hyper-green bg-hyper-green/10 px-2 py-1 rounded">
                      READY
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 px-2 py-1">
                      Not Ready
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings (Host Only) */}
        {isHost && (
          <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-xs font-bold text-solar-orange uppercase tracking-widest mb-3">
              Match Settings (Host)
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-xs text-gray-400">Circuit Length</label>
                <select
                  value={lobbyState?.settings.runLength ?? 8}
                  onChange={e => sendUpdateSettings({ runLength: parseInt(e.target.value) })}
                  className="w-full mt-1 px-2 py-1.5 bg-cosmic-blue border border-white/20 rounded text-white text-sm"
                >
                  {[8, 10, 12].map(n => (
                    <option key={n} value={n}>{n} Tiles</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400">Bot Fill</label>
                <select
                  value={lobbyState?.settings.easyBots ?? 2}
                  onChange={e => {
                    const bots = parseInt(e.target.value);
                    sendUpdateSettings({ easyBots: Math.floor(bots / 2), intermediateBots: Math.ceil(bots / 2) });
                  }}
                  className="w-full mt-1 px-2 py-1.5 bg-cosmic-blue border border-white/20 rounded text-white text-sm"
                >
                  {[0, 1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>{n} Bots</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isHost && (
            <button
              onClick={handleToggleReady}
              className={`flex-1 py-4 font-bold text-base sm:text-lg rounded-lg transition-all
                ${myPlayer?.isReady
                  ? 'bg-gray-700 text-gray-300 active:bg-gray-600 sm:hover:bg-gray-600'
                  : 'bg-gradient-to-r from-hyper-green to-emerald-600 text-cosmic-blue active:shadow-[0_0_20px_rgba(77,255,175,0.3)] sm:hover:shadow-[0_0_20px_rgba(77,255,175,0.3)]'
                }`}
              aria-label={myPlayer?.isReady ? 'Unready' : 'Ready up'}
            >
              {myPlayer?.isReady ? 'UNREADY' : 'READY UP'}
            </button>
          )}

          {isHost && (
            <button
              onClick={handleStart}
              disabled={!allReady || (lobbyState?.players.length ?? 0) < 2}
              className="flex-1 py-4 bg-gradient-to-r from-hyper-green to-emerald-600 text-cosmic-blue font-black text-base sm:text-lg rounded-lg active:shadow-[0_0_20px_rgba(77,255,175,0.3)] sm:hover:shadow-[0_0_20px_rgba(77,255,175,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Start the match"
            >
              START MATCH
            </button>
          )}
        </div>

        {isHost && !allReady && (lobbyState?.players.length ?? 0) > 1 && (
          <p className="text-xs text-gray-500 text-center mt-2">
            Waiting for all players to ready up...
          </p>
        )}
      </div>
    </div>
  );
};
