/**
 * server/src/gameServerConfig.ts
 *
 * Single source of truth for Colyseus room registration.
 * Both the production entrypoint (index.ts) and the integration test suite
 * register rooms through `defineRooms`, guaranteeing the running server and
 * the tested server expose an identical set of room types. This closes the
 * class of bug where the client references a room name the server never
 * registered (e.g. the production "conflux_queue_ranked not defined" error).
 */

import type { Server } from 'colyseus';
import { RoomNames } from '../../shared/protocol';
import { ConfluxRoom } from './rooms/ConfluxRoom';
import { MatchmakingRoom } from './rooms/MatchmakingRoom';
import { TournamentRoom } from './rooms/TournamentRoom';

/** Public room types registered by the server (used by diagnostics parity). */
export const REGISTERED_ROOMS: string[] = [
  RoomNames.MATCH,
  RoomNames.QUEUE_RANKED,
  RoomNames.QUEUE_UNRANKED,
  RoomNames.TOURNAMENT,
];

/**
 * Register every room type on a Colyseus game server.
 * Kept side-effect free (no listen/bind) so it is reusable in tests.
 */
export function defineRooms(gameServer: Server): void {
  gameServer.define(RoomNames.MATCH, ConfluxRoom);
  gameServer.define(RoomNames.QUEUE_RANKED, MatchmakingRoom, { queueType: 'ranked' });
  gameServer.define(RoomNames.QUEUE_UNRANKED, MatchmakingRoom, { queueType: 'unranked' });
  gameServer.define(RoomNames.TOURNAMENT, TournamentRoom);
}
