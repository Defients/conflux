/**
 * server/src/index.ts
 * 
 * Colyseus game server entry point.
 * Hosts the ConfluxRoom for multiplayer match lifecycle.
 */

import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import http from 'http';
import { defineRooms, REGISTERED_ROOMS } from './gameServerConfig';
import { createExpressApp } from './createExpressApp';

const PORT = Number(process.env.PORT) || 2567;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_VERSION = process.env.npm_package_version || process.env.APP_VERSION || '0.0.0';
const COMMIT_SHA =
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.SOURCE_VERSION ||
  'unknown';

const app = createExpressApp();
const server = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

// Register all room types through the shared config (single source of truth).
defineRooms(gameServer);

gameServer.listen(PORT, '0.0.0.0').then(() => {
  console.log(`[ConfluxServer] env:     ${NODE_ENV}`);
  console.log(`[ConfluxServer] port:    ${PORT}`);
  console.log(`[ConfluxServer] version: ${APP_VERSION} (${COMMIT_SHA})`);
  console.log(`[ConfluxServer] rooms:   ${REGISTERED_ROOMS.join(', ')}`);
  const rawAllowed = process.env.ALLOWED_ORIGINS;
  console.log(`[ConfluxServer] origins: ${rawAllowed ? rawAllowed : '* (open — set ALLOWED_ORIGINS in production)'}`);
  console.log(`[ConfluxServer] health:  http://0.0.0.0:${PORT}/health`);
  console.log(`[ConfluxServer] diag:    http://0.0.0.0:${PORT}/diagnostics`);
});
